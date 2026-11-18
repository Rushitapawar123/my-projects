"""Fills the database with demo products, accounts and a few reviews.
Runs automatically on the first start; run `python seed.py` to add missing demo data again."""
import json
import re

from werkzeug.security import generate_password_hash

from db import db, init_db, one, run, transaction


# Search word for each demo product, used to fetch a matching photo online (no account or key needed).
PHOTO_WORDS = {
    "aero-wireless-headphones": "headphones", "pulse-smart-watch": "smartwatch", "cube-portable-speaker": "speaker",
    "volt-20000-mah-power-bank": "powerbank", "lumen-mechanical-keyboard": "keyboard", "classic-denim-jacket": "denim,jacket",
    "everyday-cotton-t-shirt": "tshirt", "urban-running-sneakers": "sneakers", "linen-summer-shirt": "shirt",
    "ceramic-coffee-mug-set": "mug", "warm-glow-table-lamp": "lamp", "cozy-knit-throw-blanket": "blanket",
    "bamboo-desk-organizer": "desk", "leather-bifold-wallet": "wallet", "aviator-sunglasses": "sunglasses",
    "canvas-backpack": "backpack",
}


def img(slug, n):
    """Online photo that matches the product. `lock` keeps the same photo every time."""
    return f"https://loremflickr.com/800/800/{PHOTO_WORDS.get(slug, slug.split('-')[-1])}?lock={n}"


def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


CATEGORIES = [
    ("Electronics", "electronics"),
    ("Fashion", "fashion"),
    ("Home & Living", "home-living"),
    ("Accessories", "accessories"),
]

# category, name, price, sale price, stock, featured, description, specs
PRODUCTS = [
    ("electronics", "Aero Wireless Headphones", 4999, 3499, 25, 1, "Over-ear Bluetooth headphones with active noise cancellation and 40 hours of battery life.", [("Battery", "40 hours"), ("Connectivity", "Bluetooth 5.3"), ("Weight", "250 g")]),
    ("electronics", "Pulse Smart Watch", 6999, 4999, 18, 1, "Fitness tracker with heart-rate monitor, GPS and a bright AMOLED display.", [("Display", "1.4 inch AMOLED"), ("Water resistance", "5 ATM"), ("Battery", "7 days")]),
    ("electronics", "Cube Portable Speaker", 2999, None, 40, 0, "Pocket-sized speaker with deep bass and a splash-proof body.", [("Playtime", "12 hours"), ("Output", "20 W")]),
    ("electronics", "Volt 20000 mAh Power Bank", 1899, 1399, 60, 0, "Fast-charging power bank with two USB-C ports and a digital display.", [("Capacity", "20000 mAh"), ("Output", "45 W")]),
    ("electronics", "Lumen Mechanical Keyboard", 3499, 2799, 12, 1, "Compact hot-swappable keyboard with soft backlighting and tactile switches.", [("Layout", "75%"), ("Switches", "Tactile brown")]),
    ("fashion", "Classic Denim Jacket", 3299, 2499, 30, 1, "Mid-weight denim jacket with a relaxed fit that goes with everything.", [("Material", "100% cotton"), ("Fit", "Regular")]),
    ("fashion", "Everyday Cotton T-Shirt", 799, 599, 120, 0, "Soft, breathable crew-neck tee that holds its shape after many washes.", [("Material", "180 GSM cotton"), ("Fit", "Regular")]),
    ("fashion", "Urban Running Sneakers", 4499, 3299, 8, 1, "Lightweight sneakers with a cushioned sole for daily runs and walks.", [("Upper", "Breathable mesh"), ("Sole", "EVA foam")]),
    ("fashion", "Linen Summer Shirt", 1799, None, 22, 0, "Light linen shirt that stays cool even on the hottest days.", [("Material", "Linen blend"), ("Fit", "Relaxed")]),
    ("home-living", "Ceramic Coffee Mug Set", 1299, 999, 50, 0, "Set of four hand-glazed ceramic mugs, dishwasher and microwave safe.", [("Pieces", "4"), ("Capacity", "300 ml each")]),
    ("home-living", "Warm Glow Table Lamp", 2199, 1699, 15, 1, "Minimal table lamp with a dimmable warm light for reading and relaxing.", [("Bulb", "E27 warm white"), ("Height", "38 cm")]),
    ("home-living", "Cozy Knit Throw Blanket", 1899, 1499, 0, 0, "Chunky knit blanket that adds warmth and texture to any sofa.", [("Size", "130 x 170 cm"), ("Material", "Acrylic blend")]),
    ("home-living", "Bamboo Desk Organizer", 999, None, 35, 0, "Keeps pens, notes and gadgets tidy with five compartments.", [("Material", "Natural bamboo")]),
    ("accessories", "Leather Bifold Wallet", 1499, 1099, 45, 1, "Slim wallet with six card slots and a coin pocket, made from genuine leather.", [("Material", "Genuine leather"), ("Card slots", "6")]),
    ("accessories", "Aviator Sunglasses", 1999, 1399, 28, 0, "Polarised aviator sunglasses with UV400 protection.", [("Lens", "Polarised"), ("Frame", "Metal")]),
    ("accessories", "Canvas Backpack", 2499, 1899, 20, 0, "Roomy everyday backpack with a padded laptop sleeve and water-resistant canvas.", [("Capacity", "24 L"), ("Laptop", "Up to 15.6 inch")]),
]

# Sample reviewers so product pages do not look empty on day one.
REVIEWERS = [("Aarav Sharma", "aarav@example.com"), ("Priya Patel", "priya@example.com"), ("Rohan Mehta", "rohan@example.com")]

# product name -> [(reviewer index, rating, comment)]
REVIEWS = {
    "Aero Wireless Headphones": [(0, 5, "Noise cancellation is excellent and the battery really lasts all week."), (1, 4, "Very comfortable, sound is balanced. Case could be sturdier.")],
    "Pulse Smart Watch": [(2, 5, "Accurate heart rate and the screen is bright even in the sun."), (0, 4, "Great value. Strap feels premium.")],
    "Lumen Mechanical Keyboard": [(1, 5, "Typing feels great and the backlight is subtle. Love it.")],
    "Classic Denim Jacket": [(2, 5, "Perfect fit and the fabric is thick without being heavy."), (1, 4, "Looks great. Order one size up if you like it loose.")],
    "Urban Running Sneakers": [(0, 4, "Light and comfortable for long walks.")],
    "Warm Glow Table Lamp": [(1, 5, "Cozy light, exactly what my reading corner needed.")],
    "Leather Bifold Wallet": [(2, 5, "Slim, well stitched and smells like real leather."), (0, 5, "Fits all my cards without bulging.")],
    "Everyday Cotton T-Shirt": [(1, 4, "Soft cotton, does not shrink after washing.")],
    "Ceramic Coffee Mug Set": [(2, 5, "Beautiful glaze, my morning coffee tastes better.")],
}


def seed():
    init_db()
    with transaction():
        for name, slug in CATEGORIES:
            run("INSERT OR IGNORE INTO categories (name, slug) VALUES (?, ?)", (name, slug))

        for i, (cat, name, price, sale, stock, featured, desc, specs) in enumerate(PRODUCTS):
            category_id = one("SELECT id FROM categories WHERE slug = ?", (cat,))["id"]
            slug = slugify(name)
            run(
                """INSERT OR IGNORE INTO products
                   (category_id, name, slug, description, specs, price, discount_price, sku, stock_quantity, image_url, is_featured)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (category_id, name, slug, desc, json.dumps([{"label": k, "value": v} for k, v in specs]),
                 price, sale, f"SKU-{1000 + i}", stock, img(slug, i + 1), featured),
            )

        run("INSERT OR IGNORE INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
            ("Store Admin", "admin@shop.com", generate_password_hash("admin123"), "admin"))
        run("INSERT OR IGNORE INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
            ("Demo Customer", "demo@shop.com", generate_password_hash("demo123"), "customer"))
        for name, email in REVIEWERS:
            run("INSERT OR IGNORE INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'customer')",
                (name, email, generate_password_hash("reviewer-not-for-login")))

        for product_name, items in REVIEWS.items():
            product = one("SELECT id FROM products WHERE name = ?", (product_name,))
            for reviewer, rating, comment in items:
                user = one("SELECT id FROM users WHERE email = ?", (REVIEWERS[reviewer][1],))
                run("INSERT OR IGNORE INTO reviews (product_id, user_id, rating, comment) VALUES (?, ?, ?, ?)",
                    (product["id"], user["id"], rating, comment))

    count = one("SELECT COUNT(*) AS n FROM products")["n"]
    print(f"Seed complete: {count} products, demo logins ready.")


if __name__ == "__main__":
    seed()
