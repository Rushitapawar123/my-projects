import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

// One component for both the login and the register screens.
export default function Auth({ mode }) {
  const isLogin = mode === "login";
  const { login, register, notify } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = isLogin ? await login(form.email, form.password) : await register(form.name, form.email, form.password);
      notify(`Welcome, ${user.name.split(" ")[0]}!`);
      navigate(location.state?.from || (user.role === "admin" ? "/admin" : "/"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-10">
      <form onSubmit={submit} className="card fade-up w-full space-y-4 p-8 shadow-xl shadow-stone-200">
        <div>
          <h1 className="font-display text-3xl font-bold">{isLogin ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-1 text-sm text-stone-500">{isLogin ? "Log in to see your cart and orders." : "It takes less than a minute."}</p>
        </div>

        {!isLogin && (
          <input className="input" required placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        )}
        <input className="input" required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="input" required type="password" minLength={6} placeholder="Password (min 6 characters)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />

        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}

        <button disabled={loading} className="btn btn-primary w-full !py-3">
          {loading ? "Please wait…" : isLogin ? "Log in" : "Sign up"}
        </button>

        <p className="text-center text-sm text-stone-500">
          {isLogin ? "New here? " : "Already have an account? "}
          <Link to={isLogin ? "/register" : "/login"} state={location.state} className="font-semibold text-brand-600 hover:underline">
            {isLogin ? "Create an account" : "Log in"}
          </Link>
        </p>
        {isLogin && (
          <p className="rounded-lg bg-stone-50 px-3 py-2 text-center text-xs text-stone-500">
            Demo logins: demo@shop.com / demo123 · admin@shop.com / admin123
          </p>
        )}
      </form>
    </div>
  );
}
