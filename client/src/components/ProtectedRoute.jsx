import { Navigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import BrandLogo from "./BrandLogo";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-slate-600"><BrandLogo size="large" iconOnly /><span>Loading farm workspace...</span></div>;
  }

  return user ? children : <Navigate to="/login" replace state={{ returnTo: `${location.pathname}${location.search}` }} />;
}
