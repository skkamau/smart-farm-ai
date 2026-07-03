import { Edit, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import CrudModal from "../components/CrudModal";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import api from "../services/api";
import { formatDate, inputDate } from "../utils";

const emptyRecord = { femaleAnimal: "", maleAnimal: "", matingDate: inputDate(new Date()), pregnancyStatus: "unknown", expectedBirthDate: "", actualBirthDate: "", vetNotes: "", breedingResult: "pending", notes: "" };

export default function BreedingRecords() {
  const [records, setRecords] = useState([]);
  const [animals, setAnimals] = useState([]);
  const [editing, setEditing] = useState(null);

  function load() {
    Promise.all([api.get("/breeding-records"), api.get("/animals")])
      .then(([recordRes, animalRes]) => {
        setRecords(recordRes.data);
        setAnimals(animalRes.data);
      })
      .catch(() => toast.error("Could not load breeding records"));
  }

  useEffect(load, []);

  async function remove(id) {
    if (!confirm("Delete this breeding record?")) return;
    await api.delete(`/breeding-records/${id}`);
    toast.success("Breeding record deleted");
    load();
  }

  return (
    <div>
      <PageHeader title="Breeding Management" eyebrow="Mating and pregnancy" action={<button className="btn-primary" onClick={() => setEditing(emptyRecord)}><Plus className="h-4 w-4" /> Add breeding</button>} />
      <DataTable
        rows={records}
        emptyText="No breeding records yet."
        columns={[
          { key: "femaleAnimal", label: "Female", render: (row) => animalLabel(row.femaleAnimal) },
          { key: "maleAnimal", label: "Male", render: (row) => animalLabel(row.maleAnimal) },
          { key: "matingDate", label: "Mating", render: (row) => formatDate(row.matingDate) },
          { key: "pregnancyStatus", label: "Pregnancy" },
          { key: "expectedBirthDate", label: "Expected birth", render: (row) => formatDate(row.expectedBirthDate) },
          { key: "breedingResult", label: "Result" }
        ]}
        actions={(row) => (
          <div className="flex justify-end gap-2">
            <button className="btn-muted px-2" onClick={() => setEditing({ ...row, femaleAnimal: row.femaleAnimal?._id, maleAnimal: row.maleAnimal?._id, matingDate: inputDate(row.matingDate), expectedBirthDate: inputDate(row.expectedBirthDate), actualBirthDate: inputDate(row.actualBirthDate) })} aria-label="Edit breeding"><Edit className="h-4 w-4" /></button>
            <button className="btn-muted px-2 text-red-700" onClick={() => remove(row._id)} aria-label="Delete breeding"><Trash2 className="h-4 w-4" /></button>
          </div>
        )}
      />
      {editing && <BreedingModal record={editing} animals={animals} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function BreedingModal({ record, animals, onClose, onSaved }) {
  const [form, setForm] = useState(record);
  const isEdit = Boolean(record._id);
  async function submit(event) {
    event.preventDefault();
    if (isEdit) await api.put(`/breeding-records/${record._id}`, form);
    else await api.post("/breeding-records", form);
    toast.success(isEdit ? "Breeding record updated" : "Breeding record added");
    onSaved();
  }
  return (
    <CrudModal title={isEdit ? "Edit Breeding Record" : "Add Breeding Record"} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <AnimalSelect label="Female animal" animals={animals} value={form.femaleAnimal} onChange={(value) => setForm({ ...form, femaleAnimal: value })} />
        <AnimalSelect label="Male animal" animals={animals} value={form.maleAnimal} onChange={(value) => setForm({ ...form, maleAnimal: value })} />
        <Field label="Mating date" type="date" value={form.matingDate} onChange={(value) => setForm({ ...form, matingDate: value })} required />
        <Field label="Expected birth date" type="date" value={form.expectedBirthDate} onChange={(value) => setForm({ ...form, expectedBirthDate: value })} />
        <Field label="Actual birth date" type="date" value={form.actualBirthDate} onChange={(value) => setForm({ ...form, actualBirthDate: value })} />
        <Select label="Pregnancy status" value={form.pregnancyStatus} onChange={(value) => setForm({ ...form, pregnancyStatus: value })} options={["unknown", "not_pregnant", "pregnant", "delivered"]} />
        <Select label="Breeding result" value={form.breedingResult} onChange={(value) => setForm({ ...form, breedingResult: value })} options={["pending", "successful", "failed"]} />
        <TextArea label="Vet notes" value={form.vetNotes || ""} onChange={(value) => setForm({ ...form, vetNotes: value })} />
        <TextArea label="Notes" value={form.notes || ""} onChange={(value) => setForm({ ...form, notes: value })} />
        <Actions onClose={onClose} />
      </form>
    </CrudModal>
  );
}

function animalLabel(animal) { return animal ? `${animal.animalId} - ${animal.name || animal.species}` : "Not set"; }
function AnimalSelect({ label, animals, value, onChange }) { return <label className="space-y-1"><span className="label">{label}</span><select className="input" value={value || ""} onChange={(e) => onChange(e.target.value)} required><option value="">Select animal</option>{animals.map((animal) => <option key={animal._id} value={animal._id}>{animalLabel(animal)}</option>)}</select></label>; }
function Field({ label, value, onChange, type = "text", required }) { return <label className="space-y-1"><span className="label">{label}</span><input className="input" type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} required={required} /></label>; }
function Select({ label, value, onChange, options }) { return <label className="space-y-1"><span className="label">{label}</span><select className="input" value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>; }
function TextArea({ label, value, onChange }) { return <label className="space-y-1 sm:col-span-2"><span className="label">{label}</span><textarea className="input min-h-20" value={value} onChange={(e) => onChange(e.target.value)} /></label>; }
function Actions({ onClose }) { return <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="btn-muted" onClick={onClose}>Cancel</button><button className="btn-primary">Save record</button></div>; }
