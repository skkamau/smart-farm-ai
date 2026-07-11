import adminApi from "../services/adminApi";

export async function downloadAdminCsv(type) {
  const { data } = await adminApi.get(`/admin/exports/${type}`, { responseType: "blob" });
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = `smart-farm-admin-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadAdminScreenshot(report) {
  const { data } = await adminApi.get(`/admin/reports/${report._id}/screenshot`, { responseType: "blob" });
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = report.screenshot?.originalName || "report-screenshot";
  link.click();
  URL.revokeObjectURL(url);
}

export function AdminPageHeader({ eyebrow = "Administration", title, description, actions }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 border-b border-farm-100 pb-5 sm:flex-row sm:items-end">
      <div>
        <div className="label">{eyebrow}</div>
        <h1 className="mt-1 text-2xl font-black text-farm-950 sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function AdminStat({ label, value, detail }) {
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className="mt-2 text-2xl font-black text-farm-950">{value ?? 0}</div>
      {detail && <div className="mt-2 text-xs font-semibold text-slate-500">{detail}</div>}
    </div>
  );
}

export function StatusBadge({ value }) {
  const tone = ["active", "Resolved"].includes(value) ? "bg-farm-50 text-farm-700" : ["suspended", "Rejected"].includes(value) ? "bg-red-50 text-red-700" : value === "New" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700";
  return <span className={`badge ${tone}`}>{value || "Unknown"}</span>;
}
