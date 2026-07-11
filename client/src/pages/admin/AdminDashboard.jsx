import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import adminApi from "../../services/adminApi";
import { formatDate } from "../../utils";
import { AdminPageHeader, AdminStat, downloadAdminCsv, StatusBadge } from "../../utils/admin";

const cards = [
  ["Total users", "totalUsers"], ["Active users", "activeUsers"], ["New users this week", "newUsersThisWeek"],
  ["Total farms", "totalFarms"], ["Total animals", "totalAnimals"], ["Total crops", "totalCrops"],
  ["Health records", "totalHealthRecords"], ["Inventory items", "totalInventoryItems"],
  ["Finance records", "totalFinanceRecords"], ["New reports", "newBugReports"]
];

export default function AdminDashboard() {
  const [data, setData] = useState({ summary: {}, recentRegistrations: [], recentReports: [] });
  useEffect(() => { adminApi.get("/admin/dashboard").then(({ data }) => setData(data)).catch(() => toast.error("Could not load admin dashboard")); }, []);

  return (
    <div>
      <AdminPageHeader title="Dashboard" description="A concise operational view of accounts, farms, records, and incoming user reports." actions={<><button className="btn-muted" onClick={() => downloadAdminCsv("users")}><Download className="h-4 w-4" /> Users CSV</button><button className="btn-muted" onClick={() => downloadAdminCsv("farms")}><Download className="h-4 w-4" /> Farms CSV</button></>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{cards.map(([label, key]) => <AdminStat key={key} label={label} value={data.summary[key]} />)}</div>
      <div className="mt-6 grid min-w-0 gap-5 xl:grid-cols-2">
        <section className="card min-w-0 p-5">
          <h2 className="font-black text-farm-950">Recent registrations</h2>
          <div className="mt-4 divide-y divide-farm-100">{data.recentRegistrations.map((user) => <div key={user._id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><div className="truncate font-bold text-slate-800">{user.name}</div><div className="truncate text-xs text-slate-500">{user.farmName} · {user.email}</div></div><div className="shrink-0 text-xs font-semibold text-slate-500">{formatDate(user.createdAt)}</div></div>)}{!data.recentRegistrations.length && <Empty text="No registrations yet" />}</div>
        </section>
        <section className="card min-w-0 p-5">
          <h2 className="font-black text-farm-950">Recent reports</h2>
          <div className="mt-4 divide-y divide-farm-100">{data.recentReports.map((report) => <div key={report._id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><div className="truncate font-bold text-slate-800">{report.title}</div><div className="truncate text-xs text-slate-500">{report.reportType} · {report.user?.farmName || report.user?.name}</div></div><StatusBadge value={report.status} /></div>)}{!data.recentReports.length && <Empty text="No reports yet" />}</div>
        </section>
      </div>
    </div>
  );
}

function Empty({ text }) { return <div className="py-8 text-center text-sm text-slate-500">{text}</div>; }
