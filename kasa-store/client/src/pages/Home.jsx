import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import ProductCard from "../components/ProductCard";

const categoryIcons = { electronics: "🎧", fashion: "👕", "home-living": "🛋️", accessories: "👜" };

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [latest, setLatest] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api("/products?featured=1&limit=8").then((d) => setFeatured(d.products));
    api("/products?sort=rating&limit=4").then((d) => setTopRated(d.products));
    api("/products?limit=8").then((d) => setLatest(d.products));
    api("/categories").then(setCategories);
  }, []);

  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pt-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-100 via-[#f6e9e3] to-[#e7f3ec] px-6 py-14 md:px-14 md:py-20">
          <div className="max-w-xl fade-up">
            <p className="mb-3 inline-block rounded-full bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-700">
              New season · Free shipping over ₹999
            </p>
            <h1 className="font-display text-4xl font-bold leading-tight md:text-6xl">
              Everyday things, <br />
              <span className="text-brand-500">chosen with care.</span>
            </h1>
            <p className="mt-4 text-lg text-stone-600">
              Gadgets, clothing and home pieces that look good, last long and arrive fast.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/products" className="btn btn-primary !px-6 !py-3">Shop now</Link>
              <Link to="/products?featured=1" className="btn btn-outline !px-6 !py-3">See featured</Link>
            </div>
          </div>
          <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-white/40 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 right-24 h-60 w-60 rounded-full bg-brand-500/10 blur-2xl" />
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto mt-12 max-w-7xl px-4">
        <h2 className="font-display text-2xl font-bold">Shop by category</h2>
        <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
          {categories.map((c) => (
            <Link
              key={c.id}
              to={`/products?category=${c.slug}`}
              className="card group flex flex-col items-center gap-2 p-6 text-center transition hover:-translate-y-1 hover:border-brand-500 hover:shadow-lg"
            >
              <span className="text-4xl transition group-hover:scale-110">{categoryIcons[c.slug] || "🛍️"}</span>
              <span className="font-semibold">{c.name}</span>
              <span className="text-xs text-stone-400">{c.product_count} items</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="mx-auto mt-14 max-w-7xl px-4">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl font-bold">Featured picks</h2>
          <Link to="/products" className="text-sm font-semibold text-brand-600 hover:underline">View all →</Link>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* Top rated by customers */}
      {topRated.length > 0 && (
        <section className="mx-auto mt-14 max-w-7xl px-4">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-2xl font-bold">Loved by customers ★</h2>
            <Link to="/products?sort=rating" className="text-sm font-semibold text-brand-600 hover:underline">See top rated →</Link>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
            {topRated.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Everything in the shop */}
      {latest.length > 0 && (
        <section className="mx-auto mt-14 max-w-7xl px-4">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-2xl font-bold">Shop everything</h2>
            <Link to="/products" className="text-sm font-semibold text-brand-600 hover:underline">Browse all →</Link>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {latest.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Promises */}
      <section className="mx-auto mt-16 grid max-w-7xl gap-4 px-4 md:grid-cols-3">
        {[
          ["🚚", "Fast delivery", "Standard in 3–5 days, express in 1–2."],
          ["↩️", "Easy cancellation", "Cancel any order until it ships."],
          ["🔒", "Secure checkout", "Your details stay safe with us."],
        ].map(([icon, title, text]) => (
          <div key={title} className="card flex items-start gap-4 p-5">
            <span className="text-3xl">{icon}</span>
            <div>
              <p className="font-semibold">{title}</p>
              <p className="text-sm text-stone-500">{text}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
