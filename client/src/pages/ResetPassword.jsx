import { useState } from "react";
import toast from "react-hot-toast";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import { storageRemove } from "../utils/storage";
import BrandLogo from "../components/BrandLogo";

function strongPassword(password) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password);
}

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!strongPassword(form.password)) {
      setError("Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords must match.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, ...form });
      storageRemove("smartFarmToken");
      storageRemove("smartFarmUser");
      toast.success("Password reset successful. Please log in.");
      navigate("/login", { replace: true });
    } catch (error) {
      setError(error.response?.data?.message || "This reset link is invalid, expired, or already used.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
        <section className="card w-full p-5 shadow-lift sm:p-7">
          <div className="mb-7 text-center">
            <BrandLogo size="large" iconOnly className="justify-center" />
            <h1 className="mt-5 text-2xl font-black tracking-tight text-farm-950 dark:text-white">Create new password</h1>
            <p className="mt-2 text-sm font-medium text-slate-500">Use a strong password to keep your farm account secure.</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <PasswordField label="New password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} />
            <PasswordField label="Confirm password" value={form.confirmPassword} onChange={(value) => setForm({ ...form, confirmPassword: value })} />
            {error && <div className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}
            <button className="btn-primary w-full" disabled={loading}>{loading ? "Resetting..." : "Reset password"}</button>
            <Link className="block text-center text-sm font-black text-farm-800 hover:text-farm-950" to="/login">Back to login</Link>
          </form>
        </section>
      </div>
    </div>
  );
}

function PasswordField({ label, value, onChange }) {
  return (
    <label className="block space-y-1">
      <span className="label">{label}</span>
      <input className="input" type="password" value={value} onChange={(event) => onChange(event.target.value)} required />
    </label>
  );
}
