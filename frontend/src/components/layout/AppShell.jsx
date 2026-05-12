import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

const customerLinks = [
  { to: "/products", label: "Products" },
  { to: "/cart", label: "Cart" },
  { to: "/orders", label: "Orders" }
];

const staffLinks = [
  { to: "/picker", label: "Picker" },
  { to: "/products", label: "Products" }
];

const adminLinks = [
  { to: "/admin", label: "Dashboard" },
  { to: "/picker", label: "Picker" }
];

export function AppShell() {
  const { user, logout } = useAuth();

  let links = customerLinks;

  if (user?.role === "ADMIN") {
    links = adminLinks;
  } else if (user?.role === "STAFF") {
    links = staffLinks;
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-600">
              D&apos;Cart
            </p>
            <h1 className="text-lg font-bold text-ink">Decolores Grocery Store</h1>
          </div>

          <nav className="flex flex-wrap items-center justify-end gap-2">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "bg-brand-600 text-white"
                      : "text-slate-600 hover:bg-brand-50 hover:text-brand-700"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-800">{user?.name}</p>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{user?.role}</p>
            </div>
            <button type="button" onClick={logout} className="btn-secondary px-3 py-2">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
