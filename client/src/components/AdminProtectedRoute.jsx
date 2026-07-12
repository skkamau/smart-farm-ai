import { Navigate, useLocation } from "react-router-dom";
import { useAdmin } from "../context/AdminContext";
import BrandLogo from "./BrandLogo";

export default function AdminProtectedRoute({ children }) {
  const { admin, loading } = useAdmin();
  const location = useLocation();
  if (loading) return <div className="flex min-h-screen flex-col items-center justify-center gap-3 font-semibold text-slate-600"><BrandLogo size="large" iconOnly /><span>Loading admin console...</span></div>;
  return admin ? children : <Navigate to="/admin/login" replace state={{ returnTo: location.pathname }} />;
}
