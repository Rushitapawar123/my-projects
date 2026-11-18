import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { api, money } from "../api";
import { useApp } from "../context/AppContext";
import OrderView from "../components/OrderView";

const badge = {
  Pending: "bg-amber-100 text-amber-700",
  Paid: "bg-sky-100 text-sky-700",
  Shipped: "bg-indigo-100 text-indigo-700",
  Delivered: "bg-emerald-100 text-emerald-700",
  Cancelled: "bg-rose-100 text-rose-600",
};
export const StatusBadge = ({ status }) => (
  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge[status]}`}>{status}</span>
);

// Order history for the logged-in customer.
export function OrderHistory() {
  const { user, authReady } = useApp();
  const [orders, setOrders] = useState(null);

  useEffect(() => {
    if (user) api("/orders").then(setOrders);
  }, [user]);

  if (!authReady) return null;
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="font-semibold">Please log in to see your orders.</p>
        <Link to="/login" className="btn btn-primary mt-4">Log in</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold">My orders</h1>
      {!orders ? (
        <div className="card mt-6 h-40 animate-pulse bg-stone-100" />
      ) : orders.length === 0 ? (
        <div className="card mt-6 p-12 text-center">
          <p className="text-4xl">📦</p>
          <p className="mt-2 font-semibold">No orders yet</p>
          <Link to="/products" className="btn btn-primary mt-4">Start shopping</Link>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {orders.map((o) => (
            <Link key={o.id} to={`/order/${o.order_number}`} className="card fade-up flex flex-wrap items-center justify-between gap-3 p-5 transition hover:border-brand-500 hover:shadow-md">
              <div>
                <p className="font-semibold">{o.order_number}</p>
                <p className="text-xs text-stone-400">
                  {new Date(o.placed_at + "Z").toLocaleDateString("en-IN")} · {o.items.length} item{o.items.length > 1 ? "s" : ""}
                </p>
                <p className="mt-1 text-sm text-stone-500">{o.items.map((i) => i.product_name).join(", ").slice(0, 70)}</p>
              </div>
              <div className="text-right">
                <p className="font-bold">{money(o.total_amount)}</p>
                <StatusBadge status={o.order_status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// A single order. Right after checkout the order arrives through router state,
// which also lets guests see it without an account.
export function OrderDetail() {
  const { number } = useParams();
  const { state } = useLocation();
  const { authReady } = useApp();
  const [order, setOrder] = useState(state?.order || null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (state?.order || !authReady) return;
    api(`/orders/${number}`).then(setOrder).catch((e) => setError(e.message));
  }, [number, authReady, state]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {state?.justPlaced && (
        <div className="fade-up mb-6 rounded-2xl bg-emerald-50 p-6 text-center">
          <p className="text-4xl">🎉</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-emerald-700">Thank you, your order is confirmed!</h1>
          <p className="text-sm text-emerald-700/80">A confirmation has been recorded for {state.order.email}. Keep your order number to track it.</p>
        </div>
      )}
      {error ? (
        <div className="card p-12 text-center">
          <p className="font-semibold">{error}</p>
          <Link to="/orders" className="btn btn-outline mt-4">Back to my orders</Link>
        </div>
      ) : order ? (
        <OrderView order={order} guestEmail={state?.guestEmail} />
      ) : (
        <div className="card h-64 animate-pulse bg-stone-100" />
      )}
    </div>
  );
}

// Guests can track an order with its number and email.
export function Track() {
  const [form, setForm] = useState({ number: "", email: "" });
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setOrder(null);
    try {
      setOrder(await api(`/orders/track?number=${encodeURIComponent(form.number)}&email=${encodeURIComponent(form.email)}`));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">Track your order</h1>
      <form onSubmit={submit} className="card mt-6 grid gap-3 p-5 md:grid-cols-[1fr_1fr_auto]">
        <input className="input" required placeholder="Order number (e.g. SV-20260101-1234)" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
        <input className="input" required type="email" placeholder="Email used at checkout" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <button className="btn btn-primary">Track</button>
      </form>
      {error && <p className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>}
      {order && <div className="mt-6"><OrderView key={order.order_number} order={order} guestEmail={form.email} /></div>}
    </div>
  );
}
