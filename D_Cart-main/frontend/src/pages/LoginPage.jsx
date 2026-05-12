import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../api/authApi";
import { useAuth } from "../hooks/useAuth";

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await authApi.login(form);
      login(response);
      const dest = response.user.role === "ADMIN" ? "/admin" : response.user.role === "STAFF" ? "/picker" : "/products";
      navigate(dest);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="panel hidden overflow-hidden lg:block">
          <div className="flex h-full flex-col justify-between bg-mesh-soft px-10 py-12">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">
                Decolores Grocery
              </p>
              <h1 className="mt-4 max-w-lg text-4xl font-extrabold leading-tight text-ink">
                Groceries for today&apos;s table, delivered the same day.
              </h1>
            </div>
            <p className="max-w-md text-sm leading-7 text-slate-600">
              D&apos;Cart keeps ordering simple for customers and operationally clear for the
              Decolores team handling stock, fulfillment, and same-day delivery.
            </p>
          </div>
        </section>

        <section className="panel px-6 py-8 sm:px-8">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-600">
              Welcome back
            </p>
            <h2 className="mt-2 text-3xl font-bold text-ink">Sign in to D&apos;Cart</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              name="email"
              type="email"
              placeholder="Email address"
              value={form.email}
              onChange={handleChange}
              className="field"
              required
            />
            <input
              name="password"
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              className="field"
              required
            />
            {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
            <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
              {isSubmitting ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-4 text-sm text-slate-500">
            <Link to="/forgot-password" className="font-semibold text-brand-700">
              Forgot your password?
            </Link>
          </p>

          <p className="mt-6 text-sm text-slate-500">
            New customer?{" "}
            <Link to="/register" className="font-semibold text-brand-700">
              Create an account
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
