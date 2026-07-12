import { Camera, Mail, MessageSquarePlus, Send } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useSearchParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { formatDate } from "../utils";

const reportTypes = ["Bug", "Account issue", "Data issue", "Payment issue", "Suggestion", "Feature request", "Other"];
const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || "smartfarm005ai@gmail.com";

export default function Feedback() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedType = searchParams.get("type");
  const initialType = reportTypes.includes(requestedType) ? requestedType : "Bug";
  const [reports, setReports] = useState([]);
  const [form, setForm] = useState({ reportType: initialType, title: "", description: "", screenshot: null });
  const [saving, setSaving] = useState(false);

  function load() {
    api.get("/feedback").then(({ data }) => setReports(data)).catch(() => toast.error("Could not load your reports"));
  }

  useEffect(load, []);

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const data = new FormData();
    data.append("reportType", form.reportType);
    data.append("title", form.title.trim());
    data.append("description", form.description.trim());
    if (form.screenshot) data.append("screenshot", form.screenshot);
    setSaving(true);
    try {
      const response = await api.post("/feedback", data);
      toast.success(response.data?.message || "Your support request has been received.");
      setForm({ reportType: initialType, title: "", description: "", screenshot: null });
      event.target.reset();
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not submit support request");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Help & Support" eyebrow="Smart Farm AI support" />
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-md border border-farm-100 bg-white/80 p-3 text-sm font-semibold text-slate-600 dark:border-farm-800 dark:bg-farm-900/80 dark:text-slate-200">
        <Mail className="h-4 w-4 text-farm-700 dark:text-lime-300" /> Support email: <a className="font-black text-farm-800 dark:text-lime-300" href={`mailto:${supportEmail}`}>{supportEmail}</a>
      </div>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.8fr)]">
        <form className="card min-w-0 space-y-4 p-5" onSubmit={submit}>
          <div className="grid gap-3 rounded-md bg-field-mist p-3 text-sm sm:grid-cols-3 dark:bg-farm-900">
            <Identity label="User name" value={user?.name} />
            <Identity label="User email" value={user?.email} />
            <Identity label="Farm name" value={user?.farmName} />
          </div>
          <label className="block space-y-1"><span className="label">Report type</span><select className="input" value={form.reportType} onChange={(event) => setForm({ ...form, reportType: event.target.value })}>{reportTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
          <Field label="Subject" value={form.title} onChange={(title) => setForm({ ...form, title })} minLength={3} maxLength={160} />
          <label className="block space-y-1"><span className="label">Description</span><textarea className="input min-h-40" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} minLength={10} maxLength={5000} required /></label>
          <label className="block min-w-0 space-y-2"><span className="label">Screenshot (optional)</span><span className="flex min-w-0 items-center gap-3 rounded-md border border-dashed border-farm-200 p-4 text-sm font-semibold text-slate-600 dark:border-farm-700 dark:text-slate-200"><Camera className="h-5 w-5 shrink-0" /><input className="min-w-0 max-w-full text-xs" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setForm({ ...form, screenshot: event.target.files?.[0] || null })} /></span><span className="block text-xs text-slate-500">JPG, PNG, or WEBP. Maximum 5 MB.</span></label>
          <button className="btn-primary" disabled={saving}><Send className="h-4 w-4" /> {saving ? "Submitting..." : "Contact Support"}</button>
        </form>
        <section className="card min-w-0 p-5">
          <h2 className="flex items-center gap-2 font-black text-farm-950 dark:text-white"><MessageSquarePlus className="h-5 w-5" /> Your recent requests</h2>
          <div className="mt-4 space-y-3">
            {reports.map((report) => <div key={report._id} className="rounded-md border border-farm-100 p-4 dark:border-farm-800"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="font-bold text-slate-800 dark:text-white">{report.title}</div><div className="mt-1 text-xs text-slate-500 dark:text-slate-300">{report.reportType} · {formatDate(report.createdAt)}</div></div><span className="badge bg-field-mist text-farm-800 dark:bg-farm-800 dark:text-lime-200">{report.status}</span></div><p className="mt-3 line-clamp-3 text-sm text-slate-600 dark:text-slate-300">{report.description}</p></div>)}
            {!reports.length && <div className="rounded-md border border-dashed border-farm-200 p-8 text-center text-sm text-slate-500 dark:border-farm-700 dark:text-slate-300">No support requests submitted yet.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}

function Identity({ label, value }) {
  return <div className="min-w-0"><div className="label">{label}</div><div className="mt-1 truncate font-bold text-farm-950 dark:text-white">{value || "Not set"}</div></div>;
}

function Field({ label, value, onChange, minLength, maxLength }) {
  return <label className="block space-y-1"><span className="label">{label}</span><input className="input" value={value} onChange={(event) => onChange(event.target.value)} minLength={minLength} maxLength={maxLength} required /></label>;
}
