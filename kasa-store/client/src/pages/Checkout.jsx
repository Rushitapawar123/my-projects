import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, money, moneyExact } from "../api";
import { useApp } from "../context/AppContext";

const STATES = ["Andhra Pradesh","Assam","Bihar","Chhattisgarh","Delhi","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Odisha","Punjab","Rajasthan","Tamil Nadu","Telangana","Uttar Pradesh","Uttarakhand","West Bengal"];

export default function Checkout() {
  const { cart, user, clearCart, notify } = useApp();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: user?.name || "", email: user?.email || "", phone: user?.phone || "",
    address: "", city: "", state: "Madhya Pradesh", pincode: "",
  });
  const [delivery, setDelivery] = useState("standard");
  const [payment, setPayment] = useState("cod");
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [placing, setPlacing] = useState(false);

  // Fill in the account details once the session has loaded.
  useEffect(() => {
    if (user) setForm((f) => ({ ...f, name: f.name || user.name, email: user.email, phone: f.phone || user.phone || "" }));
  }, [user]);

  // Totals come from the server and update when the delivery option changes.
  useEffect(() => {
    if (cart.length === 0) return;
    setError("");
    api("/cart/price", { method: "POST", body: { items: cart, deliveryOption: delivery } })
      .then(setSummary)
      .catch((e) => {
        setSummary(null);
        setError(e.message);
      });
  }, [cart, delivery]);

  if (cart.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <p className="text-5xl">🧺</p>
        <p className="mt-3 font-semibold">There is nothing to check out yet.</p>
        <Link to="/products" className="btn btn-primary mt-5">Browse products</Link>
      </div>
    );
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const placeOrder = async (e) => {
    e.preventDefault();
    setPlacing(true);
    setError("");
    try {
      const order = await api("/orders", {
        method: "POST",
        body: { items: cart, deliveryOption: delivery, paymentMethod: payment, shipping: form },
      });
      clearCart();
      navigate(`/order/${order.order_number}`, { state: { order, guestEmail: form.email, justPlaced: true } });
    } catch (err) {
      setError(err.message);
      notify(err.message, "error");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <form onSubmit={placeOrder} className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold">Checkout</h1>
      {!user && (
        <p className="mt-2 text-sm text-stone-500">
          Checking out as a guest. <Link to="/login" className="font-semibold text-brand-600 hover:underline">Log in</Link> to save your order history.
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="card space-y-4 p-6">
            <h2 className="font-semibold">1. Delivery address</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <input className="input" required placeholder="Full name" value={form.name} onChange={set("name")} />
              <input className="input" required type="tel" placeholder="Phone number" value={form.phone} onChange={set("phone")} />
              <input className="input md:col-span-2" required type="email" placeholder="Email (for order updates)" value={form.email} onChange={set("email")} disabled={!!user} />
              <input className="input md:col-span-2" required placeholder="House no., street, area" value={form.address} onChange={set("address")} />
              <input className="input" required placeholder="City" value={form.city} onChange={set("city")} />
              <select className="input" value={form.state} onChange={set("state")}>
                {STATES.map((s) => <option key={s}>{s}</option>)}
              </select>
              <input className="input" required inputMode="numeric" pattern="\d{6}" maxLength={6} placeholder="6-digit pincode" value={form.pincode} onChange={set("pincode")} />
            </div>
          </section>

          <section className="card space-y-3 p-6">
            <h2 className="font-semibold">2. Delivery option</h2>
            {[
              ["standard", "Standard delivery", "3–5 business days", "₹49, free above ₹999"],
              ["express", "Express delivery", "1–2 business days", "₹149"],
            ].map(([id, title, time, price]) => (
              <Choice key={id} checked={delivery === id} onChange={() => setDelivery(id)} title={title} subtitle={time} right={price} />
            ))}
          </section>

          <section className="card space-y-3 p-6">
            <h2 className="font-semibold">3. Payment method</h2>
            {[
              ["cod", "Cash on delivery", "Pay when your order arrives"],
              ["upi", "UPI", "Instant, secure payment"],
              ["card", "Credit / debit card", "Visa, Mastercard, RuPay"],
            ].map(([id, title, sub]) => (
              <Choice key={id} checked={payment === id} onChange={() => setPayment(id)} title={title} subtitle={sub} />
            ))}
            {payment !== "cod" && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Demo mode: online payments are simulated, no real money is charged and no card details are collected.
              </p>
            )}
          </section>
        </div>

        <aside className="card h-fit space-y-3 p-5 lg:sticky lg:top-24">
          <h2 className="font-semibold">Order summary</h2>
          {summary ? (
            <>
              <ul className="max-h-52 space-y-2 overflow-y-auto text-sm">
                {summary.lines.map((l) => (
                  <li key={l.productId} className="flex justify-between gap-3">
                    <span className="text-stone-600">{l.name} × {l.quantity}</span>
                    <span className="font-medium">{money(l.total_price)}</span>
                  </li>
                ))}
              </ul>
              <div className="space-y-1.5 border-t border-stone-100 pt-3 text-sm text-stone-600">
                <div className="flex justify-between"><span>Subtotal</span><span>{moneyExact(summary.subtotal)}</span></div>
                <div className="flex justify-between"><span>Shipping</span><span>{summary.shipping_fee === 0 ? "Free" : moneyExact(summary.shipping_fee)}</span></div>
                <div className="flex justify-between"><span>GST (18%)</span><span>{moneyExact(summary.tax)}</span></div>
              </div>
              <div className="flex justify-between border-t border-stone-100 pt-3 text-lg font-bold">
                <span>Total</span><span>{moneyExact(summary.total_amount)}</span>
              </div>
            </>
          ) : (
            !error && <p className="text-sm text-stone-400">Calculating…</p>
          )}
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}
          <button disabled={placing || !summary} className="btn btn-primary w-full !py-3">
            {placing ? "Placing order…" : "Place order"}
          </button>
          <Link to="/cart" className="block text-center text-sm text-stone-500 hover:text-brand-600">← Back to cart</Link>
        </aside>
      </div>
    </form>
  );
}

function Choice({ checked, onChange, title, subtitle, right }) {
  return (
    <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${checked ? "border-brand-500 bg-brand-50" : "border-stone-200 hover:border-stone-300"}`}>
      <input type="radio" checked={checked} onChange={onChange} className="accent-[#5b5bd6]" />
      <div className="flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-xs text-stone-500">{subtitle}</p>
      </div>
      {right && <span className="text-sm font-semibold">{right}</span>}
    </label>
  );
}
