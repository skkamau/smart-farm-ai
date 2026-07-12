import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import DataTable from "../../components/DataTable";
import adminApi from "../../services/adminApi";
import { formatDate } from "../../utils";
import { AdminPageHeader, StatusBadge } from "../../utils/admin";

const actions = ["admin_login_success", "admin_login_failed", "user_suspended", "user_reactivated", "user_role_changed", "report_status_changed", "record_deleted", "animal_status_changed"];

export default function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({ action: "", outcome: "" });
  useEffect(() => { adminApi.get("/admin/logs", { params: filters }).then(({ data }) => setLogs(data)).catch(() => toast.error("Could not load activity logs")); }, [filters.action, filters.outcome]);
  return <div><AdminPageHeader title="Activity Logs" description="Security-relevant admin and deletion events. Credentials, tokens, API keys, and secret values are never recorded." /><div className="mb-4 grid gap-3 sm:max-w-2xl sm:grid-cols-2"><select className="input" value={filters.action} onChange={(event) => setFilters({ ...filters, action: event.target.value })}><option value="">All actions</option>{actions.map((action) => <option key={action}>{action}</option>)}</select><select className="input" value={filters.outcome} onChange={(event) => setFilters({ ...filters, outcome: event.target.value })}><option value="">All outcomes</option><option>success</option><option>failure</option></select></div><DataTable rows={logs} emptyText="No activity logs match these filters." columns={[{ key: "createdAt", label: "Date", render: (row) => formatDate(row.createdAt) }, { key: "action", label: "Action", render: (row) => String(row.action).replaceAll("_", " ") }, { key: "actor", label: "Actor", render: (row) => row.actorUser?.name || row.actorRole }, { key: "target", label: "Target", render: (row) => row.targetUser?.name || [row.targetType, row.targetId].filter(Boolean).join(" · ") || "None" }, { key: "outcome", label: "Outcome", render: (row) => <StatusBadge value={row.outcome} /> }]} /></div>;
}
