const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";

app.use(cors());
app.use(express.json());

/* ------------------------------ Helpers ------------------------------ */

const round2 = (n) => Math.round(n * 100) / 100;
const effectivePrice = (p) => (p.discount_price != null ? p.discount_price : p.price);
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const isEmail = (s) => typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
}

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role };
}

function shapeProduct(p) {
  return {
    ...p,
    specs: JSON.parse(p.specs || "[]"),
    price_now: effectivePrice(p),
    in_stock: p.stock_quantity > 0,
  };
}

// Attaches req.user when a valid token is present; never rejects.
function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(header.slice(7), JWT_SECRET);
      req.user = db.prepare("SELECT * FROM users WHERE id = ?").get(payload.id) || null;
    } catch {
      req.user = null;
    }
  }
  next();
}

function requireAuth(req, res, next) {
  optionalAuth(req, res, () => {
    if (!req.user) return res.status(401).json({ error: "Please log in first." });
    next();
  });
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Admin access only." });
    next();
  });
}

/* --------------------------------- Auth --------------------------------- */

app.post("/api/auth/register", (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name?.trim() || !isEmail(email) || !password || password.length < 6) {
    return res.status(400).json({ error: "Enter a name, a valid email and a password of 6+ characters." });
  }
  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase());
  if (exists) return res.status(409).json({ error: "An account with this email already exists." });

  const info = db
    .prepare("INSERT INTO users (name, email, password_hash, phone) VALUES (?, ?, ?, ?)")
    .run(name.trim(), email.toLowerCase(), bcrypt.hashSync(password, 10), phone || null);
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const user = isEmail(email) ? db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase()) : null;
  if (!user || !bcrypt.compareSync(password || "", user.password_hash)) {
    return res.status(401).json({ error: "Wrong email or password." });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

app.get("/api/auth/me", requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

/* ------------------------------- Catalogue ------------------------------- */

app.get("/api/categories", (_req, res) => {
  res.json(
    db
      .prepare(
        `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_active = 1) AS product_count
         FROM categories c ORDER BY c.name`
      )
      .all()
  );
});

app.get("/api/products", (req, res) => {
  const { search, category, minPrice, maxPrice, sort, featured, inStock } = req.query;
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 12, 48);

  const where = ["p.is_active = 1"];
  const params = [];
  if (search) {
    where.push("(p.name LIKE ? OR p.description LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  if (category) {
    where.push("c.slug = ?");
    params.push(category);
  }
  if (minPrice) {
    where.push("COALESCE(p.discount_price, p.price) >= ?");
    params.push(Number(minPrice));
  }
  if (maxPrice) {
    where.push("COALESCE(p.discount_price, p.price) <= ?");
    params.push(Number(maxPrice));
  }
  if (featured) where.push("p.is_featured = 1");
  if (inStock) where.push("p.stock_quantity > 0");

  const orderBy =
    {
      price_asc: "COALESCE(p.discount_price, p.price) ASC",
      price_desc: "COALESCE(p.discount_price, p.price) DESC",
      newest: "p.created_at DESC, p.id DESC",
      rating: "avg_rating DESC",
    }[sort] || "p.id ASC";

  const base = `FROM products p JOIN categories c ON c.id = p.category_id WHERE ${where.join(" AND ")}`;
  const total = db.prepare(`SELECT COUNT(*) AS n ${base}`).get(...params).n;
  const rows = db
    .prepare(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug,
         COALESCE((SELECT AVG(rating) FROM reviews r WHERE r.product_id = p.id), 0) AS avg_rating,
         (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) AS review_count
       ${base} ORDER BY ${orderBy} LIMIT ? OFFSET ?`
    )
    .all(...params, limit, (page - 1) * limit);

  res.json({ products: rows.map(shapeProduct), total, page, pages: Math.max(Math.ceil(total / limit), 1) });
});

app.get("/api/products/:slug", (req, res) => {
  const product = db
    .prepare(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug,
         COALESCE((SELECT AVG(rating) FROM reviews r WHERE r.product_id = p.id), 0) AS avg_rating,
         (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) AS review_count
       FROM products p JOIN categories c ON c.id = p.category_id
       WHERE p.slug = ? AND p.is_active = 1`
    )
    .get(req.params.slug);
  if (!product) return res.status(404).json({ error: "Product not found." });

  const related = db
    .prepare(
      `SELECT p.*, c.name AS category_name FROM products p JOIN categories c ON c.id = p.category_id
       WHERE p.category_id = ? AND p.id != ? AND p.is_active = 1 LIMIT 4`
    )
    .all(product.category_id, product.id);
  const reviews = db
    .prepare(
      `SELECT r.id, r.rating, r.comment, r.created_at, u.name AS user_name
       FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.product_id = ? ORDER BY r.id DESC`
    )
    .all(product.id);

  res.json({ product: shapeProduct(product), related: related.map(shapeProduct), reviews });
});

app.post("/api/products/:id/reviews", requireAuth, (req, res) => {
  const rating = parseInt(req.body.rating);
  if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ error: "Rating must be 1 to 5." });
  const product = db.prepare("SELECT id FROM products WHERE id = ?").get(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found." });

  // One review per customer per product; posting again updates it.
  db.prepare(
    `INSERT INTO reviews (product_id, user_id, rating, comment) VALUES (?, ?, ?, ?)
     ON CONFLICT(product_id, user_id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment`
  ).run(product.id, req.user.id, rating, (req.body.comment || "").slice(0, 1000));
  res.status(201).json({ ok: true });
});

/* ---------------------------------- Cart ---------------------------------- */

// Saved cart for logged-in users, so it survives refresh and a new device.
app.get("/api/cart", requireAuth, (req, res) => {
  res.json(
    db.prepare("SELECT product_id AS productId, quantity FROM cart_items WHERE user_id = ?").all(req.user.id)
  );
});

app.put("/api/cart", requireAuth, (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const save = db.transaction(() => {
    db.prepare("DELETE FROM cart_items WHERE user_id = ?").run(req.user.id);
    const insert = db.prepare("INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)");
    for (const it of items) {
      const exists = db.prepare("SELECT id FROM products WHERE id = ?").get(it.productId);
      if (exists && it.quantity > 0) insert.run(req.user.id, it.productId, Math.min(it.quantity, 99));
    }
  });
  save();
  res.json({ ok: true });
});

/* -------------------------------- Pricing -------------------------------- */

const FREE_SHIPPING_ABOVE = 999;
const TAX_RATE = 0.18;
const SHIPPING = { standard: 49, express: 149 };

// All money maths happens here on the server; client values are never trusted.
// With lenient = true (used to display the cart) problems are skipped instead of thrown.
function priceCart(items, deliveryOption = "standard", lenient = false) {
  if (!Array.isArray(items) || (items.length === 0 && !lenient)) throw new Error("Your cart is empty.");
  const lines = [];
  for (const it of items) {
    const product = db.prepare("SELECT * FROM products WHERE id = ? AND is_active = 1").get(it.productId);
    const qty = parseInt(it.quantity);
    if (!product) {
      if (lenient) continue;
      throw new Error("A product in your cart is no longer available.");
    }
    if (!(qty >= 1)) {
      if (lenient) continue;
      throw new Error(`Invalid quantity for ${product.name}.`);
    }
    if (!lenient && product.stock_quantity < qty) {
      throw new Error(
        product.stock_quantity === 0
          ? `${product.name} is out of stock.`
          : `Only ${product.stock_quantity} left of ${product.name}.`
      );
    }
    const unit = effectivePrice(product);
    lines.push({ product, quantity: qty, unit_price: unit, total_price: round2(unit * qty) });
  }
  const subtotal = round2(lines.reduce((s, l) => s + l.total_price, 0));
  const base = SHIPPING[deliveryOption] ?? SHIPPING.standard;
  const shipping_fee = deliveryOption === "standard" && subtotal >= FREE_SHIPPING_ABOVE ? 0 : base;
  const tax = round2(subtotal * TAX_RATE);
  return { lines, subtotal, shipping_fee, tax, total_amount: round2(subtotal + shipping_fee + tax) };
}

app.post("/api/cart/price", (req, res) => {
  try {
    const priced = priceCart(req.body.items, req.body.deliveryOption, !!req.body.lenient);
    res.json({
      lines: priced.lines.map((l) => ({
        productId: l.product.id,
        name: l.product.name,
        slug: l.product.slug,
        stock: l.product.stock_quantity,
        image_url: l.product.image_url,
        unit_price: l.unit_price,
        quantity: l.quantity,
        total_price: l.total_price,
      })),
      subtotal: priced.subtotal,
      shipping_fee: priced.shipping_fee,
      tax: priced.tax,
      total_amount: priced.total_amount,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/* --------------------------------- Orders --------------------------------- */

const ORDER_STATUSES = ["Pending", "Paid", "Shipped", "Delivered", "Cancelled"];

function loadOrder(row) {
  if (!row) return null;
  const items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(row.id);
  const payment = db.prepare("SELECT * FROM payments WHERE order_id = ?").get(row.id);
  return { ...row, items, payment };
}

function newOrderNumber() {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `SV-${d}-${crypto.randomInt(1000, 9999)}`;
}

app.post("/api/orders", optionalAuth, (req, res) => {
  const { items, shipping, deliveryOption = "standard", paymentMethod } = req.body;
  const s = shipping || {};
  const email = (req.user ? req.user.email : s.email || "").toLowerCase();

  if (!["cod", "upi", "card"].includes(paymentMethod)) return res.status(400).json({ error: "Choose a payment method." });
  if (!s.name?.trim() || !s.phone?.trim() || !s.address?.trim() || !s.city?.trim() || !s.state?.trim() || !s.pincode?.trim()) {
    return res.status(400).json({ error: "Please fill in the full delivery address." });
  }
  if (!isEmail(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (!/^\d{6}$/.test(s.pincode.trim())) return res.status(400).json({ error: "Pincode must be 6 digits." });

  try {
    const place = db.transaction(() => {
      // Re-check stock and re-price inside the transaction so two buyers cannot take the same last item.
      const priced = priceCart(items, deliveryOption);

      // Card/UPI go through the (simulated) gateway and are paid straight away; COD is paid on delivery.
      const paidNow = paymentMethod !== "cod";
      const orderStatus = paidNow ? "Paid" : "Pending";
      const orderNumber = newOrderNumber();

      const info = db
        .prepare(
          `INSERT INTO orders (order_number, user_id, email, ship_name, ship_phone, ship_address, ship_city, ship_state,
             ship_pincode, delivery_option, subtotal, shipping_fee, tax, total_amount, payment_method, payment_status, order_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          orderNumber, req.user?.id ?? null, email, s.name.trim(), s.phone.trim(), s.address.trim(), s.city.trim(),
          s.state.trim(), s.pincode.trim(), deliveryOption, priced.subtotal, priced.shipping_fee, priced.tax,
          priced.total_amount, paymentMethod, paidNow ? "Paid" : "Pending", orderStatus
        );
      const orderId = info.lastInsertRowid;

      const insertItem = db.prepare(
        `INSERT INTO order_items (order_id, product_id, product_name, image_url, unit_price, quantity, total_price)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      const reduceStock = db.prepare("UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?");
      for (const l of priced.lines) {
        insertItem.run(orderId, l.product.id, l.product.name, l.product.image_url, l.unit_price, l.quantity, l.total_price);
        reduceStock.run(l.quantity, l.product.id);
      }

      db.prepare("INSERT INTO payments (order_id, provider, transaction_id, amount, status) VALUES (?, ?, ?, ?, ?)").run(
        orderId,
        paymentMethod === "cod" ? "cash_on_delivery" : "demo_gateway",
        paidNow ? `TXN${crypto.randomBytes(5).toString("hex").toUpperCase()}` : null,
        priced.total_amount,
        paidNow ? "success" : "pending"
      );

      if (req.user) db.prepare("DELETE FROM cart_items WHERE user_id = ?").run(req.user.id);
      return orderId;
    });

    const orderId = place();
    res.status(201).json(loadOrder(db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/api/orders", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC").all(req.user.id);
  res.json(rows.map(loadOrder));
});

// Guests can look up an order with its number plus the email used at checkout.
app.get("/api/orders/track", (req, res) => {
  const row = db
    .prepare("SELECT * FROM orders WHERE order_number = ? AND email = ?")
    .get(String(req.query.number || "").trim(), String(req.query.email || "").trim().toLowerCase());
  if (!row) return res.status(404).json({ error: "No order found with those details." });
  res.json(loadOrder(row));
});

app.get("/api/orders/:number", requireAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM orders WHERE order_number = ?").get(req.params.number);
  // Customers may only see their own orders.
  if (!row || (row.user_id !== req.user.id && req.user.role !== "admin")) {
    return res.status(404).json({ error: "Order not found." });
  }
  res.json(loadOrder(row));
});

function cancelOrder(row) {
  db.transaction(() => {
    const restore = db.prepare("UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?");
    db.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?")
      .all(row.id)
      .forEach((i) => restore.run(i.quantity, i.product_id));
    const refunded = row.payment_status === "Paid";
    db.prepare("UPDATE orders SET order_status = 'Cancelled', payment_status = ? WHERE id = ?").run(
      refunded ? "Refunded" : "Cancelled",
      row.id
    );
    db.prepare("UPDATE payments SET status = ? WHERE order_id = ?").run(refunded ? "refunded" : "cancelled", row.id);
  })();
}

// A customer can cancel only until the order is shipped.
app.post("/api/orders/:number/cancel", optionalAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM orders WHERE order_number = ?").get(req.params.number);
  const owner =
    row && ((req.user && (row.user_id === req.user.id || req.user.role === "admin")) ||
      (!req.user && row.email === String(req.body.email || "").toLowerCase()));
  if (!owner) return res.status(404).json({ error: "Order not found." });
  if (!["Pending", "Paid"].includes(row.order_status)) {
    return res.status(400).json({ error: "This order has already been shipped or closed and cannot be cancelled." });
  }
  cancelOrder(row);
  res.json(loadOrder(db.prepare("SELECT * FROM orders WHERE id = ?").get(row.id)));
});

/* ---------------------------------- Admin ---------------------------------- */

app.get("/api/admin/stats", requireAdmin, (_req, res) => {
  const one = (sql) => db.prepare(sql).get();
  res.json({
    revenue: one("SELECT COALESCE(SUM(total_amount),0) v FROM orders WHERE order_status != 'Cancelled'").v,
    orders: one("SELECT COUNT(*) v FROM orders").v,
    customers: one("SELECT COUNT(*) v FROM users WHERE role = 'customer'").v,
    lowStock: one("SELECT COUNT(*) v FROM products WHERE stock_quantity <= 5 AND is_active = 1").v,
    byStatus: db.prepare("SELECT order_status AS status, COUNT(*) AS n FROM orders GROUP BY order_status").all(),
  });
});

app.get("/api/admin/products", requireAdmin, (_req, res) => {
  res.json(
    db
      .prepare("SELECT p.*, c.name AS category_name FROM products p JOIN categories c ON c.id = p.category_id ORDER BY p.id DESC")
      .all()
      .map(shapeProduct)
  );
});

function readProductBody(b) {
  const price = Number(b.price);
  const discount = b.discount_price === "" || b.discount_price == null ? null : Number(b.discount_price);
  if (!b.name?.trim() || !(price > 0) || !b.category_id) throw new Error("Name, category and a valid price are required.");
  if (discount != null && !(discount > 0 && discount < price)) throw new Error("Discount price must be lower than the price.");
  return {
    name: b.name.trim(),
    category_id: Number(b.category_id),
    description: b.description || "",
    price,
    discount_price: discount,
    stock_quantity: Math.max(parseInt(b.stock_quantity) || 0, 0),
    image_url: b.image_url || null,
    is_featured: b.is_featured ? 1 : 0,
    is_active: b.is_active === false || b.is_active === 0 ? 0 : 1,
  };
}

app.post("/api/admin/products", requireAdmin, (req, res) => {
  try {
    const p = readProductBody(req.body);
    let slug = slugify(p.name);
    if (db.prepare("SELECT id FROM products WHERE slug = ?").get(slug)) slug += "-" + crypto.randomInt(100, 999);
    const info = db
      .prepare(
        `INSERT INTO products (category_id, name, slug, description, price, discount_price, sku, stock_quantity, image_url, is_featured, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(p.category_id, p.name, slug, p.description, p.price, p.discount_price, `SKU-${Date.now() % 100000}`, p.stock_quantity,
        p.image_url || `https://loremflickr.com/800/800/${p.name.split(/\s+/).pop().toLowerCase().replace(/[^a-z0-9]/g, "")}?lock=${crypto.randomInt(100, 999)}`,
        p.is_featured, p.is_active);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.put("/api/admin/products/:id", requireAdmin, (req, res) => {
  try {
    const p = readProductBody(req.body);
    db.prepare(
      `UPDATE products SET category_id=?, name=?, description=?, price=?, discount_price=?, stock_quantity=?,
         image_url=COALESCE(?, image_url), is_featured=?, is_active=? WHERE id=?`
    ).run(p.category_id, p.name, p.description, p.price, p.discount_price, p.stock_quantity, p.image_url, p.is_featured, p.is_active, req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Soft delete: products that appear in old orders must stay in the database.
app.delete("/api/admin/products/:id", requireAdmin, (req, res) => {
  db.prepare("UPDATE products SET is_active = 0 WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

app.get("/api/admin/orders", requireAdmin, (_req, res) => {
  res.json(db.prepare("SELECT * FROM orders ORDER BY id DESC").all().map(loadOrder));
});

// Allowed status changes. Anything else is rejected, so an order cannot jump around.
const TRANSITIONS = {
  Pending: ["Paid", "Shipped", "Cancelled"],
  Paid: ["Shipped", "Cancelled"],
  Shipped: ["Delivered"],
  Delivered: [],
  Cancelled: [],
};

app.put("/api/admin/orders/:number/status", requireAdmin, (req, res) => {
  const { status } = req.body;
  const row = db.prepare("SELECT * FROM orders WHERE order_number = ?").get(req.params.number);
  if (!row) return res.status(404).json({ error: "Order not found." });
  if (!ORDER_STATUSES.includes(status) || !TRANSITIONS[row.order_status].includes(status)) {
    return res.status(400).json({ error: `Cannot move an order from ${row.order_status} to ${status}.` });
  }
  if (status === "Cancelled") {
    cancelOrder(row);
  } else {
    // Cash on delivery counts as paid once the parcel is delivered.
    const paymentStatus = status === "Delivered" || status === "Paid" ? "Paid" : row.payment_status;
    db.prepare("UPDATE orders SET order_status = ?, payment_status = ? WHERE id = ?").run(status, paymentStatus, row.id);
    if (paymentStatus === "Paid") db.prepare("UPDATE payments SET status = 'success' WHERE order_id = ?").run(row.id);
  }
  res.json(loadOrder(db.prepare("SELECT * FROM orders WHERE id = ?").get(row.id)));
});

/* --------------------------------- Startup --------------------------------- */

app.use("/api", (_req, res) => res.status(404).json({ error: "Not found." }));

// In production the built React app is served by this same server.
const path = require("path");
const fs = require("fs");
const dist = path.join(__dirname, "..", "client", "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  // Any other page URL returns the React app so client-side routing works on refresh.
  app.use((_req, res) => res.sendFile(path.join(dist, "index.html")));
}

// Auto-seed the first time so the store is never empty.
if (db.prepare("SELECT COUNT(*) n FROM products").get().n === 0) require("./seed");

app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
