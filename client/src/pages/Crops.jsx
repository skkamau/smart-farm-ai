import { Edit, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import CrudModal from "../components/CrudModal";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import api from "../services/api";
import { currency, formatDate, inputDate } from "../utils";

const emptyCrop = { name: "", field: "", plot: "", area: "", plantingDate: "", harvestDate: "", expectedYield: "", actualYield: "", cost: "", revenue: "", status: "Growing", notes: "" };

export default function Crops() {
  const [crops, setCrops] = useState([]);
  const [editing, setEditing] = useState(null);

  function load() {
    api.get("/crops").then(({ data }) => setCrops(data)).catch(() => toast.error("Could not load crops"));
  }
  useEffect(load, []);

  async function remove(id) {
    if (!confirm("Delete this crop record?")) return;
    await api.delete(`/crops/${id}`);
    toast.success("Crop deleted");
    load();
  }

  return (
    <div>
      <PageHeader title="Crops" eyebrow="Fields and harvests" action={<button className="btn-primary" onClick={() => setEditing(emptyCrop)}><Plus className="h-4 w-4" /> Add crop</button>} />
      <DataTable
        rows={crops}
        emptyText="No crop records yet."
        columns={[
          { key: "name", label: "Crop" },
          { key: "field", label: "Field" },
          { key: "area", label: "Area", render: (row) => `${row.area || 0} acres` },
          { key: "harvestDate", label: "Harvest", render: (row) => formatDate(row.harvestDate) },
          { key: "status", label: "Status" },
          { key: "cost", label: "Cost", render: (row) => currency.format(row.cost || 0) },
          { key: "revenue", label: "Revenue", render: (row) => currency.format(row.revenue || 0) }
        ]}
        actions={(row) => (
          <div className="flex justify-end gap-2">
            <button className="btn-muted px-2" onClick={() => setEditing({ ...row, plantingDate: inputDate(row.plantingDate), harvestDate: inputDate(row.harvestDate) })} aria-label="Edit crop"><Edit className="h-4 w-4" /></button>
            <button className="btn-muted px-2 text-red-700" onClick={() => remove(row._id)} aria-label="Delete crop"><Trash2 className="h-4 w-4" /></button>
          </div>
        )}
      />
      {editing && <CropModal crop={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function CropModal({ crop, onClose, onSaved }) {
  const [form, setForm] = useState(crop);
  const isEdit = Boolean(crop._id);
  async function submit(event) {
    event.preventDefault();
    const payload = { ...form, area: Number(form.area || 0), expectedYield: Number(form.expectedYield || 0), actualYield: Number(form.actualYield || 0), cost: Number(form.cost || 0), revenue: Number(form.revenue || 0) };
    if (isEdit) await api.put(`/crops/${crop._id}`, payload);
    else await api.post("/crops", payload);
    toast.success(isEdit ? "Crop updated" : "Crop added");
    onSaved();
  }
  return (
    <CrudModal title={isEdit ? "Edit Crop" : "Add Crop"} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Crop name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
        <Field label="Field" value={form.field} onChange={(v) => setForm({ ...form, field: v })} required />
        <Field label="Plot" value={form.plot} onChange={(v) => setForm({ ...form, plot: v })} />
        <Field label="Area" type="number" value={form.area} onChange={(v) => setForm({ ...form, area: v })} />
        <Field label="Planting date" type="date" value={form.plantingDate} onChange={(v) => setForm({ ...form, plantingDate: v })} />
        <Field label="Harvest date" type="date" value={form.harvestDate} onChange={(v) => setForm({ ...form, harvestDate: v })} />
        <Field label="Expected yield" type="number" value={form.expectedYield} onChange={(v) => setForm({ ...form, expectedYield: v })} />
        <Field label="Actual yield" type="number" value={form.actualYield} onChange={(v) => setForm({ ...form, actualYield: v })} />
        <Field label="Cost" type="number" value={form.cost} onChange={(v) => setForm({ ...form, cost: v })} />
        <Field label="Revenue" type="number" value={form.revenue} onChange={(v) => setForm({ ...form, revenue: v })} />
        <label className="space-y-1"><span className="label">Status</span><select className="input" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{["Planned", "Growing", "Ready", "Harvested"].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="space-y-1 sm:col-span-2"><span className="label">Notes</span><textarea className="input min-h-24" value={form.notes || ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
        <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="btn-muted" onClick={onClose}>Cancel</button><button className="btn-primary">Save crop</button></div>
      </form>
    </CrudModal>
  );
}

function Field({ label, value, onChange, type = "text", required }) {
  return <label className="space-y-1"><span className="label">{label}</span><input className="input" type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} required={required} /></label>;
}
