import { Download, Edit, Image } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import CrudModal from "../../components/CrudModal";
import DataTable from "../../components/DataTable";
import adminApi from "../../services/adminApi";
import { formatDate } from "../../utils";
import { AdminPageHeader, downloadAdminCsv, downloadAdminScreenshot, StatusBadge } from "../../utils/admin";

const statuses = ["New", "Reviewing", "In progress", "Resolved", "Rejected"];
const types = ["Bug", "Suggestion", "Feature request", "Account issue", "Data issue", "Payment issue", "Other"];

export default function AdminReports() {
  const [reports, setReports] = useState([]);
  const [filters, setFilters] = useState({ search: "", status: "", reportType: "" });
  const [editing, setEditing] = useState(null);

  function load() { adminApi.get("/admin/reports", { params: filters }).then(({ data }) => setReports(data)).catch(() => toast.error("Could not load reports")); }
  useEffect(load, [filters.search, filters.status, filters.reportType]);

  return (
    <div>
      <AdminPageHeader title="Reports & Suggestions" description="Review user-reported problems and feature ideas, then record a clear resolution status." actions={<button className="btn-muted" onClick={() => downloadAdminCsv("reports")}><Download className="h-4 w-4" /> Export CSV</button>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <input className="input" placeholder="Search title or description" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
        <Filter value={filters.status} onChange={(status) => setFilters({ ...filters, status })} label="All statuses" items={statuses} />
        <Filter value={filters.reportType} onChange={(reportType) => setFilters({ ...filters, reportType })} label="All report types" items={types} />
      </div>
      <DataTable rows={reports} emptyText="No reports match these filters." columns={[
        { key: "createdAt", label: "Submitted", render: (row) => formatDate(row.createdAt) },
        { key: "title", label: "Report", render: (row) => <div className="max-w-72 whitespace-normal"><div className="font-bold">{row.title}</div><div className="text-xs text-slate-500">{row.reportType}</div></div> },
        { key: "user", label: "User", render: (row) => <div><div>{row.user?.name || "Unknown"}</div><div className="text-xs text-slate-500">{row.user?.farmName || row.user?.email}</div></div> },
        { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
        { key: "screenshot", label: "Screenshot", render: (row) => row.screenshot ? <Image className="h-4 w-4 text-farm-700" /> : "None" }
      ]} actions={(row) => <button className="btn-muted px-2" onClick={() => setEditing(row)} aria-label="Review report"><Edit className="h-4 w-4" /></button>} />
      {editing && <ReportModal report={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function Filter({ value, onChange, label, items }) { return <select className="input" value={value} onChange={(event) => onChange(event.target.value)}><option value="">{label}</option>{items.map((item) => <option key={item}>{item}</option>)}</select>; }

function ReportModal({ report, onClose, onSaved }) {
  const [form, setForm] = useState({ status: report.status, adminNotes: report.adminNotes || "" });
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try { await adminApi.patch(`/admin/reports/${report._id}`, form); toast.success("Report updated"); onSaved(); }
    catch (error) { toast.error(error.response?.data?.message || "Could not update report"); }
    finally { setSaving(false); }
  }
  return <CrudModal title="Review Report" onClose={onClose}><div className="space-y-4"><div className="rounded-md bg-field-mist p-4"><div className="label">{report.reportType}</div><h3 className="mt-1 font-black text-farm-950">{report.title}</h3><p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{report.description}</p><div className="mt-3 text-xs font-semibold text-slate-500">Submitted by {report.user?.name} on {formatDate(report.createdAt)}</div></div>{report.screenshot && <button className="btn-muted" onClick={() => downloadAdminScreenshot(report)}><Image className="h-4 w-4" /> Download screenshot</button>}<label className="block space-y-1"><span className="label">Status</span><select className="input" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label><label className="block space-y-1"><span className="label">Admin notes</span><textarea className="input min-h-28" value={form.adminNotes} onChange={(event) => setForm({ ...form, adminNotes: event.target.value })} maxLength={2000} /></label><div className="flex justify-end gap-2"><button className="btn-muted" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save changes"}</button></div></div></CrudModal>;
}
