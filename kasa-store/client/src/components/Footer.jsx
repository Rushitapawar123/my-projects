import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-stone-200 bg-sand">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 text-sm md:grid-cols-3">
        <div>
          <p className="font-display text-xl font-bold">Kasa<span className="text-brand-500">.</span></p>
          <p className="mt-2 max-w-xs text-stone-500">Thoughtfully chosen everyday essentials, delivered across India.</p>
        </div>
        <div className="space-y-2">
          <p className="font-semibold">Shop</p>
          <Link className="block text-stone-500 hover:text-brand-600" to="/products">All products</Link>
          <Link className="block text-stone-500 hover:text-brand-600" to="/products?featured=1">Featured</Link>
          <Link className="block text-stone-500 hover:text-brand-600" to="/track">Track an order</Link>
        </div>
        <div className="space-y-2">
          <p className="font-semibold">Help</p>
          <p className="text-stone-500">Free shipping above ₹999</p>
          <p className="text-stone-500">Cancel any order before it ships</p>
          <p className="text-stone-500">support@kasa.example</p>
        </div>
      </div>
      <p className="border-t border-stone-200 py-4 text-center text-xs text-stone-400">© {new Date().getFullYear()} Kasa. All rights reserved.</p>
    </footer>
  );
}
