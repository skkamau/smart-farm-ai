import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Animals from "./pages/Animals";
import Auth from "./pages/Auth";
import Crops from "./pages/Crops";
import Dashboard from "./pages/Dashboard";
import Finance from "./pages/Finance";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Auth mode="login" />} />
      <Route path="/signup" element={<Auth mode="signup" />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="animals" element={<Animals />} />
        <Route path="crops" element={<Crops />} />
        <Route path="finance" element={<Finance />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
