"""Kasa online store - Flask backend.

Run with:  python app.py   (then open http://localhost:5000)
"""
import json
import os
import re
import secrets
import threading
from datetime import datetime

from flask import Flask, g, jsonify, request, send_from_directory
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import check_password_hash, generate_password_hash

from db import init_db, one, query, run, transaction
from seed import seed

PORT = int(os.environ.get("PORT", 5000))
SECRET_KEY = os.environ.get("SECRET_KEY", "change-me-in-production")
TOKEN_MAX_AGE = 7 * 24 * 3600  # login lasts 7 days

DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "client", "dist")

app = Flask(__name__, static_folder=None)
signer = URLSafeTimedSerializer(SECRET_KEY)

# SQLite uses one shared connection, so handle one request at a time.
_lock = threading.RLock()


@app.before_request
def _acquire():
    _lock.acquire()
    g.locked = True


@app.teardown_request
def _release(_exc):
    if g.pop("locked", False):
        _lock.release()


# ------------------------------------------------------------------ helpers

class ApiError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


@app.errorhandler(ApiError)
def handle_api_error(err):
    return jsonify(error=err.message), err.status


@app.errorhandler(404)
def handle_404(_err):
    if request.path.startswith("/api"):
        return jsonify(error="Not found."), 404
    return serve_spa("")


@app.errorhandler(Exception)
def handle_unexpected(err):
    app.logger.exception(err)
    return jsonify(error="Something went wrong on the server."), 500


def body():
    return request.get_json(silent=True) or {}


def to_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def to_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def is_email(value):
    return isinstance(value, str) and re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", value) is not None


def effective_price(p):
    return p["discount_price"] if p["discount_price"] is not None else p["price"]


def public_user(u):
    return {"id": u["id"], "name": u["name"], "email": u["email"], "phone": u["phone"], "role": u["role"]}


def sign_token(user):
    return signer.dumps({"id": user["id"]})


def current_user():
    """Return the logged-in user (from the Authorization header) or None."""
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    try:
        data = signer.loads(header[7:], max_age=TOKEN_MAX_AGE)
    except (BadSignature, SignatureExpired):
        return None
    return one("SELECT * FROM users WHERE id = ?", (data["id"],))


def require_user():
    user = current_user()
    if not user:
        raise ApiError("Please log in first.", 401)
    return user


def require_admin():
    user = require_user()
    if user["role"] != "admin":
        raise ApiError("Admin access only.", 403)
    return user


# A product row together with its rating summary.
PRODUCT_SELECT = """
  SELECT p.*, c.name AS category_name, c.slug AS category_slug,
    COALESCE((SELECT AVG(rating) FROM reviews r WHERE r.product_id = p.id), 0) AS avg_rating,
    (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) AS review_count
  FROM products p JOIN categories c ON c.id = p.category_id
"""


def shape_product(p):
    p["specs"] = json.loads(p.get("specs") or "[]")
    p["price_now"] = effective_price(p)
    p["in_stock"] = p["stock_quantity"] > 0
    return p


# --------------------------------------------------------------------- auth

@app.post("/api/auth/register")
def register():
    b = body()
    name, email, password = (b.get("name") or "").strip(), (b.get("email") or "").lower(), b.get("password") or ""
    if not name or not is_email(email) or len(password) < 6:
        raise ApiError("Enter a name, a valid email and a password of 6+ characters.")
    if one("SELECT id FROM users WHERE email = ?", (email,)):
        raise ApiError("An account with this email already exists.", 409)
    cur = run("INSERT INTO users (name, email, password_hash, phone) VALUES (?, ?, ?, ?)",
              (name, email, generate_password_hash(password), b.get("phone")))
    user = one("SELECT * FROM users WHERE id = ?", (cur.lastrowid,))
    return jsonify(token=sign_token(user), user=public_user(user)), 201


@app.post("/api/auth/login")
def login():
    b = body()
    email = (b.get("email") or "").lower()
    user = one("SELECT * FROM users WHERE email = ?", (email,)) if is_email(email) else None
    if not user or not check_password_hash(user["password_hash"], b.get("password") or ""):
        raise ApiError("Wrong email or password.", 401)
    return jsonify(token=sign_token(user), user=public_user(user))


@app.get("/api/auth/me")
def me():
    return jsonify(user=public_user(require_user()))


# ---------------------------------------------------------------- catalogue

@app.get("/api/categories")
def categories():
    return jsonify(query("""
        SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_active = 1) AS product_count
        FROM categories c ORDER BY c.name"""))


@app.get("/api/products")
def products():
    a = request.args
    page = max(to_int(a.get("page"), 1), 1)
    limit = min(to_int(a.get("limit"), 12) or 12, 48)

    where, params = ["p.is_active = 1"], []
    if a.get("search"):
        where.append("(p.name LIKE ? OR p.description LIKE ?)")
        params += [f"%{a['search']}%"] * 2
    if a.get("category"):
        where.append("c.slug = ?")
        params.append(a["category"])
    if a.get("minPrice"):
        where.append("COALESCE(p.discount_price, p.price) >= ?")
        params.append(to_float(a["minPrice"]))
    if a.get("maxPrice"):
        where.append("COALESCE(p.discount_price, p.price) <= ?")
        params.append(to_float(a["maxPrice"]))
    if a.get("featured"):
        where.append("p.is_featured = 1")
    if a.get("inStock"):
        where.append("p.stock_quantity > 0")

    order_by = {
        "price_asc": "COALESCE(p.discount_price, p.price) ASC",
        "price_desc": "COALESCE(p.discount_price, p.price) DESC",
        "newest": "p.created_at DESC, p.id DESC",
        "rating": "avg_rating DESC, review_count DESC",
    }.get(a.get("sort"), "p.id ASC")

    clause = " WHERE " + " AND ".join(where)
    total = one("SELECT COUNT(*) AS n FROM products p JOIN categories c ON c.id = p.category_id" + clause, params)["n"]
    rows = query(f"{PRODUCT_SELECT}{clause} ORDER BY {order_by} LIMIT ? OFFSET ?", params + [limit, (page - 1) * limit])
    pages = max(-(-total // limit), 1)
    return jsonify(products=[shape_product(r) for r in rows], total=total, page=page, pages=pages)


@app.get("/api/products/<slug>")
def product_detail(slug):
    product = one(PRODUCT_SELECT + " WHERE p.slug = ? AND p.is_active = 1", (slug,))
    if not product:
        raise ApiError("Product not found.", 404)
    related = query(PRODUCT_SELECT + " WHERE p.category_id = ? AND p.id != ? AND p.is_active = 1 LIMIT 4",
                    (product["category_id"], product["id"]))
    reviews = query("""SELECT r.id, r.rating, r.comment, r.created_at, u.name AS user_name
                       FROM reviews r JOIN users u ON u.id = r.user_id
                       WHERE r.product_id = ? ORDER BY r.id DESC""", (product["id"],))
    return jsonify(product=shape_product(product), related=[shape_product(r) for r in related], reviews=reviews)


@app.post("/api/products/<int:product_id>/reviews")
def add_review(product_id):
    user = require_user()
    b = body()
    rating = to_int(b.get("rating"))
    if not 1 <= rating <= 5:
        raise ApiError("Rating must be 1 to 5.")
    if not one("SELECT id FROM products WHERE id = ?", (product_id,)):
        raise ApiError("Product not found.", 404)
    # One review per customer per product; posting again updates it.
    run("""INSERT INTO reviews (product_id, user_id, rating, comment) VALUES (?, ?, ?, ?)
           ON CONFLICT(product_id, user_id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment""",
        (product_id, user["id"], rating, (b.get("comment") or "")[:1000]))
    return jsonify(ok=True), 201


# ----------------------------------------------------------------- wishlist

@app.get("/api/wishlist/ids")
def wishlist_ids():
    user = require_user()
    return jsonify([r["product_id"] for r in query("SELECT product_id FROM wishlist WHERE user_id = ?", (user["id"],))])


@app.get("/api/wishlist")
def wishlist():
    user = require_user()
    rows = query(PRODUCT_SELECT + """ JOIN wishlist w ON w.product_id = p.id
                                      WHERE w.user_id = ? AND p.is_active = 1 ORDER BY w.id DESC""", (user["id"],))
    return jsonify([shape_product(r) for r in rows])


@app.post("/api/wishlist/<int:product_id>")
def toggle_wishlist(product_id):
    """Like a product, or unlike it if it is already liked."""
    user = require_user()
    if not one("SELECT id FROM products WHERE id = ? AND is_active = 1", (product_id,)):
        raise ApiError("Product not found.", 404)
    if one("SELECT id FROM wishlist WHERE user_id = ? AND product_id = ?", (user["id"], product_id)):
        run("DELETE FROM wishlist WHERE user_id = ? AND product_id = ?", (user["id"], product_id))
        return jsonify(liked=False)
    run("INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)", (user["id"], product_id))
    return jsonify(liked=True)


# --------------------------------------------------------------------- cart

# Saved cart for logged-in users, so it survives refresh and a new device.
@app.get("/api/cart")
def get_cart():
    user = require_user()
    return jsonify(query("SELECT product_id AS productId, quantity FROM cart_items WHERE user_id = ?", (user["id"],)))


@app.put("/api/cart")
def save_cart():
    user = require_user()
    items = body().get("items")
    items = items if isinstance(items, list) else []
    with transaction():
        run("DELETE FROM cart_items WHERE user_id = ?", (user["id"],))
        for it in items:
            qty = to_int(it.get("quantity"))
            if qty > 0 and one("SELECT id FROM products WHERE id = ?", (it.get("productId"),)):
                run("INSERT OR REPLACE INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)",
                    (user["id"], it["productId"], min(qty, 99)))
    return jsonify(ok=True)


# ------------------------------------------------------------------ pricing

FREE_SHIPPING_ABOVE = 999
TAX_RATE = 0.18
SHIPPING = {"standard": 49, "express": 149}


def price_cart(items, delivery_option="standard", lenient=False):
    """All money maths happens here on the server; client values are never trusted.
    With lenient=True (used to display the cart) problems are skipped instead of raised."""
    if not isinstance(items, list) or (not items and not lenient):
        raise ApiError("Your cart is empty.")
    lines = []
    for it in items:
        product = one("SELECT * FROM products WHERE id = ? AND is_active = 1", (it.get("productId"),))
        qty = to_int(it.get("quantity"))
        if not product:
            if lenient:
                continue
            raise ApiError("A product in your cart is no longer available.")
        if qty < 1:
            if lenient:
                continue
            raise ApiError(f"Invalid quantity for {product['name']}.")
        if not lenient and product["stock_quantity"] < qty:
            raise ApiError(f"{product['name']} is out of stock." if product["stock_quantity"] == 0
                           else f"Only {product['stock_quantity']} left of {product['name']}.")
        unit = effective_price(product)
        lines.append({"product": product, "quantity": qty, "unit_price": unit, "total_price": round(unit * qty, 2)})

    subtotal = round(sum(l["total_price"] for l in lines), 2)
    base = SHIPPING.get(delivery_option, SHIPPING["standard"])
    shipping_fee = 0 if (delivery_option == "standard" and subtotal >= FREE_SHIPPING_ABOVE) else base
    tax = round(subtotal * TAX_RATE, 2)
    return {"lines": lines, "subtotal": subtotal, "shipping_fee": shipping_fee, "tax": tax,
            "total_amount": round(subtotal + shipping_fee + tax, 2)}


@app.post("/api/cart/price")
def cart_price():
    b = body()
    priced = price_cart(b.get("items"), b.get("deliveryOption", "standard"), bool(b.get("lenient")))
    return jsonify(
        lines=[{
            "productId": l["product"]["id"], "name": l["product"]["name"], "slug": l["product"]["slug"],
            "stock": l["product"]["stock_quantity"], "image_url": l["product"]["image_url"],
            "unit_price": l["unit_price"], "quantity": l["quantity"], "total_price": l["total_price"],
        } for l in priced["lines"]],
        subtotal=priced["subtotal"], shipping_fee=priced["shipping_fee"], tax=priced["tax"],
        total_amount=priced["total_amount"],
    )


# ------------------------------------------------------------------- orders

ORDER_STATUSES = ["Pending", "Paid", "Shipped", "Delivered", "Cancelled"]


def load_order(row):
    if not row:
        return None
    row["items"] = query("SELECT * FROM order_items WHERE order_id = ?", (row["id"],))
    row["payment"] = one("SELECT * FROM payments WHERE order_id = ?", (row["id"],))
    return row


def new_order_number():
    return f"SV-{datetime.now():%Y%m%d}-{secrets.randbelow(9000) + 1000}"


@app.post("/api/orders")
def place_order():
    user = current_user()
    b = body()
    s = b.get("shipping") or {}
    payment_method = b.get("paymentMethod")
    delivery = b.get("deliveryOption", "standard")
    email = (user["email"] if user else (s.get("email") or "")).lower()

    if payment_method not in ("cod", "upi", "card"):
        raise ApiError("Choose a payment method.")
    fields = {k: (s.get(k) or "").strip() for k in ("name", "phone", "address", "city", "state", "pincode")}
    if not all(fields.values()):
        raise ApiError("Please fill in the full delivery address.")
    if not is_email(email):
        raise ApiError("Enter a valid email address.")
    if not re.fullmatch(r"\d{6}", fields["pincode"]):
        raise ApiError("Pincode must be 6 digits.")

    # Re-check stock and re-price inside the transaction so two buyers cannot take the same last item.
    with transaction():
        priced = price_cart(b.get("items"), delivery)

        # Card/UPI go through the (simulated) gateway and are paid straight away; COD is paid on delivery.
        paid_now = payment_method != "cod"
        cur = run(
            """INSERT INTO orders (order_number, user_id, email, ship_name, ship_phone, ship_address, ship_city,
                 ship_state, ship_pincode, delivery_option, subtotal, shipping_fee, tax, total_amount,
                 payment_method, payment_status, order_status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (new_order_number(), user["id"] if user else None, email, fields["name"], fields["phone"],
             fields["address"], fields["city"], fields["state"], fields["pincode"], delivery,
             priced["subtotal"], priced["shipping_fee"], priced["tax"], priced["total_amount"], payment_method,
             "Paid" if paid_now else "Pending", "Paid" if paid_now else "Pending"),
        )
        order_id = cur.lastrowid

        for l in priced["lines"]:
            p = l["product"]
            run("""INSERT INTO order_items (order_id, product_id, product_name, image_url, unit_price, quantity, total_price)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (order_id, p["id"], p["name"], p["image_url"], l["unit_price"], l["quantity"], l["total_price"]))
            run("UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?", (l["quantity"], p["id"]))

        run("INSERT INTO payments (order_id, provider, transaction_id, amount, status) VALUES (?, ?, ?, ?, ?)",
            (order_id, "demo_gateway" if paid_now else "cash_on_delivery",
             "TXN" + secrets.token_hex(5).upper() if paid_now else None,
             priced["total_amount"], "success" if paid_now else "pending"))

        if user:
            run("DELETE FROM cart_items WHERE user_id = ?", (user["id"],))

    return jsonify(load_order(one("SELECT * FROM orders WHERE id = ?", (order_id,)))), 201


@app.get("/api/orders")
def my_orders():
    user = require_user()
    rows = query("SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC", (user["id"],))
    return jsonify([load_order(r) for r in rows])


@app.get("/api/orders/track")
def track_order():
    """Guests can look up an order with its number plus the email used at checkout."""
    row = one("SELECT * FROM orders WHERE order_number = ? AND email = ?",
              ((request.args.get("number") or "").strip(), (request.args.get("email") or "").strip().lower()))
    if not row:
        raise ApiError("No order found with those details.", 404)
    return jsonify(load_order(row))


@app.get("/api/orders/<number>")
def order_detail(number):
    user = require_user()
    row = one("SELECT * FROM orders WHERE order_number = ?", (number,))
    # Customers may only see their own orders.
    if not row or (row["user_id"] != user["id"] and user["role"] != "admin"):
        raise ApiError("Order not found.", 404)
    return jsonify(load_order(row))


def cancel_order(row):
    """Put the stock back and mark the order (and its payment) as cancelled/refunded."""
    with transaction():
        for item in query("SELECT product_id, quantity FROM order_items WHERE order_id = ?", (row["id"],)):
            run("UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?", (item["quantity"], item["product_id"]))
        refunded = row["payment_status"] == "Paid"
        run("UPDATE orders SET order_status = 'Cancelled', payment_status = ? WHERE id = ?",
            ("Refunded" if refunded else "Cancelled", row["id"]))
        run("UPDATE payments SET status = ? WHERE order_id = ?", ("refunded" if refunded else "cancelled", row["id"]))


@app.post("/api/orders/<number>/cancel")
def cancel(number):
    """A customer can cancel only until the order is shipped."""
    user = current_user()
    row = one("SELECT * FROM orders WHERE order_number = ?", (number,))
    owner = row and (
        (user and (row["user_id"] == user["id"] or user["role"] == "admin"))
        or (not user and row["email"] == (body().get("email") or "").lower())
    )
    if not owner:
        raise ApiError("Order not found.", 404)
    if row["order_status"] not in ("Pending", "Paid"):
        raise ApiError("This order has already been shipped or closed and cannot be cancelled.")
    cancel_order(row)
    return jsonify(load_order(one("SELECT * FROM orders WHERE id = ?", (row["id"],))))


# -------------------------------------------------------------------- admin

@app.get("/api/admin/stats")
def admin_stats():
    require_admin()
    return jsonify(
        revenue=one("SELECT COALESCE(SUM(total_amount), 0) AS v FROM orders WHERE order_status != 'Cancelled'")["v"],
        orders=one("SELECT COUNT(*) AS v FROM orders")["v"],
        customers=one("SELECT COUNT(*) AS v FROM users WHERE role = 'customer'")["v"],
        lowStock=one("SELECT COUNT(*) AS v FROM products WHERE stock_quantity <= 5 AND is_active = 1")["v"],
        byStatus=query("SELECT order_status AS status, COUNT(*) AS n FROM orders GROUP BY order_status"),
    )


@app.get("/api/admin/products")
def admin_products():
    require_admin()
    rows = query(PRODUCT_SELECT + " ORDER BY p.id DESC")
    return jsonify([shape_product(r) for r in rows])


def read_product_body():
    b = body()
    price = to_float(b.get("price"))
    raw_discount = b.get("discount_price")
    discount = None if raw_discount in ("", None) else to_float(raw_discount)
    if not (b.get("name") or "").strip() or price <= 0 or not b.get("category_id"):
        raise ApiError("Name, category and a valid price are required.")
    if discount is not None and not (0 < discount < price):
        raise ApiError("Discount price must be lower than the price.")
    return {
        "name": b["name"].strip(), "category_id": to_int(b["category_id"]), "description": b.get("description") or "",
        "price": price, "discount_price": discount, "stock_quantity": max(to_int(b.get("stock_quantity")), 0),
        "image_url": b.get("image_url") or None, "is_featured": 1 if b.get("is_featured") else 0,
        "is_active": 0 if b.get("is_active") in (False, 0) else 1,
    }


@app.post("/api/admin/products")
def admin_create_product():
    require_admin()
    p = read_product_body()
    slug = slugify(p["name"])
    if one("SELECT id FROM products WHERE slug = ?", (slug,)):
        slug += f"-{secrets.randbelow(900) + 100}"
    cur = run(
        """INSERT INTO products (category_id, name, slug, description, price, discount_price, sku, stock_quantity,
             image_url, is_featured, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (p["category_id"], p["name"], slug, p["description"], p["price"], p["discount_price"],
         f"SKU-{secrets.randbelow(90000) + 10000}", p["stock_quantity"],
         p["image_url"] or f"https://loremflickr.com/800/800/{re.sub(r'[^a-z0-9]', '', p['name'].split()[-1].lower())}?lock={secrets.randbelow(900) + 100}",
         p["is_featured"], p["is_active"]),
    )
    return jsonify(id=cur.lastrowid), 201


@app.put("/api/admin/products/<int:product_id>")
def admin_update_product(product_id):
    require_admin()
    p = read_product_body()
    run("""UPDATE products SET category_id=?, name=?, description=?, price=?, discount_price=?, stock_quantity=?,
             image_url=COALESCE(?, image_url), is_featured=?, is_active=? WHERE id=?""",
        (p["category_id"], p["name"], p["description"], p["price"], p["discount_price"], p["stock_quantity"],
         p["image_url"], p["is_featured"], p["is_active"], product_id))
    return jsonify(ok=True)


@app.delete("/api/admin/products/<int:product_id>")
def admin_delete_product(product_id):
    """Soft delete: products that appear in old orders must stay in the database."""
    require_admin()
    run("UPDATE products SET is_active = 0 WHERE id = ?", (product_id,))
    return jsonify(ok=True)


@app.get("/api/admin/orders")
def admin_orders():
    require_admin()
    return jsonify([load_order(r) for r in query("SELECT * FROM orders ORDER BY id DESC")])


# Allowed status changes. Anything else is rejected, so an order cannot jump around.
TRANSITIONS = {
    "Pending": ["Paid", "Shipped", "Cancelled"],
    "Paid": ["Shipped", "Cancelled"],
    "Shipped": ["Delivered"],
    "Delivered": [],
    "Cancelled": [],
}


@app.put("/api/admin/orders/<number>/status")
def admin_order_status(number):
    require_admin()
    status = body().get("status")
    row = one("SELECT * FROM orders WHERE order_number = ?", (number,))
    if not row:
        raise ApiError("Order not found.", 404)
    if status not in ORDER_STATUSES or status not in TRANSITIONS[row["order_status"]]:
        raise ApiError(f"Cannot move an order from {row['order_status']} to {status}.")
    if status == "Cancelled":
        cancel_order(row)
    else:
        # Cash on delivery counts as paid once the parcel is delivered.
        payment_status = "Paid" if status in ("Paid", "Delivered") else row["payment_status"]
        run("UPDATE orders SET order_status = ?, payment_status = ? WHERE id = ?", (status, payment_status, row["id"]))
        if payment_status == "Paid":
            run("UPDATE payments SET status = 'success' WHERE order_id = ?", (row["id"],))
    return jsonify(load_order(one("SELECT * FROM orders WHERE id = ?", (row["id"],))))


# ----------------------------------------------------- serve the web pages

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_spa(path):
    """The React app is built into client/dist; every page URL returns it so refresh works."""
    if path.startswith("api/"):
        return jsonify(error="Not found."), 404
    if not os.path.isdir(DIST):
        return ("The website files are missing. Build them with: cd client && npm install && npm run build",
                503)
    full = os.path.join(DIST, path)
    if path and os.path.isfile(full):
        return send_from_directory(DIST, path)
    return send_from_directory(DIST, "index.html")


# ------------------------------------------------------------------ startup

init_db()
if one("SELECT COUNT(*) AS n FROM products")["n"] == 0:
    seed()

if __name__ == "__main__":
    print(f"Kasa store running on http://localhost:{PORT}")
    app.run(host="127.0.0.1", port=PORT, debug=False, threaded=True)
