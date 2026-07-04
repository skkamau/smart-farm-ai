import { Baby, BarChart3, Beef, Bell, Bot, CloudSun, FileText, HeartHandshake, Leaf, LogOut, Menu, QrCode, ReceiptText, ShieldPlus, Sprout, Stethoscope, X } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const nav = [
  { to: "/", label: "Dashboard", icon: BarChart3 },
  { to: "/assistant", label: "Assistant", icon: Bot },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/animals", label: "Animals", icon: Beef },
  { to: "/scan", label: "Scan QR", icon: QrCode },
  { to: "/health", label: "Health", icon: Stethoscope },
  { to: "/vaccinations", label: "Vaccines", icon: ShieldPlus },
  { to: "/breeding", label: "Breeding", icon: HeartHandshake },
  { to: "/births", label: "Births", icon: Baby },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/crops", label: "Crops", icon: Sprout },
  { to: "/weather", label: "Weather", icon: CloudSun },
  { to: "/finance", label: "Finance", icon: ReceiptText }
];

const mobileNav = [
  { to: "/", label: "Dashboard", icon: BarChart3 },
  { to: "/animals", label: "Animals", icon: Beef },
  { to: "/crops", label: "Crops", icon: Sprout },
  { to: "/finance", label: "Finance", icon: ReceiptText },
  { to: "/assistant", label: "AI", icon: Bot }
];

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const handleLogout = () => {
    setOpen(false);
    logout();
  };

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-farm-100 bg-white/95 shadow-soft lg:block">
        <Sidebar user={user} logout={handleLogout} />
      </aside>

      <header className="sticky top-0 z-20 border-b border-farm-100 bg-white/90 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 font-black text-farm-950">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-farm-800 text-white">
              <Leaf className="h-4 w-4" />
            </span>
            SmartFarm AI
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-muted px-2 text-red-700" onClick={handleLogout} aria-label="Logout" title="Logout">
              <LogOut className="h-5 w-5" />
            </button>
            <button className="btn-muted px-2" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden">
          <div className="h-full w-80 max-w-[86vw] bg-white shadow-lift">
            <div className="flex justify-end p-3">
              <button className="btn-muted px-2" onClick={() => setOpen(false)} aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <Sidebar user={user} logout={handleLogout} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <main className="px-4 py-5 pb-24 lg:ml-72 lg:px-8 lg:py-8">
        <Outlet />
      </main>

      <nav className="fixed inset-x-3 bottom-3 z-20 grid grid-cols-5 rounded-2xl border border-farm-100 bg-white/95 p-1 shadow-lift backdrop-blur lg:hidden">
        {mobileNav.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => `flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-bold ${isActive ? "bg-field-sage text-farm-950" : "text-slate-500"}`} end={item.to === "/"}>
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function Sidebar({ user, logout, onNavigate }) {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-5">
      <div className="mb-7 rounded-2xl bg-farm-950 p-4 text-white shadow-soft">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/12">
            <Leaf className="h-6 w-6" />
          </div>
          <div>
            <div className="text-lg font-black">SmartFarm AI</div>
            <div className="text-xs font-semibold text-farm-100">Operations Suite</div>
          </div>
        </div>
        <div className="mt-5 rounded-xl bg-white/10 p-3">
          <div className="text-sm font-bold">{user?.farmName || "Farm Workspace"}</div>
          <div className="text-xs text-white/65">{user?.name || user?.email}</div>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between rounded-xl bg-field-sage px-3 py-2">
        <span className="text-xs font-black uppercase tracking-wide text-farm-900">Farm Monitor</span>
        <span className="h-2.5 w-2.5 rounded-full bg-farm-700" />
      </div>

      <div className="space-y-1">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition ${isActive ? "bg-farm-800 text-white shadow-soft" : "text-slate-600 hover:bg-field-mist hover:text-farm-950"}`
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </div>

      <button onClick={logout} className="btn-muted mt-5 justify-start rounded-xl text-red-700 lg:mt-auto">
        <LogOut className="h-4 w-4" />
        Logout
      </button>
    </div>
  );
}
