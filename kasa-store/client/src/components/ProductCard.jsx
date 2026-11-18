import { Link } from "react-router-dom";
import { money, fallbackImage } from "../api";
import { useApp } from "../context/AppContext";
import Stars from "./Stars";
import LikeButton from "./LikeButton";

export default function ProductCard({ product }) {
  const { addToCart } = useApp();
  const onSale = product.discount_price != null;
  const off = onSale ? Math.round((1 - product.discount_price / product.price) * 100) : 0;

  return (
    <div className="card group fade-up overflow-hidden transition hover:-translate-y-1 hover:shadow-xl hover:shadow-stone-200">
      <Link to={`/product/${product.slug}`} className="relative block aspect-square overflow-hidden bg-sand">
        <img
          src={product.image_url || fallbackImage}
          onError={(e) => (e.currentTarget.src = fallbackImage)}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        {onSale && (
          <span className="absolute left-3 top-3 rounded-full bg-rose-500 px-2.5 py-1 text-xs font-bold text-white">
            {off}% OFF
          </span>
        )}
        <LikeButton productId={product.id} className="absolute right-3 top-3 z-10" />
        {!product.in_stock && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm font-semibold">
            Out of stock
          </span>
        )}
      </Link>

      <div className="p-4">
        <p className="text-xs uppercase tracking-wide text-stone-400">{product.category_name}</p>
        <Link to={`/product/${product.slug}`} className="mt-0.5 block font-semibold leading-snug hover:text-brand-600">
          {product.name}
        </Link>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-stone-500">
          <Stars value={product.avg_rating || 0} size="text-sm" />
          <span>({product.review_count || 0})</span>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div>
            <span className="text-lg font-bold">{money(product.price_now)}</span>
            {onSale && <span className="ml-2 text-sm text-stone-400 line-through">{money(product.price)}</span>}
          </div>
          <button
            disabled={!product.in_stock}
            onClick={() => addToCart(product.id, 1, product.stock_quantity)}
            className="btn btn-primary !px-3 !py-2"
            aria-label={`Add ${product.name} to cart`}
          >
            + Add
          </button>
        </div>
      </div>
    </div>
  );
}
