import { Edit, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import CrudModal from "../components/CrudModal";
import DataTable from "../components/DataTable";
import DocumentManager from "../components/DocumentManager";
import ExportButtons from "../components/ExportButtons";
import PageHeader from "../components/PageHeader";
import api from "../services/api";
import { currency, formatDate, inputDate } from "../utils";
import { createMedicationRow, healthMedicationSummary, isNonNegativeNumber, recordForHealthForm } from "../utils/healthRecords";

const emptyRecord = {
  animal: "",
  recordDate: inputDate(new Date()),
  healthCondition: "unknown",
  symptoms: "",
  diagnosis: "",
  medications: [createMedicationRow()],
  vetName: "",
  serviceType: "Vet consultation",
  serviceCharge: "",
  transportCost: "",
  otherCost: "",
  paymentMethod: "Mpesa",
  followUpDate: "",
  notes: ""
};

const serviceTypes = ["Vet consultation", "Vaccination", "Deworming", "Treatment", "Surgery", "Medicine", "Lab test", "Emergency visit", "Pregnancy check", "Artificial insemination", "Other"];
const paymentMethods = ["Mpesa", "Bank Transfer", "Cash", "Other"];
const healthConditions = ["healthy", "mild", "moderate", "serious", "critical", "recovering", "chronic", "stable", "unknown"];
const conditionHealthStatus = { healthy: "healthy", mild: "sick", moderate: "sick", serious: "sick", critical: "sick", recovering: "recovering", chronic: "chronic", stable: "healthy", unknown: "unknown" };

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
    return records.filter((record) => [record.animal?.animalId, record.animal?.name, record.healthCondition, record.diagnosis, record.vetName, record.animal?.healthStatus, record.animal?.lifecycleStatus].join(" ").toLowerCase().includes(term));
  }, [records, search]);

  async function remove(id) {
    if (!confirm("Delete this health record?")) return;
    await api.delete(`/health-records/${id}`);
    toast.success("Health record deleted");
    load();
  }

  return (
    <div>
      <PageHeader title="Health & Vet Records" eyebrow="Animal care" action={<div className="flex flex-wrap gap-2"><ExportButtons type="health" basename="health_vet_records" /><button className="btn-primary" onClick={() => setEditing(emptyRecord)}><Plus className="h-4 w-4" /> Add record</button></div>} />
      <div className="mb-4 max-w-lg">
        <input className="input" placeholder="Search by animal, condition, vet, or status" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      <DataTable
        rows={filtered}
        emptyText="No health records yet."
        columns={[
          { key: "recordDate", label: "Date", render: (row) => formatDate(row.recordDate) },
          { key: "animal", label: "Animal", render: (row) => `${row.animal?.animalId || "Unknown"} ${row.animal?.name ? `- ${row.animal.name}` : ""}` },
          { key: "healthCondition", label: "Health Condition", render: (row) => statusLabel(row.healthCondition) },
          { key: "diagnosis", label: "Diagnosis" },
          { key: "medications", label: "Medication", render: (row) => healthMedicationSummary(row) || "None" },
          { key: "vetName", label: "Vet", render: (row) => row.vetName || "Not set" },
          { key: "totalCost", label: "Cost", render: (row) => currency.format(row.totalCost || 0) },
          { key: "healthStatus", label: "Current health", render: (row) => <Status value={row.animal?.lifecycleStatus === "deceased" ? "not_applicable" : row.animal?.healthStatus} /> }
        ]}
        actions={(row) => (
          <div className="flex justify-end gap-2">
            <button className="btn-muted px-2" onClick={() => setEditing(recordForHealthForm(row))} aria-label="Edit health record"><Edit className="h-4 w-4" /></button>
            <button className="btn-muted px-2 text-red-700" onClick={() => remove(row._id)} aria-label="Delete health record"><Trash2 className="h-4 w-4" /></button>
          </div>
        )}
      />
      {editing && <HealthModal record={editing} animals={animals} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function HealthModal({ record, animals, onClose, onSaved }) {
  const [form, setForm] = useState(() => recordForHealthForm(record));
  const isEdit = Boolean(record._id);
  const selectedAnimal = animals.find((animal) => animal._id === form.animal);
  const [currentHealthStatus, setCurrentHealthStatus] = useState(selectedAnimal?.healthStatus || "unknown");
  const medicineTotal = (form.medications || []).reduce((sum, item) => sum + Number(item.medicineCharge || 0), 0);
  const totalCost = Number(form.serviceCharge || 0) + medicineTotal + Number(form.transportCost || 0) + Number(form.otherCost || 0);

  function updateMedication(index, field, value) {
    setForm((current) => ({
      ...current,
      medications: current.medications.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item)
    }));
  }

  function addMedication() {
    setForm((current) => ({ ...current, medications: [...current.medications, createMedicationRow()] }));
  }

  function removeMedication(index) {
    setForm((current) => ({ ...current, medications: current.medications.filter((_, itemIndex) => itemIndex !== index) }));
  }

  async function submit(event) {
    event.preventDefault();
    const diagnosis = form.diagnosis?.trim();
    if (!diagnosis) return toast.error("Diagnosis is required");

    const medications = form.medications
      .filter((item) => item.medicationName?.trim() || item.dosage?.trim() || String(item.medicineCharge ?? "").trim())
      .map((item) => ({
        medicationName: item.medicationName?.trim(),
        dosage: item.dosage?.trim(),
        medicineCharge: Number(item.medicineCharge || 0)
      }));
    if (medications.some((item) => !item.medicationName)) return toast.error("Medication name is required for each medication");
    if (medications.some((item) => !item.dosage)) return toast.error("Dosage is required for each medication");
    if (medications.some((item) => !Number.isFinite(item.medicineCharge) || item.medicineCharge < 0)) return toast.error("Medicine charge must be a valid non-negative number");
    if (!isNonNegativeNumber(form.serviceCharge)) return toast.error("Service charge must be a valid non-negative number");
    if (form.followUpDate && Number.isNaN(Date.parse(form.followUpDate))) return toast.error("Follow-up date must be valid");

    const { treatment, medication, dosage, medicineCost, ...cleanForm } = form;
    const payload = { ...cleanForm, diagnosis, medications, animal: form.animal || animals[0]?._id, totalCost };
    if (!payload.animal) return toast.error("Add an animal before creating health records");
    if (selectedAnimal?.lifecycleStatus !== "deceased" && currentHealthStatus !== selectedAnimal?.healthStatus) {
      await api.patch(`/animals/${payload.animal}/health-status`, { healthStatus: currentHealthStatus });
    }
    if (isEdit) await api.put(`/health-records/${record._id}`, payload);
    else await api.post("/health-records", payload);
    toast.success(isEdit ? "Health record updated" : "Health record added");
    onSaved();
  }

  return (
    <CrudModal title={isEdit ? "Edit Health Record" : "Add Health Record"} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <AnimalSelect animals={animals} value={form.animal} onChange={(value) => { setForm({ ...form, animal: value }); setCurrentHealthStatus(animals.find((animal) => animal._id === value)?.healthStatus || "unknown"); }} />
        <Field label="Date" type="date" value={form.recordDate} onChange={(value) => setForm({ ...form, recordDate: value })} />
        {selectedAnimal && <section className="grid gap-3 rounded-lg border border-farm-100 bg-field-cream p-4 sm:col-span-2 sm:grid-cols-3">
          <div><span className="label">Current lifecycle status</span><div className="mt-2 font-bold text-slate-800">{statusLabel(selectedAnimal.lifecycleStatus)}</div></div>
          <label className="space-y-1"><span className="label">Current animal health status</span><select className="input" value={selectedAnimal.lifecycleStatus === "deceased" ? "unknown" : currentHealthStatus} disabled={selectedAnimal.lifecycleStatus === "deceased"} onChange={(event) => setCurrentHealthStatus(event.target.value)}>{["healthy", "sick", "recovering", "chronic", "referred", "unknown"].map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></label>
          <div><span className="label">Current reproductive status</span><div className="mt-2 font-bold text-slate-800">{statusLabel(selectedAnimal.reproductiveStatus)}</div></div>
          <div className="flex flex-wrap gap-2 sm:col-span-3">{selectedAnimal.lifecycleStatus !== "deceased" && <><LifecycleButton value="deceased" animal={selectedAnimal} onUpdated={onSaved} /><LifecycleButton value="sold" animal={selectedAnimal} onUpdated={onSaved} /><LifecycleButton value="transferred" animal={selectedAnimal} onUpdated={onSaved} /><LifecycleButton value="archived" animal={selectedAnimal} onUpdated={onSaved} /></>}{selectedAnimal.lifecycleStatus !== "active" && <LifecycleButton value="active" animal={selectedAnimal} onUpdated={onSaved} />}</div>
        </section>}
        <label className="space-y-1"><span className="label">Health Condition</span><select className="input" value={form.healthCondition || "unknown"} onChange={(event) => { const healthCondition = event.target.value; setForm({ ...form, healthCondition }); setCurrentHealthStatus(conditionHealthStatus[healthCondition]); }}>{healthConditions.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></label>
        <label className="space-y-1">
          <span className="label">Health issue / service type</span>
          <select className="input" value={form.serviceType || "Vet consultation"} onChange={(event) => setForm({ ...form, serviceType: event.target.value })}>
            {serviceTypes.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <TextArea label="Symptoms" value={form.symptoms || ""} onChange={(value) => setForm({ ...form, symptoms: value })} />
        <section className="space-y-3 rounded-lg border border-farm-100 bg-white p-4 sm:col-span-2">
          <div>
            <h3 className="font-bold text-farm-950">Diagnosis</h3>
            <p className="text-sm text-slate-500">Record the confirmed or suspected diagnosis.</p>
          </div>
          <Field label="Diagnosis" value={form.diagnosis || ""} onChange={(value) => setForm({ ...form, diagnosis: value })} required />
        </section>

        <section className="space-y-4 rounded-lg border border-farm-100 bg-white p-4 sm:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-farm-950">Medication</h3>
              <p className="text-sm text-slate-500">Add each medicine, its dosage, and charge separately.</p>
            </div>
            <button type="button" className="btn-muted" onClick={addMedication}><Plus className="h-4 w-4" /> Add medication</button>
          </div>
          <div className="space-y-3">
            {form.medications.map((item, index) => (
              <div key={index} className="rounded-lg bg-field-cream p-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,.8fr)_2.5rem] lg:items-end">
                  <Field label="Medication name" value={item.medicationName} onChange={(value) => updateMedication(index, "medicationName", value)} />
                  <Field label="Dosage" value={item.dosage} onChange={(value) => updateMedication(index, "dosage", value)} />
                  <Field label="Medicine charge" type="number" min="0" step="0.01" value={item.medicineCharge} onChange={(value) => updateMedication(index, "medicineCharge", value)} />
                  {form.medications.length > 1 && (
                    <button type="button" className="btn-muted h-10 px-2 text-red-700" onClick={() => removeMedication(index)} aria-label={`Remove medication ${index + 1}`} title="Remove medication">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="text-sm font-semibold text-slate-600">Medicine total: {currency.format(medicineTotal)}</div>
        </section>

        <section className="grid gap-4 rounded-lg border border-farm-100 bg-white p-4 sm:col-span-2 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <h3 className="font-bold text-farm-950">Veterinary Service</h3>
            <p className="text-sm text-slate-500">Record the provider and professional service charge.</p>
          </div>
          <Field label="Vet name" value={form.vetName || ""} onChange={(value) => setForm({ ...form, vetName: value })} />
          <Field label="Service charge" type="number" min="0" step="0.01" value={form.serviceCharge || ""} onChange={(value) => setForm({ ...form, serviceCharge: value })} />
        </section>

        <Field label="Transport cost" type="number" min="0" step="0.01" value={form.transportCost || ""} onChange={(value) => setForm({ ...form, transportCost: value })} />
        <Field label="Other cost" type="number" min="0" step="0.01" value={form.otherCost || ""} onChange={(value) => setForm({ ...form, otherCost: value })} />
        <label className="space-y-1">
          <span className="label">Payment method</span>
          <select className="input" value={form.paymentMethod || "Mpesa"} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}>
            {paymentMethods.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <Field label="Follow-up date" type="date" value={form.followUpDate || ""} onChange={(value) => setForm({ ...form, followUpDate: value })} />
        <div className="rounded-lg bg-field-cream p-3 text-sm font-semibold text-slate-600 sm:col-span-2">
          Veterinary service + all medicines + transport + other = {currency.format(totalCost)}
        </div>
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
  const tone = value === "healthy" ? "bg-farm-50 text-farm-700" : value === "recovering" || value === "referred" ? "bg-amber-50 text-amber-700" : value === "not_applicable" ? "bg-slate-800 text-white" : "bg-red-50 text-red-700";
  return <span className={`rounded-md px-2 py-1 text-xs font-bold ${tone}`}>{statusLabel(value)}</span>;
}

function LifecycleButton({ value, animal, onUpdated }) {
  async function update() {
    if (!confirm(`Mark ${animal.animalId} as ${statusLabel(value)}?`)) return;
    const payload = { lifecycleStatus: value, confirmed: true };
    if (value === "deceased") {
      const dateOfDeath = prompt("Date of death (YYYY-MM-DD)", new Date().toISOString().slice(0, 10));
      if (!dateOfDeath) return;
      payload.dateOfDeath = dateOfDeath;
      payload.causeOfDeath = prompt("Cause of death", "Unknown") || "Unknown";
      payload.deathNotes = prompt("Death notes (optional)", "") || "";
    }
    await api.patch(`/animals/${animal._id}/lifecycle-status`, payload);
    toast.success(`Animal marked ${statusLabel(value)}`);
    onUpdated();
  }
  return <button type="button" className={value === "deceased" ? "btn-muted text-red-700" : "btn-muted"} onClick={update}>{value === "active" ? "Restore to active" : `Mark as ${statusLabel(value)}`}</button>;
}

function statusLabel(value) { return String(value || "unknown").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }

function AnimalSelect({ animals, value, onChange }) {
  return <label className="space-y-1"><span className="label">Animal</span><select className="input" value={value || ""} onChange={(event) => onChange(event.target.value)} required><option value="">Select animal</option>{animals.map((animal) => <option key={animal._id} value={animal._id}>{animal.animalId} - {animal.name || animal.species}</option>)}</select></label>;
}

function Field({ label, value, onChange, type = "text", required, min, step }) {
  return <label className="space-y-1"><span className="label">{label}</span><input className="input" type={type} min={min} step={step} value={value ?? ""} onChange={(event) => onChange(event.target.value)} required={required} /></label>;
}

function TextArea({ label, value, onChange, required }) {
  return <label className="space-y-1 sm:col-span-2"><span className="label">{label}</span><textarea className="input min-h-20" value={value ?? ""} onChange={(event) => onChange(event.target.value)} required={required} /></label>;
}
