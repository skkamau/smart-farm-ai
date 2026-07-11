import { Download, Eye, UserCheck, UserX } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import CrudModal from "../../components/CrudModal";
import DataTable from "../../components/DataTable";
import { useAdmin } from "../../context/AdminContext";
import adminApi from "../../services/adminApi";
import { formatDate } from "../../utils";
import { AdminPageHeader, downloadAdminCsv, StatusBadge } from "../../utils/admin";

export default function AdminUsers() {
  const { admin } = useAdmin();
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ search: "", role: "", status: "" });
  const [selected, setSelected] = useState(null);
  const [statusAction, setStatusAction] = useState(null);

  function load() {
    adminApi.get("/admin/users", { params: filters }).then(({ data }) => setUsers(data.users)).catch(() => toast.error("Could not load users"));
  }
  useEffect(load, [filters.search, filters.role, filters.status]);

  async function changeStatus(reason = "") {
    const status = statusAction.accountStatus === "suspended" ? "active" : "suspended";
    await adminApi.patch(`/admin/users/${statusAction._id}/status`, { status, reason });
    toast.success(status === "suspended" ? "User suspended" : "User reactivated");
    setStatusAction(null);
    load();
  }

  async function changeRole(user, role) {
    if (!confirm(`Change ${user.name}'s role to ${role}? Their current sessions will be revoked.`)) return;
    try {
      await adminApi.patch(`/admin/users/${user._id}/role`, { role });
      toast.success("Role updated");
      load();
    } catch (error) { toast.error(error.response?.data?.message || "Could not update role"); }
  }

  return (
    <div>
      <AdminPageHeader title="Users" description="Search accounts, inspect farm activity, and manage access without exposing credentials." actions={<button className="btn-muted" onClick={() => downloadAdminCsv("users")}><Download className="h-4 w-4" /> Export CSV</button>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <input className="input" placeholder="Search name, email, or farm" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
        <Select value={filters.role} onChange={(role) => setFilters({ ...filters, role })} options={["", "user", "admin", "super_admin"]} empty="All roles" />
        <Select value={filters.status} onChange={(status) => setFilters({ ...filters, status })} options={["", "active", "suspended"]} empty="All statuses" />
      </div>
      <DataTable rows={users} emptyText="No users match these filters." columns={[
        { key: "name", label: "User", render: (row) => <div><div className="font-bold">{row.name}</div><div className="text-xs text-slate-500">{row.email}</div></div> },
        { key: "farmName", label: "Farm" },
        { key: "role", label: "Role", render: (row) => admin?.role === "super_admin" && row.role !== "super_admin" && row._id !== admin.id ? <select className="input min-w-28 py-1" value={row.role} onChange={(event) => changeRole(row, event.target.value)}><option value="user">user</option><option value="admin">admin</option></select> : row.role },
        { key: "accountStatus", label: "Status", render: (row) => <StatusBadge value={row.accountStatus} /> },
        { key: "createdAt", label: "Joined", render: (row) => formatDate(row.createdAt) },
        { key: "lastLoginAt", label: "Last login", render: (row) => row.lastLoginAt ? formatDate(row.lastLoginAt) : "Never" },
        { key: "counts", label: "Records", render: (row) => <span title="Animals / Crops / Health / Inventory">{row.animalCount} / {row.cropCount} / {row.healthRecordCount} / {row.inventoryRecordCount}</span> }
      ]} actions={(row) => <div className="flex justify-end gap-2"><button className="btn-muted px-2" onClick={() => setSelected(row)} aria-label="View user"><Eye className="h-4 w-4" /></button>{row._id !== admin?.id && row.role !== "super_admin" && (admin?.role === "super_admin" || row.role === "user") && <button className={`btn-muted px-2 ${row.accountStatus === "suspended" ? "text-farm-700" : "text-red-700"}`} onClick={() => setStatusAction(row)} aria-label={row.accountStatus === "suspended" ? "Reactivate user" : "Suspend user"}>{row.accountStatus === "suspended" ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}</button>}</div>} />
      {selected && <UserDetail user={selected} onClose={() => setSelected(null)} />}
      {statusAction && <StatusModal user={statusAction} onClose={() => setStatusAction(null)} onConfirm={changeStatus} />}
    </div>
  );
}

function Select({ value, onChange, options, empty }) { return <select className="input" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((item) => <option key={item} value={item}>{item || empty}</option>)}</select>; }

function UserDetail({ user, onClose }) {
  return <CrudModal title="User Details" onClose={onClose}><div className="grid gap-3 sm:grid-cols-2">{[["Name", user.name], ["Email", user.email], ["Farm", user.farmName], ["Farm type", user.farmType], ["Location", user.farmLocation], ["Role", user.role], ["Status", user.accountStatus], ["Joined", formatDate(user.createdAt)], ["Last login", user.lastLoginAt ? formatDate(user.lastLoginAt) : "Never"], ["Animals", user.animalCount], ["Crops", user.cropCount], ["Health records", user.healthRecordCount], ["Inventory records", user.inventoryRecordCount]].map(([label, value]) => <div key={label} className="rounded-md border border-farm-100 p-3"><div className="label">{label}</div><div className="mt-1 break-words font-semibold text-slate-700">{value || "Not set"}</div></div>)}</div></CrudModal>;
}

function StatusModal({ user, onClose, onConfirm }) {
  const suspending = user.accountStatus !== "suspended";
  const [reason, setReason] = useState("");
  return <CrudModal title={suspending ? "Suspend User" : "Reactivate User"} onClose={onClose}><div className="space-y-4"><p className="text-sm text-slate-600">{suspending ? `Suspend ${user.name} and revoke all active sessions.` : `Restore access for ${user.name}.`}</p>{suspending && <label className="block space-y-1"><span className="label">Reason</span><textarea className="input min-h-24" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} /></label>}<div className="flex justify-end gap-2"><button className="btn-muted" onClick={onClose}>Cancel</button><button className={suspending ? "btn bg-red-700 text-white" : "btn-primary"} onClick={() => onConfirm(reason)}>{suspending ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}{suspending ? "Suspend" : "Reactivate"}</button></div></div></CrudModal>;
}
