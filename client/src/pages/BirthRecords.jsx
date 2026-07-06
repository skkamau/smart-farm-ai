import { Edit, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import CrudModal from "../components/CrudModal";
import DataTable from "../components/DataTable";
import ExportButtons from "../components/ExportButtons";
import PageHeader from "../components/PageHeader";
import api from "../services/api";
import { formatDate, inputDate } from "../utils";

const emptyRecord = { mother: "", father: "", birthDate: inputDate(new Date()), numberOfOffspring: 1, offspring: [], birthComplications: "", vetNotes: "", notes: "" };

export default function BirthRecords() {
  const [records, setRecords] = useState([]);
  const [animals, setAnimals] = useState([]);
  const [editing, setEditing] = useState(null);

  function load() {
    Promise.all([api.get("/birth-records"), api.get("/animals")])
      .then(([recordRes, animalRes]) => {
        setRecords(recordRes.data);
        setAnimals(animalRes.data);
      })
      .catch(() => toast.error("Could not load birth records"));
  }
  useEffect(load, []);

  async function remove(id) {
    if (!confirm("Delete this birth record? Existing animal parent links are not removed.")) return;
    await api.delete(`/birth-records/${id}`);
    toast.success("Birth record deleted");
    load();
  }

  return (
    <div>
      <PageHeader title="Birth Records" eyebrow="Offspring and parent linking" action={<div className="flex flex-wrap gap-2"><ExportButtons type="births" basename="birth_records" /><ExportButtons type="family" basename="parent_children_records" pdf={false} /><button className="btn-primary" onClick={() => setEditing(emptyRecord)}><Plus className="h-4 w-4" /> Add birth</button></div>} />
      <DataTable
        rows={records}
        emptyText="No birth records yet."
        columns={[
          { key: "birthDate", label: "Birth date", render: (row) => formatDate(row.birthDate) },
          { key: "mother", label: "Mother", render: (row) => animalLabel(row.mother) },
          { key: "father", label: "Father", render: (row) => animalLabel(row.father) },
          { key: "numberOfOffspring", label: "Offspring #" },
          { key: "offspring", label: "Offspring", render: (row) => (row.offspring || []).map(animalLabel).join(", ") || "Not linked" }
        ]}
        actions={(row) => (
          <div className="flex justify-end gap-2">
            <button className="btn-muted px-2" onClick={() => setEditing({ ...row, mother: row.mother?._id, father: row.father?._id, offspring: (row.offspring || []).map((animal) => animal._id), birthDate: inputDate(row.birthDate) })} aria-label="Edit birth"><Edit className="h-4 w-4" /></button>
            <button className="btn-muted px-2 text-red-700" onClick={() => remove(row._id)} aria-label="Delete birth"><Trash2 className="h-4 w-4" /></button>
          </div>
        )}
      />
      {editing && <BirthModal record={editing} animals={animals} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function BirthModal({ record, animals, onClose, onSaved }) {
  const [form, setForm] = useState(record);
  const isEdit = Boolean(record._id);
  async function submit(event) {
    event.preventDefault();
    const payload = { ...form, numberOfOffspring: Number(form.numberOfOffspring || 1) };
    if (isEdit) await api.put(`/birth-records/${record._id}`, payload);
    else await api.post("/birth-records", payload);
    toast.success(isEdit ? "Birth record updated" : "Birth record added and family linked");
    onSaved();
  }
  function toggleOffspring(id) {
    const current = form.offspring || [];
    setForm({ ...form, offspring: current.includes(id) ? current.filter((item) => item !== id) : [...current, id] });
  }
  return (
    <CrudModal title={isEdit ? "Edit Birth Record" : "Add Birth Record"} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <AnimalSelect label="Mother" animals={animals} value={form.mother} onChange={(value) => setForm({ ...form, mother: value })} />
        <AnimalSelect label="Father" animals={animals} value={form.father} onChange={(value) => setForm({ ...form, father: value })} />
        <Field label="Birth date" type="date" value={form.birthDate} onChange={(value) => setForm({ ...form, birthDate: value })} required />
        <Field label="Number of offspring" type="number" value={form.numberOfOffspring} onChange={(value) => setForm({ ...form, numberOfOffspring: value })} required />
        <div className="space-y-2 sm:col-span-2">
          <div className="label">Offspring animal IDs</div>
          <div className="grid max-h-56 gap-2 overflow-auto rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
            {animals.map((animal) => (
              <label key={animal._id} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={(form.offspring || []).includes(animal._id)} onChange={() => toggleOffspring(animal._id)} />
                {animalLabel(animal)}
              </label>
            ))}
          </div>
        </div>
        <TextArea label="Birth complications" value={form.birthComplications || ""} onChange={(value) => setForm({ ...form, birthComplications: value })} />
        <TextArea label="Vet notes" value={form.vetNotes || ""} onChange={(value) => setForm({ ...form, vetNotes: value })} />
        <TextArea label="Notes" value={form.notes || ""} onChange={(value) => setForm({ ...form, notes: value })} />
        <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="btn-muted" onClick={onClose}>Cancel</button><button className="btn-primary">Save birth</button></div>
      </form>
    </CrudModal>
  );
}

function animalLabel(animal) { return animal ? `${animal.animalId} - ${animal.name || animal.species}` : "Not set"; }
function AnimalSelect({ label, animals, value, onChange }) { return <label className="space-y-1"><span className="label">{label}</span><select className="input" value={value || ""} onChange={(e) => onChange(e.target.value)} required><option value="">Select animal</option>{animals.map((animal) => <option key={animal._id} value={animal._id}>{animalLabel(animal)}</option>)}</select></label>; }
function Field({ label, value, onChange, type = "text", required }) { return <label className="space-y-1"><span className="label">{label}</span><input className="input" type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} required={required} /></label>; }
function TextArea({ label, value, onChange }) { return <label className="space-y-1 sm:col-span-2"><span className="label">{label}</span><textarea className="input min-h-20" value={value} onChange={(e) => onChange(e.target.value)} /></label>; }
