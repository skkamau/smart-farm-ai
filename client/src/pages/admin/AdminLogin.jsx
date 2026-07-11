import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAdmin } from "../../context/AdminContext";
import { useAdminLightTheme } from "../../utils/adminTheme";

export default function AdminLogin() {
  useAdminLightTheme();
  const { admin, login } = useAdmin();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  if (admin) return <Navigate to="/admin/dashboard" replace />;

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      await login(form);
      toast.success("Admin session started");
      navigate(location.state?.returnTo || "/admin/dashboard", { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || "Admin authentication failed");
    } finally { setLoading(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-field-cream px-4 py-8">
      <section className="card w-full max-w-md p-6 shadow-lift sm:p-8">
        <div className="mb-7 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-md bg-farm-800 text-white"><ShieldCheck className="h-8 w-8" /></span>
          <h1 className="mt-4 text-2xl font-black text-farm-950">SmartFarm Admin</h1>
          <p className="mt-1 text-sm text-slate-500">Authorized administrators only</p>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          <Field label="Admin email" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} />
          <Field label="Password" type="password" value={form.password} onChange={(password) => setForm({ ...form, password })} />
          <button className="btn-primary w-full" disabled={loading}>{loading ? "Signing in..." : "Sign in to admin"}</button>
        </form>
        <Link className="mt-5 block text-center text-sm font-bold text-farm-800" to="/login">Return to farm login</Link>
      </section>
    </div>
  );
}

function Field({ label, type, value, onChange }) {
  return <label className="block space-y-1"><span className="label">{label}</span><input className="input" type={type} value={value} onChange={(event) => onChange(event.target.value)} required autoComplete={type === "password" ? "current-password" : "email"} /></label>;
}
