import { Routes, Route, Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import Wishlist from "./pages/Wishlist";
import { OrderHistory, OrderDetail, Track } from "./pages/Orders";
import { useApp } from "./context/AppContext";

// Scroll to the top whenever the page changes.
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 }); // braces matter: an effect must not return the scroll result
  }, [pathname]);
  return null;
}

function Toast() {
  const { toast } = useApp();
  if (!toast) return null;
  return (
    <div
      key={toast.id}
      className={`fade-up no-print fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-xl ${
        toast.type === "error" ? "bg-rose-500" : "bg-ink"
      }`}
    >
      {toast.message}
    </div>
  );
}

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <div className="no-print"><Navbar /></div>
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/product/:slug" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/login" element={<Auth mode="login" />} />
          <Route path="/register" element={<Auth mode="register" />} />
          <Route path="/orders" element={<OrderHistory />} />
          <Route path="/order/:number" element={<OrderDetail />} />
          <Route path="/track" element={<Track />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/admin" element={<Admin />} />
          <Route
            path="*"
            element={
              <div className="py-32 text-center">
                <p className="font-display text-6xl font-bold">404</p>
                <p className="mt-2 text-stone-500">This page does not exist.</p>
                <Link to="/" className="btn btn-primary mt-5">Go home</Link>
              </div>
            }
          />
        </Routes>
      </main>
      <div className="no-print"><Footer /></div>
      <Toast />
    </div>
  );
}
