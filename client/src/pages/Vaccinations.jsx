import { ChevronDown, ChevronUp, Edit, Plus, ShieldPlus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import CrudModal from "../components/CrudModal";
import DataTable from "../components/DataTable";
import DocumentManager from "../components/DocumentManager";
import ExportButtons from "../components/ExportButtons";
import PageHeader from "../components/PageHeader";
import api from "../services/api";
import { currency, formatDate, inputDate } from "../utils";

const emptyRecord = {
  animal: "",
  vaccineName: "",
  dateGiven: inputDate(new Date()),
  nextDueDate: "",
  vetName: "",
  batchNumber: "",
  serviceCharge: "",
  vaccineCost: "",
  transportCost: "",
  otherCost: "",
  paymentMethod: "Mpesa",
  status: "completed",
  notes: ""
};

const paymentMethods = ["Mpesa", "Bank Transfer", "Cash", "Other"];

const sheepGoatSchedule = [
  {
    animal: "Sheep",
    disease: "Enterotoxaemia",
    bestTime: "First time any time, boost annually, and ewes 4-6 weeks before lambing.",
    explanation: "Disease germs are within the animal, so disease can occur any time.",
    signs: "Death of weaner lambs. Well-fed animals are more prone.",
    notes: "Lambs from vaccinated mothers: 7 weeks, booster at 11 weeks. Lambs from unvaccinated mothers: 4 weeks, booster at 8 weeks."
  },
  {
    animal: "Sheep",
    disease: "Blue Tongue",
    bestTime: "Just before rains.",
    explanation: "Disease is spread by biting insects that multiply during rains.",
    signs: "Swollen bluish tongue."
  },
  {
    animal: "Sheep / Goat",
    disease: "Rift Valley Fever",
    bestTime: "Just before rains.",
    explanation: "Disease is spread by biting insects that multiply during rains.",
    signs: "Deaths and yellow mucus membranes."
  },
  {
    animal: "Sheep / Goat",
    disease: "ORF / Contagious Ecthyma",
    bestTime: "During dry seasons.",
    explanation: "Mostly spread through direct contact during dry spells as animals move in search of pasture.",
    signs: "Wounds at the mouth corners."
  },
  {
    animal: "Sheep / Goat",
    disease: "PPR",
    bestTime: "During dry seasons.",
    explanation: "Peste des Petits Ruminants caused by PPR virus. Mostly spread through direct contact during dry spells.",
    signs: "Weight loss, diarrheas, abortion."
  },
  {
    animal: "Sheep / Goat",
    disease: "Sheep and Goat Pox",
    bestTime: "During dry seasons.",
    explanation: "Mostly spread through direct contact during dry spells as animals move in search of pasture.",
    signs: "Large pimples all over the body."
  },
  {
    animal: "Sheep / Goat",
    disease: "Foot and Mouth Disease",
    bestTime: "During dry seasons.",
    explanation: "Mostly spread through direct contact during dry spells as animals move in search of pasture.",
    signs: "Wounds on gums and feet."
  },
  {
    animal: "Goat",
    disease: "CCPP",
    bestTime: "During dry seasons.",
    explanation: "Contagious Caprine Pleuropneumonia caused by Mycoplasma capricolum. Mostly spread through direct contact during dry spells.",
    signs: "Pneumonia, hardened liver-like lungs."
  },
  {
    animal: "Sheep / Goat",
    disease: "Pasteurella",
    bestTime: "Just before rains.",
    explanation: "Cold weather stress triggers the disease.",
    signs: "Pneumonia."
  },
  {
    animal: "Sheep / Goat",
    disease: "Anthrax",
    bestTime: "Any time.",
    explanation: "Bacteria are found in the soil.",
    signs: "Sudden death, blood oozing from mouth, eyes, nose, etc."
  }
];

export default function Vaccinations() {
  const [records, setRecords] = useState([]);
  const [animals, setAnimals] = useState([]);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("");
  const [showSchedule, setShowSchedule] = useState(true);

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
      <PageHeader title="Vaccinations" eyebrow="Immunization schedule" action={<div className="flex flex-wrap gap-2"><ExportButtons type="vaccinations" basename="vaccinations" /><button className="btn-primary" onClick={() => setEditing(emptyRecord)}><Plus className="h-4 w-4" /> Add vaccine</button></div>} />
      <section className="card mb-5 p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-field-sage text-farm-800">
              <ShieldPlus className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-black text-farm-950">Goat & Sheep Vaccination Schedule</h2>
              <p className="mt-1 text-sm text-slate-500">Reference schedule from your uploaded certificate. Confirm dates and doses with your vet.</p>
            </div>
          </div>
          <button className="btn-muted" onClick={() => setShowSchedule((value) => !value)}>
            {showSchedule ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {showSchedule ? "Hide" : "Show"}
          </button>
        </div>
        {showSchedule && (
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {sheepGoatSchedule.map((item) => (
              <ScheduleCard key={`${item.animal}-${item.disease}`} item={item} onUse={() => setEditing(scheduleToRecord(item))} />
            ))}
          </div>
        )}
      </section>
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
          { key: "totalCost", label: "Cost", render: (row) => currency.format(row.totalCost || 0) },
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

function scheduleToRecord(item) {
  return {
    ...emptyRecord,
    vaccineName: item.disease,
    status: "upcoming",
    dateGiven: "",
    notes: `Schedule: ${item.animal}. Best time: ${item.bestTime} Explanation: ${item.explanation} Signs: ${item.signs}${item.notes ? ` Notes: ${item.notes}` : ""}`
  };
}

function ScheduleCard({ item, onUse }) {
  return (
    <article className="rounded-lg border border-farm-100 bg-field-cream p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="label">{item.animal}</div>
          <h3 className="mt-1 font-black text-farm-950">{item.disease}</h3>
        </div>
        <button className="btn-muted py-1.5 text-xs" onClick={onUse}>Use</button>
      </div>
      <div className="space-y-2 text-sm text-slate-600">
        <p><span className="font-bold text-slate-800">Best time:</span> {item.bestTime}</p>
        <p><span className="font-bold text-slate-800">Why:</span> {item.explanation}</p>
        <p><span className="font-bold text-slate-800">Signs:</span> {item.signs}</p>
        {item.notes && <p><span className="font-bold text-slate-800">Young stock:</span> {item.notes}</p>}
      </div>
    </article>
  );
}

function VaccineModal({ record, animals, onClose, onSaved }) {
  const [form, setForm] = useState(record);
  const isEdit = Boolean(record._id);
  const totalCost = Number(form.serviceCharge || 0) + Number(form.vaccineCost || 0) + Number(form.transportCost || 0) + Number(form.otherCost || 0);

  async function submit(event) {
    event.preventDefault();
    const payload = { ...form, animal: form.animal || animals[0]?._id, totalCost };
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
        <Field label="Service charge" type="number" value={form.serviceCharge || ""} onChange={(value) => setForm({ ...form, serviceCharge: value })} />
        <Field label="Vaccine cost" type="number" value={form.vaccineCost || ""} onChange={(value) => setForm({ ...form, vaccineCost: value })} />
        <Field label="Transport cost" type="number" value={form.transportCost || ""} onChange={(value) => setForm({ ...form, transportCost: value })} />
        <Field label="Other cost" type="number" value={form.otherCost || ""} onChange={(value) => setForm({ ...form, otherCost: value })} />
        <label className="space-y-1">
          <span className="label">Payment method</span>
          <select className="input" value={form.paymentMethod || "Mpesa"} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}>
            {paymentMethods.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="label">Status</span>
          <select className="input" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            {["completed", "upcoming", "overdue"].map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <div className="rounded-lg bg-field-cream p-3 text-sm font-semibold text-slate-600 sm:col-span-2">
          Service + Vaccine + Transport + Other = {currency.format(totalCost)}
        </div>
        <label className="space-y-1 sm:col-span-2">
          <span className="label">Notes</span>
          <textarea className="input min-h-20" value={form.notes || ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        </label>
        {isEdit && <div className="sm:col-span-2"><DocumentManager entityType="vaccination" entityId={record._id} /></div>}
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
