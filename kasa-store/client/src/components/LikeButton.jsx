import { useApp } from "../context/AppContext";

// Round heart button used on product cards and the product page.
export default function LikeButton({ productId, className = "" }) {
  const { liked, toggleLike } = useApp();
  const isLiked = liked.includes(productId);

  return (
    <button
      type="button"
      aria-label={isLiked ? "Remove from wishlist" : "Add to wishlist"}
      aria-pressed={isLiked}
      onClick={(e) => {
        // The button sits inside a link on product cards, so stop the link from opening.
        e.preventDefault();
        e.stopPropagation();
        toggleLike(productId);
      }}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg shadow-md backdrop-blur transition hover:scale-110 active:scale-95 ${className}`}
    >
      <span className={isLiked ? "text-rose-500" : "text-stone-400"}>{isLiked ? "♥" : "♡"}</span>
    </button>
  );
}
