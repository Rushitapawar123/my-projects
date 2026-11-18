import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useApp } from "../context/AppContext";
import ProductCard from "../components/ProductCard";

// All products the customer has liked.
export default function Wishlist() {
  const { user, authReady, liked } = useApp();
  const [items, setItems] = useState(null);

  // Reload when a product is unliked, so it disappears from this page.
  useEffect(() => {
    if (user) api("/wishlist").then(setItems);
  }, [user, liked.length]);

  if (!authReady) return null;
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="text-5xl">♡</p>
        <p className="mt-3 font-semibold">Log in to see the products you liked.</p>
        <Link to="/login" state={{ from: "/wishlist" }} className="btn btn-primary mt-4">Log in</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold">My wishlist</h1>
      {!items ? (
        <div className="card mt-6 h-48 animate-pulse bg-stone-100" />
      ) : items.length === 0 ? (
        <div className="card mt-6 p-12 text-center">
          <p className="text-5xl text-rose-400">♡</p>
          <p className="mt-2 font-semibold">Nothing liked yet</p>
          <p className="text-sm text-stone-500">Tap the heart on any product to save it here.</p>
          <Link to="/products" className="btn btn-primary mt-4">Browse products</Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
