import { Beef, Sprout, WalletCards } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import BrandLogo from "../components/BrandLogo";

export default function Auth({ mode }) {
  const isSignup = mode === "signup";
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login, signup } = useAuth();
  const [form, setForm] = useState({ name: "", farmName: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      if (isSignup) {
        await signup(form);
      } else {
        await login({ email: form.email, password: form.password });
      }
      toast.success(isSignup ? "Farm account created" : "Welcome back");
      navigate(location.state?.returnTo || "/");
    } catch (error) {
      toast.error(error.response?.data?.message || "Authentication failed");
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
            <h1 className="mt-5 text-2xl font-black tracking-tight text-farm-950 dark:text-white">Smart Farm <span className="text-lime-500">AI</span></h1>
            <p className="mt-1 text-sm font-medium text-slate-500">Smart farming made simple</p>
          </div>

          <div className="mb-5 grid grid-cols-2 rounded-lg bg-field-mist p-1 text-sm font-bold">
            <Link className={`rounded-md px-3 py-2 text-center ${!isSignup ? "bg-white text-farm-950 shadow-soft" : "text-slate-500"}`} to="/login">
              Login
            </Link>
            <Link className={`rounded-md px-3 py-2 text-center ${isSignup ? "bg-white text-farm-950 shadow-soft" : "text-slate-500"}`} to="/signup">
              Sign Up
            </Link>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="sr-only">
              <h2>{isSignup ? "Create account" : "Sign in"}</h2>
            </div>

            {isSignup && (
              <>
                <Field label="Your name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} required />
                <Field label="Farm name" value={form.farmName} onChange={(value) => setForm({ ...form, farmName: value })} />
              </>
            )}
            <Field label="Email" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} required />
            <Field label="Password" type="password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} required />
            {!isSignup && (
              <div className="text-right">
                <Link className="text-sm font-black text-farm-800 hover:text-farm-950" to="/forgot-password">
                  Forgot Password?
                </Link>
              </div>
            )}

            <button className="btn-primary w-full" disabled={loading}>
              {loading ? "Working..." : isSignup ? "Create account" : "Login"}
            </button>

            <div className="grid grid-cols-3 gap-2 pt-2 text-center text-[11px] font-bold text-farm-800">
              <AuthPill icon={Beef} label="Animals" />
              <AuthPill icon={Sprout} label="Crops" />
              <AuthPill icon={WalletCards} label="Finance" />
            </div>
            <div className="sr-only">Smart Farm AI public auth page v2</div>
          </form>
        </section>
      </div>
    </div>
  );
}

function AuthPill({ icon: Icon, label }) {
  return (
    <div className="rounded-lg border border-farm-100 bg-white px-2 py-3">
      <Icon className="mx-auto mb-1 h-4 w-4" />
      {label}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required = false }) {
  return (
    <label className="block space-y-1">
      <span className="label">{label}</span>
      <input className="input" type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} />
    </label>
  );
}
