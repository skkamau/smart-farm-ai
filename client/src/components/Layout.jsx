import { BarChart3, Beef, HeartPulse, Leaf, LogOut, Menu, Sprout } from "lucide-react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const bottomNav = [
  { to: "/", label: "Dashboard", icon: BarChart3, match: (path) => path === "/" },
  {
    to: "/animals",
    label: "Animals",
    icon: Beef,
    match: (path) => path.startsWith("/animals") || ["/vaccinations", "/breeding", "/births", "/reports"].some((item) => path.startsWith(item))
  },
  { to: "/health", label: "Health", icon: HeartPulse, match: (path) => path.startsWith("/health") },
  { to: "/crops", label: "Crops", icon: Sprout, match: (path) => path.startsWith("/crops") },
  {
    to: "/more",
    label: "More",
    icon: Menu,
    match: (path) => ["/more", "/assistant", "/alerts", "/scan", "/weather", "/finance"].some((item) => path.startsWith(item))
  }
];

export default function Layout() {
  const { logout } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-farm-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-black text-farm-950">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-farm-800 text-white">
              <Leaf className="h-4 w-4" />
            </span>
            SmartFarm AI
          </Link>
          <button className="btn-muted px-2 text-red-700" onClick={logout} aria-label="Logout" title="Logout">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 pb-28 lg:px-8 lg:py-8 lg:pb-32">
        <Outlet />
      </main>

      <nav className="fixed inset-x-3 bottom-3 z-20 mx-auto grid max-w-2xl grid-cols-5 rounded-2xl border border-farm-100 bg-white/95 p-1 shadow-lift backdrop-blur">
        {bottomNav.map((item) => {
          const active = item.match(location.pathname);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-bold transition sm:text-xs ${active ? "bg-field-sage text-farm-950" : "text-slate-500 hover:bg-field-mist hover:text-farm-950"}`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
