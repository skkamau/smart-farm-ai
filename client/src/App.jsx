import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import AdminLayout from "./components/AdminLayout";
import AdminProtectedRoute from "./components/AdminProtectedRoute";
import ProtectedRoute from "./components/ProtectedRoute";
import AppOpeningGate from "./components/AppOpeningGate";
import AnimalProfile from "./pages/AnimalProfile";
import AnimalGroupProfile from "./pages/AnimalGroupProfile";
import Animals from "./pages/Animals";
import Alerts from "./pages/Alerts";
import Auth from "./pages/Auth";
import BirthRecords from "./pages/BirthRecords";
import BreedingRecords from "./pages/BreedingRecords";
import Crops from "./pages/Crops";
import Dashboard from "./pages/Dashboard";
import Finance from "./pages/Finance";
import Feedback from "./pages/Feedback";
import ForgotPassword from "./pages/ForgotPassword";
import HealthRecords from "./pages/HealthRecords";
import More from "./pages/More";
import Onboarding from "./pages/Onboarding";
import Reports from "./pages/Reports";
import ResetPassword from "./pages/ResetPassword";
import Scanner from "./pages/Scanner";
import Settings from "./pages/Settings";
import SmartAssistant from "./pages/SmartAssistant";
import Vaccinations from "./pages/Vaccinations";
import Weather from "./pages/Weather";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminLogs from "./pages/admin/AdminLogs";
import AdminReports from "./pages/admin/AdminReports";
import AdminUsers from "./pages/admin/AdminUsers";

export default function App() {
  return (
    <AppOpeningGate><Routes>
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/login" element={<Auth mode="login" />} />
      <Route path="/signup" element={<Auth mode="signup" />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route
        path="/admin"
        element={<AdminProtectedRoute><AdminLayout /></AdminProtectedRoute>}
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="logs" element={<AdminLogs />} />
      </Route>
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
        <Route path="groups/:id" element={<AnimalGroupProfile />} />
        <Route path="breeding" element={<BreedingRecords />} />
        <Route path="births" element={<BirthRecords />} />
        <Route path="assistant" element={<SmartAssistant />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="more" element={<More />} />
        <Route path="crops" element={<Crops />} />
        <Route path="finance" element={<Finance />} />
        <Route path="reports" element={<Reports />} />
        <Route path="health" element={<HealthRecords />} />
        <Route path="vaccinations" element={<Vaccinations />} />
        <Route path="weather" element={<Weather />} />
        <Route path="scan" element={<Scanner />} />
        <Route path="scan/:qrCodeId" element={<Scanner />} />
        <Route path="settings" element={<Settings />} />
        <Route path="feedback" element={<Feedback />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes></AppOpeningGate>
  );
}
