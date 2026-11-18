"""Database connection, helpers and table definitions (SQLite, Python standard library)."""
import os
import sqlite3
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "store.db")


def connect():
    # isolation_level=None -> autocommit mode, so we control transactions ourselves.
    # check_same_thread=False: Flask handles requests in different threads. app.py makes sure
    # only one request uses the connection at a time.
    conn = sqlite3.connect(DB_PATH, isolation_level=None, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


db = connect()  # one shared connection; the app runs single-process


def query(sql, params=()):
    """Return all rows as a list of dicts."""
    return [dict(r) for r in db.execute(sql, params).fetchall()]


def one(sql, params=()):
    """Return the first row as a dict, or None."""
    row = db.execute(sql, params).fetchone()
    return dict(row) if row else None


def run(sql, params=()):
    """Run INSERT/UPDATE/DELETE and return the cursor (use .lastrowid)."""
    return db.execute(sql, params)


@contextmanager
def transaction():
    """BEGIN IMMEDIATE locks the database for writing, so two buyers can never
    take the last item at the same time. Everything is rolled back on error."""
    db.execute("BEGIN IMMEDIATE")
    try:
        yield
        db.execute("COMMIT")
    except BaseException:
        db.execute("ROLLBACK")
        raise


SCHEMA = """
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

-- Products a customer has liked (heart button).
CREATE TABLE IF NOT EXISTS wishlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
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
"""


def init_db():
    db.executescript(SCHEMA)
