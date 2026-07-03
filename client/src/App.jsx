import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import AnimalProfile from "./pages/AnimalProfile";
import Animals from "./pages/Animals";
import Alerts from "./pages/Alerts";
import Auth from "./pages/Auth";
import BirthRecords from "./pages/BirthRecords";
import BreedingRecords from "./pages/BreedingRecords";
import Crops from "./pages/Crops";
import Dashboard from "./pages/Dashboard";
import Finance from "./pages/Finance";
import HealthRecords from "./pages/HealthRecords";
import Scanner from "./pages/Scanner";
import SmartAssistant from "./pages/SmartAssistant";
import Vaccinations from "./pages/Vaccinations";

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
        <Route path="animals/:id" element={<AnimalProfile />} />
        <Route path="breeding" element={<BreedingRecords />} />
        <Route path="births" element={<BirthRecords />} />
        <Route path="assistant" element={<SmartAssistant />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="crops" element={<Crops />} />
        <Route path="finance" element={<Finance />} />
        <Route path="health" element={<HealthRecords />} />
        <Route path="vaccinations" element={<Vaccinations />} />
        <Route path="scan" element={<Scanner />} />
        <Route path="scan/:qrCodeId" element={<Scanner />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
