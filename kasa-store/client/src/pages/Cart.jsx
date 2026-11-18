import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, money, moneyExact, fallbackImage } from "../api";
import { useApp } from "../context/AppContext";

export default function Cart() {
  const { cart, setQuantity, removeFromCart } = useApp();
  const [data, setData] = useState(null);

  // The server prices the cart, so the numbers on screen are always the real ones.
  useEffect(() => {
    api("/cart/price", { method: "POST", body: { items: cart, lenient: true } })
      .then(setData)
      .catch(() => setData({ lines: [], subtotal: 0, shipping_fee: 0, tax: 0, total_amount: 0 }));
  }, [cart]);

  if (!data) return <div className="mx-auto max-w-5xl animate-pulse px-4 py-10"><div className="card h-64 bg-stone-100" /></div>;

  if (data.lines.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <p className="text-6xl">🛒</p>
        <h1 className="mt-4 font-display text-2xl font-bold">Your cart is empty</h1>
        <p className="mt-1 text-stone-500">Add something you like and it will show up here.</p>
        <Link to="/products" className="btn btn-primary mt-6">Start shopping</Link>
      </div>
    );
  }

  const hasStockIssue = data.lines.some((l) => l.quantity > l.stock);
  const toFree = Math.max(999 - data.subtotal, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold">Shopping cart</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          {data.lines.map((l) => (
            <div key={l.productId} className="card fade-up flex items-center gap-4 p-4">
              <Link to={`/product/${l.slug}`}>
                <img src={l.image_url || fallbackImage} onError={(e) => (e.currentTarget.src = fallbackImage)} alt="" className="h-20 w-20 rounded-xl object-cover" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link to={`/product/${l.slug}`} className="font-semibold hover:text-brand-600">{l.name}</Link>
                <p className="text-sm text-stone-500">{money(l.unit_price)} each</p>
                {l.quantity > l.stock && (
                  <p className="text-xs font-semibold text-rose-500">
                    {l.stock === 0 ? "Out of stock, please remove" : `Only ${l.stock} available, reduce the quantity`}
                  </p>
                )}
                <button onClick={() => removeFromCart(l.productId)} className="mt-1 text-xs text-stone-400 hover:text-rose-500">Remove</button>
              </div>
              <div className="flex items-center rounded-lg border border-stone-300">
                <button className="h-9 w-9" onClick={() => setQuantity(l.productId, l.quantity - 1)}>−</button>
                <span className="w-8 text-center text-sm font-semibold">{l.quantity}</span>
                <button className="h-9 w-9 disabled:opacity-40" disabled={l.quantity >= l.stock} onClick={() => setQuantity(l.productId, l.quantity + 1)}>+</button>
              </div>
              <p className="w-24 text-right font-bold">{money(l.total_price)}</p>
            </div>
          ))}
        </div>

        <aside className="card h-fit space-y-3 p-5">
          <h2 className="font-semibold">Order summary</h2>
          <div className="flex justify-between text-sm text-stone-600"><span>Subtotal</span><span>{moneyExact(data.subtotal)}</span></div>
          <div className="flex justify-between text-sm text-stone-600"><span>GST (18%)</span><span>{moneyExact(data.tax)}</span></div>
          <div className="flex justify-between text-sm text-stone-600">
            <span>Shipping</span><span>{data.shipping_fee === 0 ? "Free" : moneyExact(data.shipping_fee)}</span>
          </div>
          {toFree > 0 && (
            <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">Add {money(toFree)} more for free shipping.</p>
          )}
          <div className="flex justify-between border-t border-stone-100 pt-3 text-lg font-bold">
            <span>Total</span><span>{moneyExact(data.total_amount)}</span>
          </div>
          {hasStockIssue ? (
            <button disabled className="btn btn-primary w-full">Fix stock issues to continue</button>
          ) : (
            <Link to="/checkout" className="btn btn-primary w-full !py-3">Proceed to checkout</Link>
          )}
          <Link to="/products" className="block text-center text-sm text-stone-500 hover:text-brand-600">Continue shopping</Link>
        </aside>
      </div>
    </div>
  );
}
