import { Beef, Lock, Sprout, WalletCards, Wheat } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

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
    <div className="min-h-screen bg-farm-50">
      <section className="mobile-shell min-h-screen overflow-hidden bg-farm-50 shadow-lift">
        <div
          className="relative flex min-h-[315px] flex-col items-center justify-end overflow-hidden px-8 pb-9 text-center text-white"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(24,39,30,0.25), rgba(24,39,30,0.78)), url('https://images.unsplash.com/photo-1500595046743-cd271d694d30?auto=format&fit=crop&w=900&q=80')",
            backgroundPosition: "center",
            backgroundSize: "cover"
          }}
        >
          <div className="absolute inset-x-8 bottom-[-76px] h-40 rounded-[100%] border border-white/15" />
          <div className="relative">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] border border-white/35 bg-white/12 text-white shadow-lift backdrop-blur">
              <Wheat className="h-12 w-12 text-field-lime" />
            </div>
            <h1 className="mt-7 text-4xl font-black leading-none tracking-tight">Smart Farm AI</h1>
            <p className="mt-4 text-lg font-bold leading-7 text-white/80">Smarter farming, simpler management</p>
          </div>
        </div>

        <div className="-mt-1 rounded-t-[2rem] bg-farm-50 px-7 pb-8 pt-8">
          <div className="mb-7">
            <h2 className="text-3xl font-black tracking-tight text-farm-950">{isSignup ? "Create account" : "Welcome back"}</h2>
            <p className="mt-2 text-lg font-medium text-field-soil">{isSignup ? "Start your farm workspace" : "Sign in to your farm account"}</p>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <div className="sr-only">
              <h2>{isSignup ? "Create account" : "Sign in"}</h2>
            </div>

            {isSignup && (
              <>
                <Field label="Your name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} required />
                <Field label="Farm name" value={form.farmName} onChange={(value) => setForm({ ...form, farmName: value })} />
              </>
            )}
            <Field label="Email address" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} required />
            <Field label="Password" type="password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} required icon={Lock} />

            {!isSignup && (
              <div className="text-right">
                <button className="text-sm font-black text-farm-700" type="button">
                  Forgot password?
                </button>
              </div>
            )}

            <button className="btn-primary min-h-14 w-full text-base" disabled={loading}>
              {loading ? "Working..." : isSignup ? "Create Account" : "Sign In"}
            </button>

            <div className="grid grid-cols-3 gap-2 pt-1 text-center text-[11px] font-black text-farm-700">
              <AuthPill icon={Beef} label="Livestock" />
              <AuthPill icon={Sprout} label="Crops" />
              <AuthPill icon={WalletCards} label="Finance" />
            </div>

            <p className="pt-2 text-center text-sm font-semibold text-field-soil">
              {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
              <Link className="font-black text-farm-700" to={isSignup ? "/login" : "/signup"}>
                {isSignup ? "Sign in" : "Sign up"}
              </Link>
            </p>

            <p className="rounded-2xl bg-white/70 px-4 py-3 text-center text-xs font-bold leading-5 text-field-soil">
              Demo login: admin@smartfarm.local / password123
            </p>
          </form>
        </div>
      </section>
    </div>
  );
}

function AuthPill({ icon: Icon, label }) {
  return (
    <div className="rounded-2xl border border-farm-100 bg-white/90 px-2 py-3 shadow-soft">
      <Icon className="mx-auto mb-1 h-4 w-4" />
      {label}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required = false, icon: Icon }) {
  return (
    <label className="block space-y-2">
      <span className="text-base font-black text-farm-950">{label}</span>
      <span className="relative block">
        {Icon && <Icon className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-field-soil" />}
        <input className={`input ${Icon ? "pl-14" : ""}`} type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} />
      </span>
    </label>
  );
}
