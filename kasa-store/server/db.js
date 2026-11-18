// Uses the SQLite that is built into Node.js (22.13+), so nothing native needs to be compiled.
let DatabaseSync;
try {
  ({ DatabaseSync } = require("node:sqlite"));
} catch {
  console.error("This project needs Node.js 22.13 or newer. Your version is " + process.version + ".");
  process.exit(1);
}
const path = require("path");

const db = new DatabaseSync(path.join(__dirname, "store.db"));
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

// Small replacement for better-sqlite3's db.transaction(): runs fn inside BEGIN/COMMIT
// and rolls everything back if fn throws.
db.transaction = (fn) => (...args) => {
  db.exec("BEGIN");
  try {
    const result = fn(...args);
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
};

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'customer',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  specs TEXT NOT NULL DEFAULT '[]',
  price REAL NOT NULL,
  discount_price REAL,
  sku TEXT,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  is_featured INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cart_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  UNIQUE (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL UNIQUE,
  user_id INTEGER REFERENCES users(id),
  email TEXT NOT NULL,
  ship_name TEXT NOT NULL,
  ship_phone TEXT NOT NULL,
  ship_address TEXT NOT NULL,
  ship_city TEXT NOT NULL,
  ship_state TEXT NOT NULL,
  ship_pincode TEXT NOT NULL,
  delivery_option TEXT NOT NULL DEFAULT 'standard',
  subtotal REAL NOT NULL,
  shipping_fee REAL NOT NULL,
  tax REAL NOT NULL,
  total_amount REAL NOT NULL,
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  order_status TEXT NOT NULL,
  placed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Product name and price are copied here so old orders never change
-- when a product is edited later.
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  image_url TEXT,
  unit_price REAL NOT NULL,
  quantity INTEGER NOT NULL,
  total_price REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  transaction_id TEXT,
  amount REAL NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (product_id, user_id)
);
`);

module.exports = db;
