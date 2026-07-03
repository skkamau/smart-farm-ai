import { Leaf } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Auth({ mode }) {
  const isSignup = mode === "signup";
  const navigate = useNavigate();
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
      navigate("/");
    } catch (error) {
      toast.error(error.response?.data?.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#eef4ed] px-4 py-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-lg bg-white shadow-soft lg:grid-cols-[1fr_0.85fr]">
        <section className="flex flex-col justify-between bg-farm-950 p-8 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10">
              <Leaf className="h-6 w-6" />
            </div>
            <div>
              <div className="text-lg font-bold">Smart Farm AI</div>
              <div className="text-sm text-white/65">Phase 1 farm operations</div>
            </div>
          </div>
          <div className="my-12 max-w-xl">
            <div className="label text-farm-100">Operational clarity</div>
            <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">Manage livestock, crops, and farm cashflow in one workspace.</h1>
            <p className="mt-5 text-base leading-7 text-white/70">
              Track the records that matter today. QR codes, family trees, AI assistant, and reports stay reserved for later phases.
            </p>
          </div>
          <div className="grid gap-3 text-sm text-white/70 sm:grid-cols-3">
            <div className="rounded-lg border border-white/10 p-3">Animal CRUD</div>
            <div className="rounded-lg border border-white/10 p-3">Crop planning</div>
            <div className="rounded-lg border border-white/10 p-3">Profit/Loss</div>
          </div>
        </section>

        <section className="flex items-center p-6 sm:p-10">
          <form onSubmit={submit} className="w-full space-y-4">
            <div>
              <div className="label">{isSignup ? "Create account" : "Sign in"}</div>
              <h2 className="mt-1 text-2xl font-bold text-farm-950">{isSignup ? "Start your farm workspace" : "Open your farm workspace"}</h2>
            </div>

            {isSignup && (
              <>
                <Field label="Your name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} required />
                <Field label="Farm name" value={form.farmName} onChange={(value) => setForm({ ...form, farmName: value })} />
              </>
            )}
            <Field label="Email" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} required />
            <Field label="Password" type="password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} required />

            <button className="btn-primary w-full" disabled={loading}>
              {loading ? "Working..." : isSignup ? "Create account" : "Login"}
            </button>

            <div className="rounded-lg bg-farm-50 p-3 text-sm text-slate-600">
              Seed login after running <span className="font-semibold">npm run seed</span>: admin@smartfarm.local / password123
            </div>

            <p className="text-center text-sm text-slate-500">
              {isSignup ? "Already have an account?" : "Need an account?"}{" "}
              <Link className="font-semibold text-farm-700" to={isSignup ? "/login" : "/signup"}>
                {isSignup ? "Login" : "Sign up"}
              </Link>
            </p>
          </form>
        </section>
      </div>
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
