import { Baby, BarChart3, Beef, Bell, Bot, FileText, HeartHandshake, Leaf, LogOut, Menu, QrCode, ReceiptText, ShieldPlus, Sprout, Stethoscope, X } from "lucide-react";
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
  { to: "/finance", label: "Finance", icon: ReceiptText }
];

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#edf3eb]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-farm-100 bg-white/95 lg:block">
        <Sidebar user={user} logout={logout} />
      </aside>

      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 font-bold text-farm-950">
            <Leaf className="h-5 w-5 text-farm-700" />
            Smart Farm AI
          </div>
          <button className="btn-muted px-2" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden">
          <div className="h-full w-72 bg-white">
            <div className="flex justify-end p-3">
              <button className="btn-muted px-2" onClick={() => setOpen(false)} aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <Sidebar user={user} logout={logout} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <main className="px-4 py-5 pb-24 lg:ml-64 lg:px-8 lg:py-8">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-slate-200 bg-white lg:hidden">
        {nav.slice(0, 5).map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => `flex flex-col items-center gap-1 px-2 py-2 text-xs ${isActive ? "text-farm-700" : "text-slate-500"}`} end={item.to === "/"}>
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
    <div className="flex h-full flex-col p-5">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-farm-700 text-white">
          <Leaf className="h-5 w-5" />
        </div>
        <div>
          <div className="text-base font-bold text-farm-950">Smart Farm AI</div>
          <div className="text-xs text-slate-500">Phase 1 Operations</div>
        </div>
      </div>

      <div className="mb-5 rounded-lg bg-farm-50 p-3">
        <div className="text-sm font-semibold text-farm-950">{user?.farmName}</div>
        <div className="text-xs text-slate-500">{user?.name}</div>
      </div>

      <div className="space-y-1">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold ${isActive ? "bg-farm-700 text-white" : "text-slate-600 hover:bg-slate-100"}`
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </div>

      <button onClick={logout} className="btn-muted mt-auto justify-start">
        <LogOut className="h-4 w-4" />
        Logout
      </button>
    </div>
  );
}
