import { Edit, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import CrudModal from "../components/CrudModal";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import api from "../services/api";
import { currency, formatDate, inputDate } from "../utils";

const emptyAnimal = { animalId: "", name: "", species: "", breed: "", gender: "Unknown", dateOfBirth: "", weight: "", location: "", status: "Healthy", estimatedValue: "", notes: "" };

export default function Animals() {
  const [animals, setAnimals] = useState([]);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");

  function load() {
    api.get("/animals").then(({ data }) => setAnimals(data)).catch(() => toast.error("Could not load animals"));
  }

  useEffect(load, []);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return animals.filter((animal) => [animal.animalId, animal.name, animal.species, animal.breed, animal.status].join(" ").toLowerCase().includes(term));
  }, [animals, search]);

  async function remove(id) {
    if (!confirm("Delete this animal record?")) return;
    await api.delete(`/animals/${id}`);
    toast.success("Animal deleted");
    load();
  }

  return (
    <div>
      <PageHeader title="Animals" eyebrow="Livestock records" action={<button className="btn-primary" onClick={() => setEditing(emptyAnimal)}><Plus className="h-4 w-4" /> Add animal</button>} />
      <div className="mb-4 max-w-lg">
        <input className="input" placeholder="Search by ID, name, species, breed, or status" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      <DataTable
        rows={filtered}
        emptyText="No animal records yet."
        columns={[
          { key: "animalId", label: "Animal ID" },
          { key: "name", label: "Name", render: (row) => row.name || "Unnamed" },
          { key: "species", label: "Species" },
          { key: "breed", label: "Breed" },
          { key: "status", label: "Status", render: (row) => <Status value={row.status} /> },
          { key: "weight", label: "Weight", render: (row) => `${row.weight || 0} kg` },
          { key: "estimatedValue", label: "Value", render: (row) => currency.format(row.estimatedValue || 0) }
        ]}
        actions={(row) => (
          <div className="flex justify-end gap-2">
            <button className="btn-muted px-2" onClick={() => setEditing({ ...row, dateOfBirth: inputDate(row.dateOfBirth) })} aria-label="Edit animal"><Edit className="h-4 w-4" /></button>
            <button className="btn-muted px-2 text-red-700" onClick={() => remove(row._id)} aria-label="Delete animal"><Trash2 className="h-4 w-4" /></button>
          </div>
        )}
      />
      {editing && <AnimalModal animal={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function Status({ value }) {
  const tone = value === "Sick" ? "bg-red-50 text-red-700" : value === "Pregnant" ? "bg-amber-50 text-amber-700" : "bg-farm-50 text-farm-700";
  return <span className={`rounded-md px-2 py-1 text-xs font-bold ${tone}`}>{value}</span>;
}

function AnimalModal({ animal, onClose, onSaved }) {
  const [form, setForm] = useState(animal);
  const isEdit = Boolean(animal._id);

  async function submit(event) {
    event.preventDefault();
    const payload = { ...form, weight: Number(form.weight || 0), estimatedValue: Number(form.estimatedValue || 0) };
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
        <Select label="Gender" value={form.gender} onChange={(v) => setForm({ ...form, gender: v })} options={["Female", "Male", "Unknown"]} />
        <Field label="Date of Birth" type="date" value={form.dateOfBirth || ""} onChange={(v) => setForm({ ...form, dateOfBirth: v })} />
        <Field label="Weight (kg)" type="number" value={form.weight} onChange={(v) => setForm({ ...form, weight: v })} />
        <Field label="Location" value={form.location || ""} onChange={(v) => setForm({ ...form, location: v })} />
        <Select label="Status" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={["Healthy", "Sick", "Pregnant", "Sold", "Archived"]} />
        <Field label="Estimated Value" type="number" value={form.estimatedValue} onChange={(v) => setForm({ ...form, estimatedValue: v })} />
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

function Select({ label, value, onChange, options }) {
  return <label className="space-y-1"><span className="label">{label}</span><select className="input" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}
