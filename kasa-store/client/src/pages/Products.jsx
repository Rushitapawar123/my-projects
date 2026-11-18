import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import ProductCard from "../components/ProductCard";

export default function Products() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState({ products: [], total: 0, pages: 1 });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [price, setPrice] = useState({ min: params.get("minPrice") || "", max: params.get("maxPrice") || "" });

  const search = params.get("search") || "";
  const category = params.get("category") || "";
  const sort = params.get("sort") || "";
  const page = parseInt(params.get("page")) || 1;
  const featured = params.get("featured") || "";
  const inStock = params.get("inStock") || "";
  const minPrice = params.get("minPrice") || "";
  const maxPrice = params.get("maxPrice") || "";

  useEffect(() => {
    api("/categories").then(setCategories);
  }, []);

  useEffect(() => {
    setLoading(true);
    const q = new URLSearchParams({ limit: 9, page });
    Object.entries({ search, category, sort, featured, inStock, minPrice, maxPrice }).forEach(([k, v]) => v && q.set(k, v));
    api(`/products?${q}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [search, category, sort, page, featured, inStock, minPrice, maxPrice]);

  // Update one filter in the URL and go back to page 1.
  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    next.delete("page");
    setParams(next);
  };

  const applyPrice = (e) => {
    e.preventDefault();
    const next = new URLSearchParams(params);
    price.min ? next.set("minPrice", price.min) : next.delete("minPrice");
    price.max ? next.set("maxPrice", price.max) : next.delete("maxPrice");
    next.delete("page");
    setParams(next);
  };

  const clearAll = () => {
    setPrice({ min: "", max: "" });
    setParams({});
  };

  const hasFilters = search || category || featured || inStock || minPrice || maxPrice;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">{search ? `Results for “${search}”` : "All products"}</h1>
          <p className="text-sm text-stone-500">{data.total} items</p>
        </div>
        <select className="input !w-auto" value={sort} onChange={(e) => setFilter("sort", e.target.value)} aria-label="Sort">
          <option value="">Sort: Featured</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="rating">Top rated</option>
          <option value="newest">Newest</option>
        </select>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[240px_1fr]">
        {/* Filters */}
        <aside className="card h-fit space-y-6 p-5">
          <div>
            <p className="mb-2 text-sm font-semibold">Category</p>
            <div className="space-y-1">
              {[{ slug: "", name: "All" }, ...categories].map((c) => (
                <button
                  key={c.slug}
                  onClick={() => setFilter("category", c.slug)}
                  className={`block w-full rounded-lg px-3 py-1.5 text-left text-sm transition ${
                    category === c.slug ? "bg-brand-50 font-semibold text-brand-700" : "hover:bg-stone-100"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={applyPrice}>
            <p className="mb-2 text-sm font-semibold">Price (₹)</p>
            <div className="flex items-center gap-2">
              <input className="input !px-2 !py-1.5" type="number" min="0" placeholder="Min" value={price.min} onChange={(e) => setPrice({ ...price, min: e.target.value })} />
              <span className="text-stone-400">–</span>
              <input className="input !px-2 !py-1.5" type="number" min="0" placeholder="Max" value={price.max} onChange={(e) => setPrice({ ...price, max: e.target.value })} />
            </div>
            <button className="btn btn-outline mt-2 w-full !py-1.5">Apply</button>
          </form>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={!!inStock} onChange={(e) => setFilter("inStock", e.target.checked ? "1" : "")} />
            In stock only
          </label>

          {hasFilters && (
            <button onClick={clearAll} className="text-sm font-medium text-rose-500 hover:underline">
              Clear all filters
            </button>
          )}
        </aside>

        {/* Grid */}
        <div>
          {loading ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card h-72 animate-pulse bg-stone-100" />
              ))}
            </div>
          ) : data.products.length === 0 ? (
            <div className="card p-12 text-center">
              <p className="text-4xl">🔍</p>
              <p className="mt-2 font-semibold">No products match your search</p>
              <button onClick={clearAll} className="btn btn-outline mt-4">Reset filters</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {data.products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}

          {data.pages > 1 && (
            <div className="mt-8 flex justify-center gap-2">
              {Array.from({ length: data.pages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.set("page", n);
                    setParams(next);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className={`h-10 w-10 rounded-lg text-sm font-semibold ${
                    n === page ? "bg-brand-500 text-white" : "border border-stone-200 bg-white hover:border-brand-500"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
