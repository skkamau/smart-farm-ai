import { Baby, Beef, Edit, Eye, FileText, HeartHandshake, Plus, ShieldPlus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import CrudModal from "../components/CrudModal";
import DataTable from "../components/DataTable";
import ExportButtons from "../components/ExportButtons";
import PageHeader from "../components/PageHeader";
import api from "../services/api";
import { currency, formatDate, inputDate } from "../utils";

const emptyAnimal = { animalId: "", name: "", species: "", breed: "", gender: "Female", dateOfBirth: "", weight: "", location: "", lifecycleStatus: "active", healthStatus: "unknown", reproductiveStatus: "unknown", estimatedValue: "", notes: "", dateOfDeath: "", causeOfDeath: "Unknown", customCauseOfDeath: "", deathNotes: "", veterinaryConfirmation: "" };
const lifecycleStatuses = ["active", "sold", "transferred", "archived", "deceased"];
const healthStatuses = ["healthy", "sick", "recovering", "chronic", "referred", "unknown"];
const reproductiveStatuses = ["not_pregnant", "pregnant", "postpartum", "nursing", "unknown"];
const deathCauses = ["Disease", "Injury", "Accident", "Birth complications", "Old age", "Predation", "Poisoning", "Unknown", "Other"];

export default function Animals() {
  const [animals, setAnimals] = useState([]);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const navigate = useNavigate();

  function load() {
    api.get("/animals").then(({ data }) => setAnimals(data)).catch(() => toast.error("Could not load animals"));
  }

  useEffect(load, []);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return animals.filter((animal) => (!statusFilter || animal.lifecycleStatus === statusFilter) && [animal.animalId, animal.name, animal.species, animal.breed, animal.lifecycleStatus, animal.healthStatus, animal.reproductiveStatus].join(" ").toLowerCase().includes(term));
  }, [animals, search, statusFilter]);

  async function remove(id) {
    if (!confirm("Delete this animal record?")) return;
    await api.delete(`/animals/${id}`);
    toast.success("Animal deleted");
    load();
  }

  return (
    <div>
      <PageHeader title="Animals" eyebrow="Livestock records" action={<div className="flex flex-wrap gap-2"><ExportButtons type="animals" basename="animals" /><button className="btn-primary" onClick={() => setEditing(emptyAnimal)}><Plus className="h-4 w-4" /> Add animal</button></div>} />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <AnimalToolCard to="/animals" label="All Animals" icon={Beef} />
        <AnimalToolCard to="/vaccinations" label="Vaccines" icon={ShieldPlus} />
        <AnimalToolCard to="/breeding" label="Breeding" icon={HeartHandshake} />
        <AnimalToolCard to="/births" label="Births" icon={Baby} />
        <AnimalToolCard to="/reports" label="Reports" icon={FileText} />
      </div>
      <div className="mb-4 grid gap-3 sm:max-w-3xl sm:grid-cols-[1fr_220px]">
        <input className="input" placeholder="Search by ID, name, species, breed, or status" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All animals</option>{lifecycleStatuses.map((status) => <option key={status} value={status}>{labelStatus(status)}</option>)}</select>
      </div>
      <DataTable
        rows={filtered}
        emptyText="No animal records yet."
        columns={[
          { key: "rowNumber", label: "No.", render: (_row, rowIndex) => rowIndex + 1 },
          { key: "animalId", label: "Animal ID" },
          { key: "species", label: "Species" },
          { key: "gender", label: "Gender" },
          { key: "statuses", label: "Status", render: (row) => <AnimalStatuses animal={row} /> },
          { key: "weight", label: "Weight", render: (row) => `${row.weight || 0} kg` },
          { key: "estimatedValue", label: "Value", render: (row) => currency.format(row.estimatedValue || 0) }
        ]}
        actions={(row) => (
          <div className="flex justify-end gap-2">
            <button className="btn-muted px-2" onClick={() => navigate(`/animals/${row._id}`)} aria-label="View animal"><Eye className="h-4 w-4" /></button>
            <button className="btn-muted px-2" onClick={() => setEditing({ ...row, gender: row.gender === "Male" ? "Male" : "Female", dateOfBirth: inputDate(row.dateOfBirth), dateOfDeath: inputDate(row.dateOfDeath) })} aria-label="Edit animal"><Edit className="h-4 w-4" /></button>
            <button className="btn-muted px-2 text-red-700" onClick={() => remove(row._id)} aria-label="Delete animal"><Trash2 className="h-4 w-4" /></button>
          </div>
        )}
      />
      {editing && <AnimalModal animal={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function AnimalToolCard({ to, label, icon: Icon }) {
  return (
    <Link to={to} className="card flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-lift">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-field-sage text-farm-800">
        <Icon className="h-5 w-5" />
      </span>
      <span className="font-black text-farm-950">{label}</span>
    </Link>
  );
}

function Status({ value }) {
  const tone = value === "deceased" || value === "not_applicable" ? "bg-slate-800 text-white" : value === "sick" || value === "chronic" ? "bg-red-50 text-red-700" : value === "recovering" || value === "referred" ? "bg-amber-50 text-amber-700" : "bg-farm-50 text-farm-700";
  return <span className={`rounded-md px-2 py-1 text-xs font-bold ${tone}`}>{labelStatus(value)}</span>;
}

function AnimalStatuses({ animal }) {
  return (
    <div className="flex min-w-40 flex-col items-start gap-1.5">
      <div className="flex items-center gap-2"><span className="w-20 text-[10px] font-bold uppercase text-slate-400">Lifecycle</span><Status value={animal.lifecycleStatus} /></div>
      <div className="flex items-center gap-2"><span className="w-20 text-[10px] font-bold uppercase text-slate-400">Health</span><Status value={animal.lifecycleStatus === "deceased" ? "not_applicable" : animal.healthStatus} /></div>
      <div className="flex items-center gap-2"><span className="w-20 text-[10px] font-bold uppercase text-slate-400">Reproductive</span><span className="text-xs font-semibold text-slate-700">{labelStatus(animal.reproductiveStatus)}</span></div>
    </div>
  );
}

function AnimalModal({ animal, onClose, onSaved }) {
  const [form, setForm] = useState(animal);
  const isEdit = Boolean(animal._id);

  async function submit(event) {
    event.preventDefault();
    const payload = { ...form, gender: form.gender === "Male" ? "Male" : "Female", weight: Number(form.weight || 0), estimatedValue: Number(form.estimatedValue || 0) };
    if (isEdit && animal.lifecycleStatus !== form.lifecycleStatus) {
      if (!confirm(`Change lifecycle status from ${labelStatus(animal.lifecycleStatus)} to ${labelStatus(form.lifecycleStatus)}?`)) return;
      payload.confirmLifecycleChange = true;
    }
    if (isEdit && animal.lifecycleStatus === "deceased" && form.lifecycleStatus !== "deceased") {
      if (!confirm("This changes the animal from Deceased. Historical death information will be preserved. Continue?")) return;
      payload.confirmStatusCorrection = true;
      payload.statusChangeReason = "Corrected deceased status";
    }
    if (isEdit) await api.put(`/animals/${animal._id}`, payload);
    else await api.post("/animals", payload);
    toast.success(isEdit ? "Animal updated" : "Animal added");
    onSaved();
  }

  return (
    <CrudModal title={isEdit ? "Edit Animal" : "Add Animal"} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Animal ID" value={form.animalId} onChange={(v) => setForm({ ...form, animalId: v })} required />
        <Field label="Name" value={form.name || ""} onChange={(v) => setForm({ ...form, name: v })} />
        <Field label="Species" value={form.species} onChange={(v) => setForm({ ...form, species: v })} required />
        <Field label="Breed" value={form.breed || ""} onChange={(v) => setForm({ ...form, breed: v })} />
        <Select label="Gender" value={form.gender === "Male" ? "Male" : "Female"} onChange={(v) => setForm({ ...form, gender: v })} options={["Female", "Male"]} />
        <Field label="Date of Birth" type="date" value={form.dateOfBirth || ""} onChange={(v) => setForm({ ...form, dateOfBirth: v })} />
        <Field label="Weight (kg)" type="number" value={form.weight} onChange={(v) => setForm({ ...form, weight: v })} />
        <Field label="Location" value={form.location || ""} onChange={(v) => setForm({ ...form, location: v })} />
        <Select label="Lifecycle status" value={form.lifecycleStatus} onChange={(v) => setForm({ ...form, lifecycleStatus: v })} options={lifecycleStatuses} />
        <Select label="Health status" value={form.healthStatus} onChange={(v) => setForm({ ...form, healthStatus: v })} options={healthStatuses} disabled={form.lifecycleStatus === "deceased"} />
        <Select label="Reproductive status" value={form.reproductiveStatus} onChange={(v) => setForm({ ...form, reproductiveStatus: v })} options={reproductiveStatuses} />
        <Field label="Estimated Value" type="number" value={form.estimatedValue} onChange={(v) => setForm({ ...form, estimatedValue: v })} />
        {form.lifecycleStatus === "deceased" && <>
          <div className="sm:col-span-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">The animal and all health, family, finance, document, and QR history will remain available.</div>
          <Field label="Date of death" type="date" value={form.dateOfDeath || ""} onChange={(v) => setForm({ ...form, dateOfDeath: v })} required />
          <Select label="Cause of death" value={form.causeOfDeath || "Unknown"} onChange={(v) => setForm({ ...form, causeOfDeath: v })} options={deathCauses} />
          {form.causeOfDeath === "Other" && <Field label="Custom cause" value={form.customCauseOfDeath || ""} onChange={(v) => setForm({ ...form, customCauseOfDeath: v })} required />}
          <Field label="Veterinary confirmation" value={form.veterinaryConfirmation || ""} onChange={(v) => setForm({ ...form, veterinaryConfirmation: v })} />
          <label className="space-y-1 sm:col-span-2"><span className="label">Death notes</span><textarea className="input min-h-24" value={form.deathNotes || ""} onChange={(event) => setForm({ ...form, deathNotes: event.target.value })} /></label>
        </>}
        <label className="space-y-1 sm:col-span-2">
          <span className="label">Notes</span>
          <textarea className="input min-h-24" value={form.notes || ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        </label>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" className="btn-muted" onClick={onClose}>Cancel</button>
          <button className="btn-primary">Save animal</button>
        </div>
      </form>
    </CrudModal>
  );
}

function Field({ label, value, onChange, type = "text", required }) {
  return <label className="space-y-1"><span className="label">{label}</span><input className="input" type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} required={required} /></label>;
}

function Select({ label, value, onChange, options, disabled }) {
  return <label className="space-y-1"><span className="label">{label}</span><select className="input" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{labelStatus(option)}</option>)}</select></label>;
}

function labelStatus(value) { return String(value || "unknown").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
