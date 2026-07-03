import { Bell } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import PageHeader from "../components/PageHeader";
import api from "../services/api";
import { formatDate } from "../utils";

const priorities = ["", "urgent", "high", "medium", "low"];

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    api.get("/ai/alerts").then(({ data }) => setAlerts(data.alerts)).catch(() => toast.error("Could not load alerts"));
  }, []);

  const filtered = useMemo(() => (filter ? alerts.filter((alert) => alert.priority === filter) : alerts), [alerts, filter]);

  return (
    <div>
      <PageHeader title="Alerts & Notifications" eyebrow="Automatic farm alerts" />
      <div className="mb-4 flex flex-wrap gap-2">
        {priorities.map((item) => (
          <button key={item || "all"} className={filter === item ? "btn-primary" : "btn-muted"} onClick={() => setFilter(item)}>
            {item || "all"}
          </button>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {filtered.map((alert, index) => (
          <article key={`${alert.type}-${index}`} className="card p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-farm-700" />
                <span className="text-sm font-bold uppercase text-slate-500">{alert.type}</span>
              </div>
              <PriorityBadge value={alert.priority} />
            </div>
            <h2 className="font-bold text-farm-950">{alert.message}</h2>
            <p className="mt-2 text-sm text-slate-600">{alert.suggestedAction}</p>
            <div className="mt-4 text-xs text-slate-500">Created {formatDate(alert.dateCreated)}</div>
          </article>
        ))}
        {!filtered.length && <div className="card p-8 text-center text-sm text-slate-500">No alerts match this filter.</div>}
      </div>
    </div>
  );
}

function PriorityBadge({ value }) {
  const tones = {
    urgent: "bg-red-100 text-red-800",
    high: "bg-red-50 text-red-700",
    medium: "bg-amber-50 text-amber-700",
    low: "bg-slate-100 text-slate-700"
  };
  return <span className={`rounded-md px-2 py-1 text-xs font-bold ${tones[value] || tones.low}`}>{value}</span>;
}
