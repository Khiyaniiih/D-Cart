import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../api/authApi";
import { useAuth } from "../hooks/useAuth";

export function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: ""
  });
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
      const response = await authApi.register(form);
      login(response);
      navigate("/products");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to create account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="panel px-6 py-8 sm:px-8">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-600">
              New customer
            </p>
            <h2 className="mt-2 text-3xl font-bold text-ink">Create your account</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              name="name"
              type="text"
              placeholder="Full name"
              value={form.name}
              onChange={handleChange}
              className="field"
              required
            />
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
              minLength={8}
            />
            {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
            <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
              {isSubmitting ? "Creating account..." : "Register"}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-500">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-brand-700">
              Sign in
            </Link>
          </p>
        </section>

        <section className="panel hidden overflow-hidden lg:block">
          <div className="flex h-full flex-col justify-between bg-mesh-soft px-10 py-12">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">
                Service area
              </p>
              <h1 className="mt-4 text-4xl font-extrabold leading-tight text-ink">
                Fresh groceries delivered same-day to your doorstep.
              </h1>
            </div>
            <p className="max-w-md text-sm leading-7 text-slate-600">
              The checkout flow enforces delivery coverage so customers only place orders that
              the store can fulfill on schedule.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
