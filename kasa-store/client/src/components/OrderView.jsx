import { useState } from "react";
import { api, money, moneyExact, fallbackImage } from "../api";
import { useApp } from "../context/AppContext";

const STEPS = ["Pending", "Paid", "Shipped", "Delivered"];

// Horizontal tracker: Pending → Paid → Shipped → Delivered.
export function StatusTracker({ status }) {
  if (status === "Cancelled") {
    return <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">This order was cancelled.</p>;
  }
  const current = STEPS.indexOf(status);
  return (
    <ol className="flex items-center">
      {STEPS.map((s, i) => (
        <li key={s} className="flex flex-1 items-center last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                i <= current ? "bg-brand-500 text-white" : "bg-stone-200 text-stone-500"
              }`}
            >
              {i < current ? "✓" : i + 1}
            </span>
            <span className={`text-xs ${i <= current ? "font-semibold" : "text-stone-400"}`}>{s}</span>
          </div>
          {i < STEPS.length - 1 && <div className={`mx-2 mb-5 h-0.5 flex-1 ${i < current ? "bg-brand-500" : "bg-stone-200"}`} />}
        </li>
      ))}
    </ol>
  );
}

// Full order page: tracker, items, address, totals, invoice print and cancel.
export default function OrderView({ order: initial, guestEmail }) {
  const { notify } = useApp();
  const [order, setOrder] = useState(initial);
  const [busy, setBusy] = useState(false);
  const canCancel = ["Pending", "Paid"].includes(order.order_status);

  const cancel = async () => {
    if (!window.confirm("Cancel this order?")) return;
    setBusy(true);
    try {
      const updated = await api(`/orders/${order.order_number}/cancel`, { method: "POST", body: { email: guestEmail } });
      setOrder(updated);
      notify("Order cancelled");
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="text-sm text-stone-500">Order number</p>
          <p className="font-display text-xl font-bold">{order.order_number}</p>
          <p className="text-xs text-stone-400">Placed on {new Date(order.placed_at + "Z").toLocaleString("en-IN")}</p>
        </div>
        <div className="no-print flex gap-2">
          <button onClick={() => window.print()} className="btn btn-outline">🧾 Invoice</button>
          {canCancel && (
            <button onClick={cancel} disabled={busy} className="btn btn-outline !text-rose-500">Cancel order</button>
          )}
        </div>
      </div>

      <div className="card p-6">
        <StatusTracker status={order.order_status} />
      </div>

      <div className="grid gap-5 md:grid-cols-[1fr_320px]">
        <div className="card divide-y divide-stone-100">
          {order.items.map((i) => (
            <div key={i.id} className="flex items-center gap-4 p-4">
              <img src={i.image_url || fallbackImage} onError={(e) => (e.currentTarget.src = fallbackImage)} alt="" className="h-16 w-16 rounded-lg object-cover" />
              <div className="flex-1">
                <p className="font-medium">{i.product_name}</p>
                <p className="text-sm text-stone-500">{i.quantity} × {money(i.unit_price)}</p>
              </div>
              <p className="font-semibold">{money(i.total_price)}</p>
            </div>
          ))}
        </div>

        <div className="space-y-5">
          <div className="card space-y-2 p-5 text-sm">
            <h3 className="font-semibold">Payment summary</h3>
            <Row label="Subtotal" value={moneyExact(order.subtotal)} />
            <Row label="Shipping" value={order.shipping_fee === 0 ? "Free" : moneyExact(order.shipping_fee)} />
            <Row label="GST (18%)" value={moneyExact(order.tax)} />
            <div className="border-t border-stone-100 pt-2">
              <Row label="Total" value={moneyExact(order.total_amount)} bold />
            </div>
            <p className="pt-1 text-xs text-stone-500">
              {order.payment_method === "cod" ? "Cash on delivery" : order.payment_method.toUpperCase()} · {order.payment_status}
              {order.payment?.transaction_id && ` · ${order.payment.transaction_id}`}
            </p>
          </div>

          <div className="card space-y-1 p-5 text-sm">
            <h3 className="mb-1 font-semibold">Delivering to</h3>
            <p className="font-medium">{order.ship_name}</p>
            <p className="text-stone-600">{order.ship_address}</p>
            <p className="text-stone-600">{order.ship_city}, {order.ship_state} {order.ship_pincode}</p>
            <p className="text-stone-600">📞 {order.ship_phone}</p>
            <p className="text-xs capitalize text-stone-400">{order.delivery_option} delivery</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className={`flex justify-between ${bold ? "text-base font-bold" : "text-stone-600"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
