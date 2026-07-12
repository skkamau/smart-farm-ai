import { useState } from "react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import api from "../services/api";
import BrandLogo from "../components/BrandLogo";

const genericMessage = "If an account exists with this email, a password reset link has been sent.";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setMessage(data.message || genericMessage);
      toast.success("Reset request received");
    } catch (error) {
      if (error.response?.status === 429) {
        setMessage(error.response.data?.message || "Too many reset attempts. Please wait and try again.");
      } else {
        setMessage(genericMessage);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Reset your password" subtitle="Enter your email and we will send a secure reset link if the account exists.">
      <form onSubmit={submit} className="space-y-4">
        <label className="block space-y-1">
          <span className="label">Email</span>
          <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        {message && <div className="rounded-lg bg-field-cream p-3 text-sm font-semibold text-slate-600">{message}</div>}
        <button className="btn-primary w-full" disabled={loading}>{loading ? "Sending..." : "Send reset link"}</button>
        <Link className="block text-center text-sm font-black text-farm-800 hover:text-farm-950" to="/login">Back to login</Link>
      </form>
    </AuthShell>
  );
}

function AuthShell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
        <section className="card w-full p-5 shadow-lift sm:p-7">
          <div className="mb-7 text-center">
            <BrandLogo size="large" iconOnly className="justify-center" />
            <h1 className="mt-5 text-2xl font-black tracking-tight text-farm-950 dark:text-white">{title}</h1>
            <p className="mt-2 text-sm font-medium text-slate-500">{subtitle}</p>
          </div>
          {children}
        </section>
      </div>
    </div>
  );
}
