import { Navigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-600">Loading farm workspace...</div>;
  }

  return user ? children : <Navigate to="/login" replace state={{ returnTo: `${location.pathname}${location.search}` }} />;
}
