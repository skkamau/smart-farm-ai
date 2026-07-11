import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import adminApi from "../../services/adminApi";
import { formatDate } from "../../utils";
import { AdminPageHeader, AdminStat, downloadAdminCsv } from "../../utils/admin";

const summaryCards = [
  ["Daily active users", "dailyActiveUsers"], ["Weekly active users", "weeklyActiveUsers"], ["New registrations", "newRegistrations"],
  ["Animals created", "animalRecordsCreated"], ["Crops created", "cropRecordsCreated"], ["Health records created", "healthRecordsCreated"],
  ["Inventory records created", "inventoryRecordsCreated"], ["Finance records created", "financeRecordsCreated"]
];

export default function AdminAnalytics() {
  const [data, setData] = useState({ summary: {}, featureUsage: [], dailyActive: [] });
  useEffect(() => { adminApi.get("/admin/analytics").then(({ data }) => setData(data)).catch(() => toast.error("Could not load analytics")); }, []);
  const maxUses = Math.max(...data.featureUsage.map((item) => item.uses), 1);
  const maxDaily = Math.max(...data.dailyActive.map((item) => item.users), 1);
  return <div><AdminPageHeader title="Analytics" description="Privacy-friendly usage totals. Feature names and activity days are retained for 180 days; page content and device fingerprints are not collected." actions={<button className="btn-muted" onClick={() => downloadAdminCsv("analytics")}><Download className="h-4 w-4" /> Export CSV</button>} /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{summaryCards.map(([label, key]) => <AdminStat key={key} label={label} value={data.summary[key]} detail={key.includes("Created") ? "Last 30 days" : undefined} />)}</div><div className="mt-6 grid gap-5 xl:grid-cols-2"><section className="card p-5"><h2 className="font-black text-farm-950">Most-used features</h2><div className="mt-5 space-y-4">{data.featureUsage.map((item) => <Bar key={item.feature} label={item.feature} value={item.uses} detail={`${item.uniqueUsers} users`} percent={(item.uses / maxUses) * 100} />)}{!data.featureUsage.length && <Empty />}</div></section><section className="card p-5"><h2 className="font-black text-farm-950">Daily active users</h2><div className="mt-5 space-y-4">{data.dailyActive.map((item) => <Bar key={item.date} label={formatDate(item.date)} value={item.users} percent={(item.users / maxDaily) * 100} />)}{!data.dailyActive.length && <Empty />}</div></section></div></div>;
}

function Bar({ label, value, detail, percent }) { return <div><div className="mb-1 flex items-center justify-between gap-3 text-sm"><span className="font-bold capitalize text-slate-700">{label}</span><span className="font-semibold text-slate-500">{value}{detail ? ` · ${detail}` : ""}</span></div><div className="h-2 overflow-hidden rounded-full bg-field-mist"><div className="h-full rounded-full bg-farm-700" style={{ width: `${Math.max(percent, 3)}%` }} /></div></div>; }
function Empty() { return <div className="py-8 text-center text-sm text-slate-500">No usage data yet.</div>; }
