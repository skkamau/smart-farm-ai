import { BarChart3, Beef, HeartPulse, LogOut, Menu, Settings, Sprout, Wheat } from "lucide-react";
import { useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import BrandLogo from "./BrandLogo";

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
  { to: "/production", label: "Produce", icon: Wheat, match: (path) => path.startsWith("/production") },
  {
    to: "/more",
    label: "More",
    icon: Menu,
    match: (path) => ["/more", "/assistant", "/alerts", "/scan", "/weather", "/finance", "/inventory", "/settings", "/feedback"].some((item) => path.startsWith(item))
  }
];

export default function Layout() {
  const { logout, user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const feature = featureForPath(location.pathname);
    if (!feature) return;
    const key = `smartFarmUsage:${new Date().toISOString().slice(0, 10)}:${feature}`;
    if (sessionStorage.getItem(key)) return;
    api.post("/usage", { feature }).then(() => sessionStorage.setItem(key, "1")).catch(() => {});
  }, [location.pathname]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-farm-100 bg-white/90 backdrop-blur dark:border-farm-800 dark:bg-farm-950/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link to="/" aria-label="Smart Farm AI dashboard"><BrandLogo size="small" /></Link>
          <div className="flex items-center gap-2">
            <Link to="/settings" className="btn-muted px-2" aria-label="Profile and settings" title="Profile and settings">
              <Settings className="h-5 w-5" />
              <span className="hidden max-w-36 truncate sm:inline">{user?.farmName || "Settings"}</span>
            </Link>
            <button className="btn-muted px-2 text-red-700" onClick={logout} aria-label="Logout" title="Logout">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 pb-28 lg:px-8 lg:py-8 lg:pb-32">
        <Outlet />
      </main>

      <nav className="fixed inset-x-2 bottom-3 z-20 mx-auto grid max-w-3xl grid-cols-6 rounded-2xl border border-farm-100 bg-white/95 p-1 shadow-lift backdrop-blur dark:border-farm-800 dark:bg-farm-950/95">
        {bottomNav.map((item) => {
          const active = item.match(location.pathname);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-bold transition sm:text-xs ${active ? "bg-field-sage text-farm-950 dark:bg-farm-800 dark:text-white" : "text-slate-500 hover:bg-field-mist hover:text-farm-950 dark:text-slate-300 dark:hover:bg-farm-900 dark:hover:text-white"}`}
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

function featureForPath(path) {
  if (path === "/") return "dashboard";
  const matches = [
    ["/animals", "animals"], ["/health", "health"], ["/vaccinations", "vaccinations"],
    ["/breeding", "breeding"], ["/births", "births"], ["/crops", "crops"],
    ["/finance", "finance"], ["/inventory", "inventory"], ["/reports", "reports"], ["/assistant", "assistant"],
    ["/alerts", "alerts"], ["/scan", "scanner"], ["/weather", "weather"],
    ["/settings", "settings"], ["/feedback", "feedback"], ["/production", "production"]
  ];
  return matches.find(([prefix]) => path.startsWith(prefix))?.[1] || null;
}
