# Kasa – Simple E-commerce Store

A full-stack online store: browse products, view details, add to cart, check out
(as a guest or a registered user), track orders, and manage the shop from an admin panel.

**Stack:** React + Tailwind CSS (Vite) · Node.js + Express · SQLite (built into Node) · JWT login

## Features

| Area | What works |
| --- | --- |
| Products | Listing, categories, search, price filter, in-stock filter, sorting, pagination |
| Product page | Image, price and discount, stock status, specifications, reviews and ratings, related products |
| Cart | Add, remove, change quantity, mini-cart preview, saved after refresh, synced to your account after login |
| Checkout | Address form, delivery option, GST and shipping, payment method, guest checkout |
| Orders | Order number, history, status tracker (Pending → Paid → Shipped → Delivered), printable invoice, cancel before shipping, guest tracking |
| Users | Register, login, logout, hashed passwords (bcrypt) |
| Admin | Dashboard, add/edit/hide products, stock, order status updates |

## Run it

The project has two interchangeable backends. Use ONE of them.

**Option A - Python backend (recommended)**
```bash
cd client
npm install
npm run build          # builds the website into client/dist

cd ../backend
pip install flask
python app.py          # http://localhost:5000
```

**Option B - Node backend** (needs Node 22.13 or newer)
```bash
cd client && npm install && npm run build
cd ../server && npm install && npm start     # http://localhost:5000
```

For development with live reload, start a backend (port 5000) and run `npm run dev` inside
`client` (http://localhost:5173).

## Product photos

Photos load **automatically** from the internet: each product gets a matching photo found with its
keyword (for example "headphones"). Products you add in the Admin panel without a photo get one
from the last word of their name. If a photo cannot load, a soft placeholder is shown instead.

Prefer your own photos? Put them in `client/public/images/` (see the README.txt there), then paste
`/images/<file>.jpg` into Admin > Edit product, or paste any image link there.

If you ran the shop before, delete the old `store.db` file so the products are created again.

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Customer | demo@shop.com | demo123 |
| Admin | admin@shop.com | admin123 |

## Database tables

`users`, `categories`, `products`, `cart_items`, `orders`, `order_items`, `payments`, `reviews`
(see `server/db.js`). `order_items` stores a copy of the product name and price, so old orders
never change when a product is edited later.

## Security notes

- Passwords are hashed with bcrypt; the login token is a signed JWT (7 days).
- Prices, GST, shipping and totals are always calculated on the server.
- Stock is re-checked inside a database transaction when an order is placed.
- Customers can only open their own orders; admin routes check the role.
- Set a real secret before deploying: `JWT_SECRET=your-long-random-string npm start`.

## Payments

Card and UPI are **simulated** (no real money, no card data collected). To accept real payments,
create a Razorpay or Stripe order in `POST /api/orders` and mark the order paid from the
gateway's webhook.

## API overview

```
POST /api/auth/register | /api/auth/login        GET /api/auth/me
GET  /api/products?search=&category=&minPrice=&maxPrice=&sort=&page=
GET  /api/products/:slug        POST /api/products/:id/reviews
GET  /api/categories
POST /api/cart/price            GET/PUT /api/cart
POST /api/orders                GET /api/orders        GET /api/orders/:number
GET  /api/orders/track?number=&email=                  POST /api/orders/:number/cancel
/api/admin/*  (stats, products, orders, order status)
```
