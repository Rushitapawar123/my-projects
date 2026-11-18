// Small fetch wrapper: adds the login token and turns API errors into exceptions.
export async function api(path, { method = "GET", body } = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

export const money = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export const moneyExact = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(n);

// Soft placeholder shown when a product has no photo (or the photo file is missing).
export const fallbackImage =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#e0e7ff'/><stop offset='1' stop-color='#f6e9e3'/></linearGradient></defs><rect width='100%' height='100%' fill='url(#g)'/><text x='50%' y='54%' font-size='110' text-anchor='middle' dominant-baseline='middle'>🛍️</text></svg>`
  );
