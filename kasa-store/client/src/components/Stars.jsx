// Read-only star rating (supports halves visually by rounding to the nearest star).
export default function Stars({ value = 0, size = "text-base" }) {
  const full = Math.round(value);
  return (
    <span className={`${size} tracking-tight`} aria-label={`${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= full ? "text-amber-400" : "text-stone-300"}>
          ★
        </span>
      ))}
    </span>
  );
}
