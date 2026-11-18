import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { api, money, fallbackImage } from "../api";

// Small preview of the cart that opens from the cart icon.
function MiniCart({ onClose }) {
  const { cart } = useApp();
  const [data, setData] = useState(null);

  useEffect(() => {
    api("/cart/price", { method: "POST", body: { items: cart, lenient: true } })
      .then(setData)
      .catch(() => setData({ lines: [], subtotal: 0 }));
  }, [cart]);

  return (
    <div className="card absolute right-0 top-12 z-50 w-80 p-4 shadow-2xl">
      {!data ? (
        <p className="py-6 text-center text-sm text-stone-400">Loading…</p>
      ) : data.lines.length === 0 ? (
        <p className="py-6 text-center text-sm text-stone-500">Your cart is empty.</p>
      ) : (
        <>
          <ul className="max-h-64 space-y-3 overflow-y-auto">
            {data.lines.map((l) => (
              <li key={l.productId} className="flex items-center gap-3">
                <img
                  src={l.image_url || fallbackImage}
                  onError={(e) => (e.currentTarget.src = fallbackImage)}
                  alt=""
                  className="h-12 w-12 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{l.name}</p>
                  <p className="text-xs text-stone-500">
                    {l.quantity} × {money(l.unit_price)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between border-t border-stone-100 pt-3 text-sm font-semibold">
            <span>Subtotal</span>
            <span>{money(data.subtotal)}</span>
          </div>
          <Link to="/cart" onClick={onClose} className="btn btn-primary mt-3 w-full">
            View cart
          </Link>
        </>
      )}
    </div>
  );
}

export default function Navbar() {
  const { user, logout, cartCount, liked } = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const cartRef = useRef(null);

  // Close the mini-cart when clicking anywhere outside it.
  useEffect(() => {
    const close = (e) => cartRef.current && !cartRef.current.contains(e.target) && setCartOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const submitSearch = (e) => {
    e.preventDefault();
    navigate(`/products?search=${encodeURIComponent(query.trim())}`);
    setMenuOpen(false);
  };

  const link = ({ isActive }) => `text-sm font-medium transition hover:text-brand-600 ${isActive ? "text-brand-600" : ""}`;

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/70 bg-paper/90 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link to="/" className="font-display text-2xl font-bold tracking-tight">
          Kasa<span className="text-brand-500">.</span>
        </Link>

        <nav className="ml-4 hidden items-center gap-6 md:flex">
          <NavLink to="/products" className={link}>Shop</NavLink>
          <NavLink to="/track" className={link}>Track order</NavLink>
          {user?.role === "admin" && <NavLink to="/admin" className={link}>Admin</NavLink>}
        </nav>

        <form onSubmit={submitSearch} className="ml-auto hidden max-w-sm flex-1 md:block">
          <input
            className="input !rounded-full !py-2"
            placeholder="Search products…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </form>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Link to="/wishlist" className="btn btn-outline relative !px-3" aria-label="Wishlist">
            <span className="text-rose-500">♥</span>
            {liked.length > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white">
                {liked.length}
              </span>
            )}
          </Link>
          <div ref={cartRef} className="relative">
            <button onClick={() => setCartOpen((o) => !o)} className="btn btn-outline relative !px-3" aria-label="Open cart">
              🛒
              {cartCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1 text-[11px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </button>
            {cartOpen && <MiniCart onClose={() => setCartOpen(false)} />}
          </div>

          {user ? (
            <div className="hidden items-center gap-2 md:flex">
              <Link to="/orders" className="btn btn-outline">Hi, {user.name.split(" ")[0]}</Link>
              <button onClick={logout} className="text-sm text-stone-500 hover:text-rose-500">Logout</button>
            </div>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link to="/login" className="btn btn-outline">Log in</Link>
              <Link to="/register" className="btn btn-primary">Sign up</Link>
            </div>
          )}

          <button className="btn btn-outline !px-3 md:hidden" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu">
            ☰
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="space-y-3 border-t border-stone-200 bg-paper px-4 py-4 md:hidden">
          <form onSubmit={submitSearch}>
            <input className="input" placeholder="Search products…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </form>
          <div className="flex flex-col gap-3" onClick={() => setMenuOpen(false)}>
            <Link to="/products">Shop</Link>
            <Link to="/track">Track order</Link>
            {user ? (
              <>
                <Link to="/orders">My orders</Link>
                <Link to="/wishlist">Wishlist</Link>
                {user.role === "admin" && <Link to="/admin">Admin</Link>}
                <button className="text-left text-rose-500" onClick={logout}>Logout</button>
              </>
            ) : (
              <>
                <Link to="/login">Log in</Link>
                <Link to="/register">Sign up</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
