import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, money, fallbackImage } from "../api";
import { useApp } from "../context/AppContext";
import Stars from "../components/Stars";
import ProductCard from "../components/ProductCard";
import LikeButton from "../components/LikeButton";

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addToCart, user, notify } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [qty, setQty] = useState(1);
  const [review, setReview] = useState({ rating: 5, comment: "" });

  const load = () =>
    api(`/products/${slug}`)
      .then((d) => {
        setData(d);
        setQty(1);
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    setData(null);
    setError("");
    load();
    window.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-5xl">😕</p>
        <p className="mt-3 text-lg font-semibold">{error}</p>
        <Link to="/products" className="btn btn-primary mt-5">Back to shop</Link>
      </div>
    );
  }
  if (!data) return <div className="mx-auto h-96 max-w-7xl animate-pulse px-4 py-10"><div className="card h-full bg-stone-100" /></div>;

  const { product: p, related, reviews } = data;
  const onSale = p.discount_price != null;

  const submitReview = async (e) => {
    e.preventDefault();
    try {
      await api(`/products/${p.id}/reviews`, { method: "POST", body: review });
      notify("Thanks for your review!");
      setReview({ rating: 5, comment: "" });
      load();
    } catch (err) {
      notify(err.message, "error");
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <p className="mb-5 text-sm text-stone-500">
        <Link to="/" className="hover:text-brand-600">Home</Link> /{" "}
        <Link to={`/products?category=${p.category_slug}`} className="hover:text-brand-600">{p.category_name}</Link> / {p.name}
      </p>

      <div className="grid gap-10 md:grid-cols-2">
        <div className="card overflow-hidden bg-sand">
          <img
            src={p.image_url || fallbackImage}
            onError={(e) => (e.currentTarget.src = fallbackImage)}
            alt={p.name}
            className="aspect-square w-full object-cover"
          />
        </div>

        <div className="fade-up">
          <p className="text-sm uppercase tracking-wide text-stone-400">{p.category_name}</p>
          <h1 className="mt-1 font-display text-3xl font-bold md:text-4xl">{p.name}</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-stone-500">
            <Stars value={p.avg_rating} />
            <span>{p.review_count ? `${p.avg_rating.toFixed(1)} · ${p.review_count} reviews` : "No reviews yet"}</span>
          </div>

          <div className="mt-5 flex items-baseline gap-3">
            <span className="text-3xl font-bold">{money(p.price_now)}</span>
            {onSale && (
              <>
                <span className="text-lg text-stone-400 line-through">{money(p.price)}</span>
                <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-600">
                  Save {money(p.price - p.discount_price)}
                </span>
              </>
            )}
          </div>
          <p className="mt-1 text-xs text-stone-400">Inclusive of offers. GST added at checkout.</p>

          <p className="mt-5 leading-relaxed text-stone-600">{p.description}</p>

          <p className={`mt-5 text-sm font-semibold ${p.in_stock ? (p.stock_quantity <= 5 ? "text-amber-600" : "text-emerald-600") : "text-rose-500"}`}>
            {!p.in_stock ? "Out of stock" : p.stock_quantity <= 5 ? `Hurry, only ${p.stock_quantity} left` : `In stock (${p.stock_quantity} available)`}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-xl border border-stone-300 bg-white">
              <button className="h-11 w-11 text-lg disabled:opacity-40" disabled={qty <= 1} onClick={() => setQty(qty - 1)}>−</button>
              <span className="w-10 text-center font-semibold">{qty}</span>
              <button className="h-11 w-11 text-lg disabled:opacity-40" disabled={qty >= p.stock_quantity} onClick={() => setQty(qty + 1)}>+</button>
            </div>
            <button disabled={!p.in_stock} className="btn btn-primary !py-3" onClick={() => addToCart(p.id, qty, p.stock_quantity)}>
              Add to cart
            </button>
            <button
              disabled={!p.in_stock}
              className="btn btn-outline !py-3"
              onClick={() => {
                addToCart(p.id, qty, p.stock_quantity);
                navigate("/checkout");
              }}
            >
              Buy now
            </button>
            <LikeButton productId={p.id} className="!h-12 !w-12 border border-stone-300 !text-2xl" />
          </div>

          {p.specs.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-2 font-semibold">Specifications</h2>
              <dl className="card divide-y divide-stone-100 text-sm">
                {p.specs.map((s) => (
                  <div key={s.label} className="flex justify-between px-4 py-2.5">
                    <dt className="text-stone-500">{s.label}</dt>
                    <dd className="font-medium">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>

      {/* Reviews */}
      <section className="mt-16 grid gap-8 md:grid-cols-[1fr_360px]">
        <div>
          <h2 className="font-display text-2xl font-bold">Customer reviews</h2>
          {reviews.length === 0 ? (
            <p className="mt-4 text-stone-500">Be the first to review this product.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {reviews.map((r) => (
                <li key={r.id} className="card p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{r.user_name}</span>
                    <Stars value={r.rating} size="text-sm" />
                  </div>
                  {r.comment && <p className="mt-1 text-sm text-stone-600">{r.comment}</p>}
                  <p className="mt-2 text-xs text-stone-400">{new Date(r.created_at + "Z").toLocaleDateString("en-IN")}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form onSubmit={submitReview} className="card h-fit space-y-3 p-5">
          <h3 className="font-semibold">Write a review</h3>
          {user ? (
            <>
              <select className="input" value={review.rating} onChange={(e) => setReview({ ...review, rating: e.target.value })}>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>{"★".repeat(n)} ({n})</option>
                ))}
              </select>
              <textarea className="input" rows={3} placeholder="Share your experience…" value={review.comment} onChange={(e) => setReview({ ...review, comment: e.target.value })} />
              <button className="btn btn-primary w-full">Submit review</button>
            </>
          ) : (
            <p className="text-sm text-stone-500">
              <Link to="/login" className="font-semibold text-brand-600 hover:underline">Log in</Link> to leave a review.
            </p>
          )}
        </form>
      </section>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="font-display text-2xl font-bold">You may also like</h2>
          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
            {related.map((r) => (
              <ProductCard key={r.id} product={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
