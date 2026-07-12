import { BarChart3, Bug, LayoutDashboard, LogOut, ScrollText, Users } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useAdmin } from "../context/AdminContext";
import { useAdminLightTheme } from "../utils/adminTheme";
import BrandLogo from "./BrandLogo";

const adminNav = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/reports", label: "Reports", icon: Bug },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/logs", label: "Logs", icon: ScrollText }
];

function AdminNavLink({ item, compact = false }) {
  return (
    <NavLink to={item.to} className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-bold transition ${compact ? "shrink-0" : ""} ${isActive ? "bg-field-sage text-farm-950" : "text-slate-500 hover:bg-field-mist hover:text-farm-950"}`}>
      <item.icon className="h-5 w-5" />
      {item.label}
    </NavLink>
  );
}

export default function AdminLayout() {
  const { admin, logout } = useAdmin();
  useAdminLightTheme();
  return (
    <div className="min-h-screen bg-field-cream">
      <header className="sticky top-0 z-30 border-b border-farm-100 bg-white/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 font-black text-farm-950"><BrandLogo size="small" iconOnly /> Admin</div>
          <button className="btn-muted px-2" onClick={logout} aria-label="Admin logout"><LogOut className="h-5 w-5" /></button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3">{adminNav.map((item) => <AdminNavLink key={item.to} item={item} compact />)}</nav>
      </header>

      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-farm-100 bg-white p-5 lg:flex lg:flex-col">
        <div className="flex items-center gap-3 border-b border-farm-100 pb-5">
          <BrandLogo size="medium" iconOnly />
          <div><div className="font-black text-farm-950">SmartFarm Admin</div><div className="text-xs font-semibold text-slate-500">Owner console</div></div>
        </div>
        <nav className="mt-6 space-y-1">{adminNav.map((item) => <AdminNavLink key={item.to} item={item} />)}</nav>
        <div className="mt-auto border-t border-farm-100 pt-4">
          <div className="mb-3 truncate text-sm font-bold text-farm-950">{admin?.name}</div>
          <div className="mb-3 text-xs font-semibold uppercase text-slate-500">{String(admin?.role || "").replace("_", " ")}</div>
          <button className="btn-muted w-full" onClick={logout}><LogOut className="h-4 w-4" /> Logout</button>
        </div>
      </aside>

      <main className="mx-auto max-w-[1600px] px-4 py-5 lg:ml-64 lg:px-8 lg:py-8"><Outlet /></main>
    </div>
  );
}
