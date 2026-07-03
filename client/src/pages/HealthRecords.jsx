import { Edit, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import CrudModal from "../components/CrudModal";
import DataTable from "../components/DataTable";
import DocumentManager from "../components/DocumentManager";
import PageHeader from "../components/PageHeader";
import api from "../services/api";
import { formatDate, inputDate } from "../utils";

const emptyRecord = {
  animal: "",
  recordDate: inputDate(new Date()),
  condition: "",
  symptoms: "",
  diagnosis: "",
  treatment: "",
  medication: "",
  dosage: "",
  vetName: "",
  recoveryStatus: "Open",
  notes: ""
};

export default function HealthRecords() {
  const [records, setRecords] = useState([]);
  const [animals, setAnimals] = useState([]);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");

  function load() {
    Promise.all([api.get("/health-records"), api.get("/animals")])
      .then(([healthRes, animalRes]) => {
        setRecords(healthRes.data);
        setAnimals(animalRes.data);
      })
      .catch(() => toast.error("Could not load health records"));
  }

  useEffect(load, []);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return records.filter((record) => [record.animal?.animalId, record.animal?.name, record.condition, record.vetName, record.recoveryStatus].join(" ").toLowerCase().includes(term));
  }, [records, search]);

  async function remove(id) {
    if (!confirm("Delete this health record?")) return;
    await api.delete(`/health-records/${id}`);
    toast.success("Health record deleted");
    load();
  }

  return (
    <div>
      <PageHeader title="Health & Vet Records" eyebrow="Animal care" action={<button className="btn-primary" onClick={() => setEditing(emptyRecord)}><Plus className="h-4 w-4" /> Add record</button>} />
      <div className="mb-4 max-w-lg">
        <input className="input" placeholder="Search by animal, condition, vet, or status" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      <DataTable
        rows={filtered}
        emptyText="No health records yet."
        columns={[
          { key: "recordDate", label: "Date", render: (row) => formatDate(row.recordDate) },
          { key: "animal", label: "Animal", render: (row) => `${row.animal?.animalId || "Unknown"} ${row.animal?.name ? `- ${row.animal.name}` : ""}` },
          { key: "condition", label: "Condition" },
          { key: "treatment", label: "Treatment" },
          { key: "medication", label: "Medication" },
          { key: "vetName", label: "Vet", render: (row) => row.vetName || "Not set" },
          { key: "recoveryStatus", label: "Status", render: (row) => <Status value={row.recoveryStatus} /> }
        ]}
        actions={(row) => (
          <div className="flex justify-end gap-2">
            <button className="btn-muted px-2" onClick={() => setEditing({ ...row, animal: row.animal?._id, recordDate: inputDate(row.recordDate) })} aria-label="Edit health record"><Edit className="h-4 w-4" /></button>
            <button className="btn-muted px-2 text-red-700" onClick={() => remove(row._id)} aria-label="Delete health record"><Trash2 className="h-4 w-4" /></button>
          </div>
        )}
      />
      {editing && <HealthModal record={editing} animals={animals} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function HealthModal({ record, animals, onClose, onSaved }) {
  const [form, setForm] = useState(record);
  const isEdit = Boolean(record._id);

  async function submit(event) {
    event.preventDefault();
    const payload = { ...form, animal: form.animal || animals[0]?._id };
    if (!payload.animal) return toast.error("Add an animal before creating health records");
    if (isEdit) await api.put(`/health-records/${record._id}`, payload);
    else await api.post("/health-records", payload);
    toast.success(isEdit ? "Health record updated" : "Health record added");
    onSaved();
  }

  return (
    <CrudModal title={isEdit ? "Edit Health Record" : "Add Health Record"} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <AnimalSelect animals={animals} value={form.animal} onChange={(value) => setForm({ ...form, animal: value })} />
        <Field label="Date" type="date" value={form.recordDate} onChange={(value) => setForm({ ...form, recordDate: value })} />
        <Field label="Condition / disease" value={form.condition} onChange={(value) => setForm({ ...form, condition: value })} required />
        <Field label="Vet name" value={form.vetName || ""} onChange={(value) => setForm({ ...form, vetName: value })} />
        <TextArea label="Symptoms" value={form.symptoms || ""} onChange={(value) => setForm({ ...form, symptoms: value })} />
        <TextArea label="Diagnosis" value={form.diagnosis || ""} onChange={(value) => setForm({ ...form, diagnosis: value })} />
        <TextArea label="Treatment given" value={form.treatment || ""} onChange={(value) => setForm({ ...form, treatment: value })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Medication" value={form.medication || ""} onChange={(value) => setForm({ ...form, medication: value })} />
          <Field label="Dosage" value={form.dosage || ""} onChange={(value) => setForm({ ...form, dosage: value })} />
        </div>
        <label className="space-y-1">
          <span className="label">Recovery status</span>
          <select className="input" value={form.recoveryStatus} onChange={(event) => setForm({ ...form, recoveryStatus: event.target.value })}>
            {["Open", "Recovering", "Recovered", "Chronic", "Referred"].map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <TextArea label="Notes" value={form.notes || ""} onChange={(value) => setForm({ ...form, notes: value })} />
        {isEdit && <div className="sm:col-span-2"><DocumentManager entityType="health" entityId={record._id} /></div>}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" className="btn-muted" onClick={onClose}>Cancel</button>
          <button className="btn-primary">Save record</button>
        </div>
      </form>
    </CrudModal>
  );
}

function Status({ value }) {
  const tone = value === "Recovered" ? "bg-farm-50 text-farm-700" : value === "Recovering" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
  return <span className={`rounded-md px-2 py-1 text-xs font-bold ${tone}`}>{value}</span>;
}

function AnimalSelect({ animals, value, onChange }) {
  return <label className="space-y-1"><span className="label">Animal</span><select className="input" value={value || ""} onChange={(event) => onChange(event.target.value)} required><option value="">Select animal</option>{animals.map((animal) => <option key={animal._id} value={animal._id}>{animal.animalId} - {animal.name || animal.species}</option>)}</select></label>;
}

function Field({ label, value, onChange, type = "text", required }) {
  return <label className="space-y-1"><span className="label">{label}</span><input className="input" type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} required={required} /></label>;
}

function TextArea({ label, value, onChange }) {
  return <label className="space-y-1 sm:col-span-2"><span className="label">{label}</span><textarea className="input min-h-20" value={value ?? ""} onChange={(event) => onChange(event.target.value)} /></label>;
}
