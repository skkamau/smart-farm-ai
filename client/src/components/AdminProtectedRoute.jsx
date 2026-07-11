import { Navigate, useLocation } from "react-router-dom";
import { useAdmin } from "../context/AdminContext";

export default function AdminProtectedRoute({ children }) {
  const { admin, loading } = useAdmin();
  const location = useLocation();
  if (loading) return <div className="flex min-h-screen items-center justify-center font-semibold text-slate-600">Loading admin console...</div>;
  return admin ? children : <Navigate to="/admin/login" replace state={{ returnTo: location.pathname }} />;
}
