import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { api } from "../api";

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

// Cart items are stored as [{ productId, quantity }].
// Guests keep them in localStorage; logged-in users are also synced to the server.
function readLocalCart() {
  try {
    return JSON.parse(localStorage.getItem("cart")) || [];
  } catch {
    return [];
  }
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [cart, setCart] = useState(readLocalCart);
  const [liked, setLiked] = useState([]);
  const [toast, setToast] = useState(null);
  const syncTimer = useRef(null);
  const cartLoaded = useRef(false);

  const notify = useCallback((message, type = "ok") => {
    setToast({ message, type, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Restore the session on page load.
  useEffect(() => {
    if (!localStorage.getItem("token")) {
      setAuthReady(true);
      return;
    }
    api("/auth/me")
      .then(async (d) => {
        setUser(d.user);
        await mergeServerCart();
      })
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setAuthReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the liked products of the logged-in user.
  useEffect(() => {
    if (!user) {
      setLiked([]);
      return;
    }
    api("/wishlist/ids").then(setLiked).catch(() => {});
  }, [user]);

  // Save the cart locally on every change, and to the server (debounced) when logged in.
  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
    if (!user || !cartLoaded.current) return;
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      api("/cart", { method: "PUT", body: { items: cart } }).catch(() => {});
    }, 600);
  }, [cart, user]);

  // After login, combine the guest cart with the cart saved on the server.
  async function mergeServerCart() {
    try {
      const serverItems = await api("/cart");
      setCart((local) => {
        const map = new Map();
        [...serverItems, ...local].forEach((it) => {
          map.set(it.productId, Math.max(map.get(it.productId) || 0, it.quantity));
        });
        return [...map].map(([productId, quantity]) => ({ productId, quantity }));
      });
    } catch {
      /* ignore */
    }
    cartLoaded.current = true;
  }

  async function authenticate(path, body) {
    const data = await api(path, { method: "POST", body });
    localStorage.setItem("token", data.token);
    setUser(data.user);
    await mergeServerCart();
    return data.user;
  }

  const login = (email, password) => authenticate("/auth/login", { email, password });
  const register = (name, email, password) => authenticate("/auth/register", { name, email, password });

  function logout() {
    localStorage.removeItem("token");
    cartLoaded.current = false;
    setUser(null);
    setCart([]);
    notify("You have been logged out");
  }

  // Heart button: like or unlike a product (needs a login).
  async function toggleLike(productId) {
    if (!user) {
      notify("Please log in to like products", "error");
      return false;
    }
    try {
      const { liked: nowLiked } = await api(`/wishlist/${productId}`, { method: "POST" });
      setLiked((prev) => (nowLiked ? [...prev, productId] : prev.filter((id) => id !== productId)));
      notify(nowLiked ? "Saved to your wishlist" : "Removed from wishlist");
      return nowLiked;
    } catch (e) {
      notify(e.message, "error");
      return false;
    }
  }

  function addToCart(productId, quantity = 1, stock = 99) {
    const current = cart.find((i) => i.productId === productId)?.quantity || 0;
    if (current + quantity > stock) {
      notify("No more stock available for this item", "error");
      return;
    }
    setCart((prev) =>
      prev.some((i) => i.productId === productId)
        ? prev.map((i) => (i.productId === productId ? { ...i, quantity: i.quantity + quantity } : i))
        : [...prev, { productId, quantity }]
    );
    notify("Added to cart");
  }

  const setQuantity = (productId, quantity) =>
    setCart((prev) =>
      quantity < 1
        ? prev.filter((i) => i.productId !== productId)
        : prev.map((i) => (i.productId === productId ? { ...i, quantity } : i))
    );

  const removeFromCart = (productId) => setCart((prev) => prev.filter((i) => i.productId !== productId));
  const clearCart = () => setCart([]);
  const cartCount = cart.reduce((n, i) => n + i.quantity, 0);

  return (
    <AppContext.Provider
      value={{
        user, authReady, login, register, logout, liked, toggleLike,
        cart, cartCount, addToCart, setQuantity, removeFromCart, clearCart,
        toast, notify,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
