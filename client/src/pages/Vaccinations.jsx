import { Edit, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import CrudModal from "../components/CrudModal";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import api from "../services/api";
import { formatDate, inputDate } from "../utils";

const emptyRecord = {
  animal: "",
  vaccineName: "",
  dateGiven: inputDate(new Date()),
  nextDueDate: "",
  vetName: "",
  batchNumber: "",
  status: "completed",
  notes: ""
};

export default function Vaccinations() {
  const [records, setRecords] = useState([]);
  const [animals, setAnimals] = useState([]);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("");

  function load() {
    Promise.all([api.get("/vaccinations"), api.get("/animals")])
      .then(([vaccineRes, animalRes]) => {
        setRecords(vaccineRes.data);
        setAnimals(animalRes.data);
      })
      .catch(() => toast.error("Could not load vaccinations"));
  }

  useEffect(load, []);

  const filtered = useMemo(() => (filter ? records.filter((record) => record.status === filter) : records), [records, filter]);

  async function remove(id) {
    if (!confirm("Delete this vaccination record?")) return;
    await api.delete(`/vaccinations/${id}`);
    toast.success("Vaccination deleted");
    load();
  }

  return (
    <div>
      <PageHeader title="Vaccinations" eyebrow="Immunization schedule" action={<button className="btn-primary" onClick={() => setEditing(emptyRecord)}><Plus className="h-4 w-4" /> Add vaccine</button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        {["", "completed", "upcoming", "overdue"].map((item) => (
          <button key={item || "all"} className={filter === item ? "btn-primary" : "btn-muted"} onClick={() => setFilter(item)}>{item || "all"}</button>
        ))}
      </div>
      <DataTable
        rows={filtered}
        emptyText="No vaccination records yet."
        columns={[
          { key: "animal", label: "Animal", render: (row) => `${row.animal?.animalId || "Unknown"} ${row.animal?.name ? `- ${row.animal.name}` : ""}` },
          { key: "vaccineName", label: "Vaccine" },
          { key: "dateGiven", label: "Date given", render: (row) => formatDate(row.dateGiven) },
          { key: "nextDueDate", label: "Next due", render: (row) => formatDate(row.nextDueDate) },
          { key: "vetName", label: "Vet", render: (row) => row.vetName || "Not set" },
          { key: "batchNumber", label: "Batch", render: (row) => row.batchNumber || "Not set" },
          { key: "status", label: "Status", render: (row) => <VaccineStatus value={row.status} /> }
        ]}
        actions={(row) => (
          <div className="flex justify-end gap-2">
            <button className="btn-muted px-2" onClick={() => setEditing({ ...row, animal: row.animal?._id, dateGiven: inputDate(row.dateGiven), nextDueDate: inputDate(row.nextDueDate) })} aria-label="Edit vaccination"><Edit className="h-4 w-4" /></button>
            <button className="btn-muted px-2 text-red-700" onClick={() => remove(row._id)} aria-label="Delete vaccination"><Trash2 className="h-4 w-4" /></button>
          </div>
        )}
      />
      {editing && <VaccineModal record={editing} animals={animals} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function VaccineModal({ record, animals, onClose, onSaved }) {
  const [form, setForm] = useState(record);
  const isEdit = Boolean(record._id);

  async function submit(event) {
    event.preventDefault();
    const payload = { ...form, animal: form.animal || animals[0]?._id };
    if (!payload.animal) return toast.error("Add an animal before creating vaccinations");
    if (isEdit) await api.put(`/vaccinations/${record._id}`, payload);
    else await api.post("/vaccinations", payload);
    toast.success(isEdit ? "Vaccination updated" : "Vaccination added");
    onSaved();
  }

  return (
    <CrudModal title={isEdit ? "Edit Vaccination" : "Add Vaccination"} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <AnimalSelect animals={animals} value={form.animal} onChange={(value) => setForm({ ...form, animal: value })} />
        <Field label="Vaccine name" value={form.vaccineName} onChange={(value) => setForm({ ...form, vaccineName: value })} required />
        <Field label="Date given" type="date" value={form.dateGiven} onChange={(value) => setForm({ ...form, dateGiven: value })} />
        <Field label="Next due date" type="date" value={form.nextDueDate} onChange={(value) => setForm({ ...form, nextDueDate: value })} />
        <Field label="Vet name" value={form.vetName || ""} onChange={(value) => setForm({ ...form, vetName: value })} />
        <Field label="Batch number" value={form.batchNumber || ""} onChange={(value) => setForm({ ...form, batchNumber: value })} />
        <label className="space-y-1">
          <span className="label">Status</span>
          <select className="input" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            {["completed", "upcoming", "overdue"].map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="label">Notes</span>
          <textarea className="input min-h-20" value={form.notes || ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        </label>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" className="btn-muted" onClick={onClose}>Cancel</button>
          <button className="btn-primary">Save vaccination</button>
        </div>
      </form>
    </CrudModal>
  );
}

export function VaccineStatus({ value }) {
  const tone = value === "overdue" ? "bg-red-50 text-red-700" : value === "upcoming" ? "bg-amber-50 text-amber-700" : "bg-farm-50 text-farm-700";
  return <span className={`rounded-md px-2 py-1 text-xs font-bold ${tone}`}>{value}</span>;
}

function AnimalSelect({ animals, value, onChange }) {
  return <label className="space-y-1"><span className="label">Animal</span><select className="input" value={value || ""} onChange={(event) => onChange(event.target.value)} required><option value="">Select animal</option>{animals.map((animal) => <option key={animal._id} value={animal._id}>{animal.animalId} - {animal.name || animal.species}</option>)}</select></label>;
}

function Field({ label, value, onChange, type = "text", required }) {
  return <label className="space-y-1"><span className="label">{label}</span><input className="input" type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} required={required} /></label>;
}
