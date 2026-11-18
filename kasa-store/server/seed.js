// Fills the database with a demo catalogue and two demo accounts.
// Run with: npm run seed
const bcrypt = require("bcryptjs");
const db = require("./db");

// Search word for each demo product, used to fetch a matching photo online (no account or key needed).
const PHOTO_WORDS = {
  "aero-wireless-headphones": "headphones", "pulse-smart-watch": "smartwatch", "cube-portable-speaker": "speaker",
  "volt-20000-mah-power-bank": "powerbank", "lumen-mechanical-keyboard": "keyboard", "classic-denim-jacket": "denim,jacket",
  "everyday-cotton-t-shirt": "tshirt", "urban-running-sneakers": "sneakers", "linen-summer-shirt": "shirt",
  "ceramic-coffee-mug-set": "mug", "warm-glow-table-lamp": "lamp", "cozy-knit-throw-blanket": "blanket",
  "bamboo-desk-organizer": "desk", "leather-bifold-wallet": "wallet", "aviator-sunglasses": "sunglasses",
  "canvas-backpack": "backpack",
};
// Online photo that matches the product. `lock` keeps the same photo every time.
const img = (slug, n) => `https://loremflickr.com/800/800/${PHOTO_WORDS[slug] || slug.split("-").pop()}?lock=${n}`;

const categories = [
  ["Electronics", "electronics"],
  ["Fashion", "fashion"],
  ["Home & Living", "home-living"],
  ["Accessories", "accessories"],
];

const products = [
  ["electronics", "Aero Wireless Headphones", 4999, 3499, 25, 1, "Over-ear Bluetooth headphones with active noise cancellation and 40 hours of battery life.", [["Battery", "40 hours"], ["Connectivity", "Bluetooth 5.3"], ["Weight", "250 g"]]],
  ["electronics", "Pulse Smart Watch", 6999, 4999, 18, 1, "Fitness tracker with heart-rate monitor, GPS and a bright AMOLED display.", [["Display", "1.4 inch AMOLED"], ["Water resistance", "5 ATM"], ["Battery", "7 days"]]],
  ["electronics", "Cube Portable Speaker", 2999, null, 40, 0, "Pocket-sized speaker with deep bass and a splash-proof body.", [["Playtime", "12 hours"], ["Output", "20 W"]]],
  ["electronics", "Volt 20000 mAh Power Bank", 1899, 1399, 60, 0, "Fast-charging power bank with two USB-C ports and a digital display.", [["Capacity", "20000 mAh"], ["Output", "45 W"]]],
  ["electronics", "Lumen Mechanical Keyboard", 3499, 2799, 12, 1, "Compact hot-swappable keyboard with soft backlighting and tactile switches.", [["Layout", "75%"], ["Switches", "Tactile brown"]]],
  ["fashion", "Classic Denim Jacket", 3299, 2499, 30, 1, "Mid-weight denim jacket with a relaxed fit that goes with everything.", [["Material", "100% cotton"], ["Fit", "Regular"]]],
  ["fashion", "Everyday Cotton T-Shirt", 799, 599, 120, 0, "Soft, breathable crew-neck tee that holds its shape after many washes.", [["Material", "180 GSM cotton"], ["Fit", "Regular"]]],
  ["fashion", "Urban Running Sneakers", 4499, 3299, 8, 1, "Lightweight sneakers with a cushioned sole for daily runs and walks.", [["Upper", "Breathable mesh"], ["Sole", "EVA foam"]]],
  ["fashion", "Linen Summer Shirt", 1799, null, 22, 0, "Light linen shirt that stays cool even on the hottest days.", [["Material", "Linen blend"], ["Fit", "Relaxed"]]],
  ["home-living", "Ceramic Coffee Mug Set", 1299, 999, 50, 0, "Set of four hand-glazed ceramic mugs, dishwasher and microwave safe.", [["Pieces", "4"], ["Capacity", "300 ml each"]]],
  ["home-living", "Warm Glow Table Lamp", 2199, 1699, 15, 1, "Minimal table lamp with a dimmable warm light for reading and relaxing.", [["Bulb", "E27 warm white"], ["Height", "38 cm"]]],
  ["home-living", "Cozy Knit Throw Blanket", 1899, 1499, 0, 0, "Chunky knit blanket that adds warmth and texture to any sofa.", [["Size", "130 x 170 cm"], ["Material", "Acrylic blend"]]],
  ["home-living", "Bamboo Desk Organizer", 999, null, 35, 0, "Keeps pens, notes and gadgets tidy with five compartments.", [["Material", "Natural bamboo"]]],
  ["accessories", "Leather Bifold Wallet", 1499, 1099, 45, 1, "Slim wallet with six card slots and a coin pocket, made from genuine leather.", [["Material", "Genuine leather"], ["Card slots", "6"]]],
  ["accessories", "Aviator Sunglasses", 1999, 1399, 28, 0, "Polarised aviator sunglasses with UV400 protection.", [["Lens", "Polarised"], ["Frame", "Metal"]]],
  ["accessories", "Canvas Backpack", 2499, 1899, 20, 0, "Roomy everyday backpack with a padded laptop sleeve and water-resistant canvas.", [["Capacity", "24 L"], ["Laptop", "Up to 15.6 inch"]]],
];

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const run = db.transaction(() => {
  const insertCat = db.prepare("INSERT OR IGNORE INTO categories (name, slug) VALUES (?, ?)");
  categories.forEach((c) => insertCat.run(...c));

  const catId = (slug) => db.prepare("SELECT id FROM categories WHERE slug = ?").get(slug).id;
  const insertProduct = db.prepare(`
    INSERT OR IGNORE INTO products
      (category_id, name, slug, description, specs, price, discount_price, sku, stock_quantity, image_url, is_featured)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  products.forEach(([cat, name, price, discount, stock, featured, description, specs], i) => {
    const slug = slugify(name);
    insertProduct.run(
      catId(cat), name, slug, description, JSON.stringify(specs.map(([k, v]) => ({ label: k, value: v }))),
      price, discount, `SKU-${1000 + i}`, stock, img(slug, i + 1), featured
    );
  });

  const insertUser = db.prepare(
    "INSERT OR IGNORE INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)"
  );
  insertUser.run("Store Admin", "admin@shop.com", bcrypt.hashSync("admin123", 10), "admin");
  insertUser.run("Demo Customer", "demo@shop.com", bcrypt.hashSync("demo123", 10), "customer");
});

run();
console.log("Seed complete: %d products, demo logins ready.", db.prepare("SELECT COUNT(*) c FROM products").get().c);
