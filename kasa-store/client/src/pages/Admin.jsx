import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, money, fallbackImage } from "../api";
import { useApp } from "../context/AppContext";
import { StatusBadge } from "./Orders";

// Which status an admin can move an order to from each state.
const NEXT = { Pending: ["Paid", "Shipped", "Cancelled"], Paid: ["Shipped", "Cancelled"], Shipped: ["Delivered"], Delivered: [], Cancelled: [] };
const emptyProduct = { name: "", category_id: "", description: "", price: "", discount_price: "", stock_quantity: 10, image_url: "", is_featured: false, is_active: true };

export default function Admin() {
  const { user, authReady, notify } = useApp();
  const [tab, setTab] = useState("dashboard");
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);

  const loadAll = () => {
    api("/admin/stats").then(setStats);
    api("/admin/products").then(setProducts);
    api("/admin/orders").then(setOrders);
    api("/categories").then(setCategories);
  };

  useEffect(() => {
    if (user?.role === "admin") loadAll();
  }, [user]);

  if (!authReady) return null;
  if (user?.role !== "admin") {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="text-4xl">🔒</p>
        <p className="mt-2 font-semibold">This area is for store admins only.</p>
        <Link to="/login" className="btn btn-primary mt-4">Log in as admin</Link>
      </div>
    );
  }

  const saveProduct = async (e) => {
    e.preventDefault();
    try {
      if (editing.id) await api(`/admin/products/${editing.id}`, { method: "PUT", body: editing });
      else await api("/admin/products", { method: "POST", body: editing });
      notify("Product saved");
      setEditing(null);
      loadAll();
    } catch (err) {
      notify(err.message, "error");
    }
  };

  const removeProduct = async (p) => {
    if (!window.confirm(`Hide “${p.name}” from the store?`)) return;
    await api(`/admin/products/${p.id}`, { method: "DELETE" });
    notify("Product removed");
    loadAll();
  };

  const changeStatus = async (o, status) => {
    try {
      await api(`/admin/orders/${o.order_number}/status`, { method: "PUT", body: { status } });
      notify(`Order marked ${status}`);
      loadAll();
    } catch (err) {
      notify(err.message, "error");
    }
  };

  const tabs = [["dashboard", "Dashboard"], ["products", "Products"], ["orders", "Orders"]];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold">Admin panel</h1>
      <div className="mt-5 flex gap-2 border-b border-stone-200">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${tab === id ? "border-brand-500 text-brand-600" : "border-transparent text-stone-500"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && stats && (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[["Revenue", money(stats.revenue), "💰"], ["Orders", stats.orders, "📦"], ["Customers", stats.customers, "👥"], ["Low stock items", stats.lowStock, "⚠️"]].map(([label, value, icon]) => (
              <div key={label} className="card p-5">
                <p className="text-2xl">{icon}</p>
                <p className="mt-2 text-2xl font-bold">{value}</p>
                <p className="text-sm text-stone-500">{label}</p>
              </div>
            ))}
          </div>
          <div className="card p-5">
            <h2 className="mb-3 font-semibold">Orders by status</h2>
            <div className="flex flex-wrap gap-3">
              {stats.byStatus.length === 0 && <p className="text-sm text-stone-400">No orders yet.</p>}
              {stats.byStatus.map((s) => (
                <div key={s.status} className="flex items-center gap-2 rounded-xl bg-stone-50 px-4 py-2">
                  <StatusBadge status={s.status} /> <span className="font-bold">{s.n}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "products" && (
        <div className="mt-6">
          <button className="btn btn-primary mb-4" onClick={() => setEditing({ ...emptyProduct, category_id: categories[0]?.id })}>+ Add product</button>
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 text-xs uppercase text-stone-500">
                <tr><th className="p-3">Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th /></tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {products.map((p) => (
                  <tr key={p.id} className={p.is_active ? "" : "opacity-50"}>
                    <td className="flex items-center gap-3 p-3">
                      <img src={p.image_url || fallbackImage} onError={(e) => (e.currentTarget.src = fallbackImage)} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      <span className="font-medium">{p.name}</span>
                    </td>
                    <td>{p.category_name}</td>
                    <td>{money(p.price_now)}</td>
                    <td className={p.stock_quantity <= 5 ? "font-bold text-rose-500" : ""}>{p.stock_quantity}</td>
                    <td>{p.is_active ? "Live" : "Hidden"}</td>
                    <td className="space-x-3 pr-3 text-right">
                      <button className="font-semibold text-brand-600" onClick={() => setEditing(p)}>Edit</button>
                      {p.is_active === 1 && <button className="font-semibold text-rose-500" onClick={() => removeProduct(p)}>Remove</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "orders" && (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr><th className="p-3">Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Update</th></tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="p-3 font-medium">{o.order_number}<p className="text-xs font-normal text-stone-400">{new Date(o.placed_at + "Z").toLocaleDateString("en-IN")}</p></td>
                  <td>{o.ship_name}<p className="text-xs text-stone-400">{o.email}</p></td>
                  <td>{o.items.reduce((n, i) => n + i.quantity, 0)}</td>
                  <td className="font-semibold">{money(o.total_amount)}</td>
                  <td><StatusBadge status={o.order_status} /></td>
                  <td>
                    {NEXT[o.order_status].length === 0 ? (
                      <span className="text-xs text-stone-400">Closed</span>
                    ) : (
                      <select className="input !w-auto !py-1.5 text-sm" value="" onChange={(e) => e.target.value && changeStatus(o, e.target.value)}>
                        <option value="">Change…</option>
                        {NEXT[o.order_status].map((s) => <option key={s}>{s}</option>)}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && <p className="p-8 text-center text-stone-400">No orders yet.</p>}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <form onSubmit={saveProduct} onClick={(e) => e.stopPropagation()} className="card max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto p-6">
            <h2 className="text-lg font-bold">{editing.id ? "Edit product" : "Add product"}</h2>
            <input className="input" required placeholder="Product name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            <select className="input" required value={editing.category_id} onChange={(e) => setEditing({ ...editing, category_id: e.target.value })}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <textarea className="input" rows={3} placeholder="Description" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            <div className="grid grid-cols-3 gap-3">
              <input className="input" required type="number" min="1" placeholder="Price" value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} />
              <input className="input" type="number" min="1" placeholder="Sale price" value={editing.discount_price ?? ""} onChange={(e) => setEditing({ ...editing, discount_price: e.target.value })} />
              <input className="input" required type="number" min="0" placeholder="Stock" value={editing.stock_quantity} onChange={(e) => setEditing({ ...editing, stock_quantity: e.target.value })} />
            </div>
            <input className="input" placeholder="Image URL (optional)" value={editing.image_url || ""} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} />
            <div className="flex gap-5 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={!!editing.is_featured} onChange={(e) => setEditing({ ...editing, is_featured: e.target.checked })} /> Featured</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={!!editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /> Visible in store</label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
