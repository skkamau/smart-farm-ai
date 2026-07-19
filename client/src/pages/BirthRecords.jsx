import { Baby, ChevronDown, Edit, Link2, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import CrudModal from "../components/CrudModal";
import DataTable from "../components/DataTable";
import ExportButtons from "../components/ExportButtons";
import PageHeader from "../components/PageHeader";
import api from "../services/api";
import { formatDate, inputDate } from "../utils";

const MAX_OFFSPRING = 20;
const healthStatuses = ["unknown", "healthy", "sick", "recovering", "chronic", "referred"];
const lifecycleStatuses = ["active", "sold", "transferred", "archived", "deceased"];

function submissionKey() {
  return globalThis.crypto?.randomUUID?.() || `birth-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function suggestedAnimalId() {
  const token = globalThis.crypto?.randomUUID?.().slice(0, 8) || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  return `OFF-${token.toUpperCase()}`;
}

function offspringTemplate(mother) {
  return {
    animalId: suggestedAnimalId(),
    name: "",
    gender: "Unknown",
    species: mother?.species || "",
    breed: mother?.breed || "",
    birthWeight: "",
    weightUnit: "kg",
    healthStatus: "unknown",
    lifecycleStatus: "active",
    distinguishingMarks: "",
    notes: ""
  };
}

function newBirthRecord() {
  return {
    mother: "",
    father: "",
    birthDate: inputDate(new Date()),
    numberOfOffspring: 1,
    offspringMode: "create",
    offspring: [],
    newOffspring: [offspringTemplate()],
    birthComplications: "",
    vetNotes: "",
    notes: "",
    submissionKey: submissionKey()
  };
}

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
    if (!confirm("Delete this birth record? Existing animal records and parent links will be preserved.")) return;
    await api.delete(`/birth-records/${id}`);
    toast.success("Birth record deleted");
    load();
  }

  function editRecord(row) {
    setEditing({
      ...row,
      mother: row.mother?._id || row.mother,
      father: row.father?._id || row.father || "",
      fatherKnown: Boolean(row.father),
      offspringMode: "link",
      offspring: (row.offspring || []).map((animal) => animal._id || animal),
      newOffspring: [],
      birthDate: inputDate(row.birthDate)
    });
  }

  return (
    <div>
      <PageHeader
        title="Birth Records"
        eyebrow="Offspring and parent linking"
        action={<div className="flex flex-wrap gap-2"><ExportButtons type="births" basename="birth_records" /><ExportButtons type="family" basename="parent_children_records" pdf={false} /><button className="btn-primary" onClick={() => setEditing(newBirthRecord())}><Plus className="h-4 w-4" /> Add birth</button></div>}
      />
      <DataTable
        rows={records}
        emptyText="No birth records yet."
        columns={[
          { key: "birthDate", label: "Birth date", render: (row) => formatDate(row.birthDate) },
          { key: "mother", label: "Mother", render: (row) => animalLabel(row.mother) },
          { key: "father", label: "Father", render: (row) => row.father ? animalLabel(row.father) : "Unknown" },
          { key: "numberOfOffspring", label: "Offspring #" },
          { key: "offspring", label: "Offspring", render: (row) => (row.offspring || []).map(animalLabel).join(", ") || "Not linked" }
        ]}
        actions={(row) => (
          <div className="flex justify-end gap-2">
            <button className="btn-muted px-2" onClick={() => editRecord(row)} aria-label="Edit birth"><Edit className="h-4 w-4" /></button>
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
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(record._id);
  const mother = animals.find((animal) => animal._id === form.mother);

  const motherOptions = useMemo(() => animals.filter((animal) => animal.gender !== "Male" || animal._id === form.mother), [animals, form.mother]);
  const fatherOptions = useMemo(() => animals.filter((animal) => {
    if (animal._id === form.father) return true;
    if (animal.gender === "Female" || animal._id === form.mother) return false;
    return !mother?.species || animal.species?.toLowerCase() === mother.species.toLowerCase();
  }), [animals, form.father, form.mother, mother?.species]);

  function setMother(value) {
    const selected = animals.find((animal) => animal._id === value);
    const fatherStillCompatible = !form.father || animals.some((animal) => animal._id === form.father && animal._id !== value && (!selected?.species || animal.species?.toLowerCase() === selected.species.toLowerCase()));
    setForm((current) => ({
      ...current,
      mother: value,
      father: fatherStillCompatible ? current.father : "",
      newOffspring: (current.newOffspring || []).map((offspring) => ({ ...offspring, species: selected?.species || offspring.species, breed: selected?.breed || offspring.breed }))
    }));
  }

  function changeCount(rawValue) {
    const next = Math.max(1, Math.min(MAX_OFFSPRING, Number(rawValue || 1)));
    const current = Number(form.numberOfOffspring || 1);
    if (form.offspringMode === "create" && next < current && !confirm(`Remove ${current - next} offspring form${current - next === 1 ? "" : "s"}? Information entered in those forms will be lost.`)) return;
    setForm((value) => {
      if (value.offspringMode !== "create") return { ...value, numberOfOffspring: next };
      const offspring = [...(value.newOffspring || [])];
      while (offspring.length < next) offspring.push(offspringTemplate(mother));
      return { ...value, numberOfOffspring: next, newOffspring: offspring.slice(0, next) };
    });
  }

  function setMode(mode) {
    if (mode === form.offspringMode) return;
    if (mode === "create" && form.offspring?.length && !confirm("Switch to creating new offspring? Existing selections will remain saved until you submit.")) return;
    setForm((current) => {
      const newOffspring = mode === "create" && !current.newOffspring?.length
        ? Array.from({ length: Number(current.numberOfOffspring || 1) }, () => offspringTemplate(mother))
        : current.newOffspring;
      return { ...current, offspringMode: mode, newOffspring };
    });
  }

  function updateOffspring(index, field, value) {
    setForm((current) => ({ ...current, newOffspring: current.newOffspring.map((offspring, itemIndex) => itemIndex === index ? { ...offspring, [field]: value } : offspring) }));
  }

  function validate() {
    const next = {};
    if (!form.mother) next.mother = "Choose a mother";
    if (form.father && form.father === form.mother) next.father = "Mother and father cannot be the same animal";
    if (!form.birthDate) next.birthDate = "Enter a birth date";
    else if (new Date(form.birthDate) > new Date()) next.birthDate = "Birth date cannot be in the future";
    if (Number(form.numberOfOffspring) < 1 || Number(form.numberOfOffspring) > MAX_OFFSPRING) next.numberOfOffspring = `Enter a value from 1 to ${MAX_OFFSPRING}`;
    if (form.offspringMode === "create") {
      if ((form.newOffspring || []).length !== Number(form.numberOfOffspring)) next.offspring = "The offspring record count must match the number of offspring";
      const ids = form.newOffspring.map((animal) => animal.animalId.trim().toLowerCase());
      if (ids.some((value) => !value)) next.offspring = "Every offspring needs an animal ID";
      else if (new Set(ids).size !== ids.length) next.offspring = "Offspring animal IDs must be unique";
      form.newOffspring.forEach((animal, index) => {
        if (!animal.species.trim()) next[`species-${index}`] = "Species is required";
        if (animal.birthWeight !== "" && Number(animal.birthWeight) < 0) next[`weight-${index}`] = "Birth weight cannot be negative";
      });
    } else if ((form.offspring || []).length !== Number(form.numberOfOffspring)) {
      next.offspring = `Select exactly ${form.numberOfOffspring} offspring animal${Number(form.numberOfOffspring) === 1 ? "" : "s"}`;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event) {
    event.preventDefault();
    if (!validate()) return;
    if (isEdit && (record.mother !== form.mother || (record.father || "") !== (form.father || "")) && !confirm("Change the parent relationship for this birth record? Linked offspring profiles will be updated.")) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        father: form.father || null,
        fatherKnown: Boolean(form.father),
        numberOfOffspring: Number(form.numberOfOffspring),
        offspring: form.offspringMode === "link" ? form.offspring : [],
        newOffspring: form.offspringMode === "create" ? form.newOffspring.map((animal) => ({ ...animal, birthWeight: animal.birthWeight === "" ? null : Number(animal.birthWeight) })) : []
      };
      if (isEdit) await api.put(`/birth-records/${record._id}`, payload);
      else await api.post("/birth-records", payload);
      toast.success(isEdit ? "Birth record updated" : "Birth and offspring records saved");
      onSaved();
    } catch (error) {
      const serverErrors = error.response?.data?.errors || [];
      setErrors(Object.fromEntries(serverErrors.map((item) => [item.field, item.message])));
      toast.error(error.response?.data?.message || "Could not save the birth record");
    } finally { setSaving(false); }
  }

  return (
    <CrudModal title={isEdit ? "Edit Birth Record" : "Add Birth Record"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <FormSection number="1" title="Parents" description="Select the mother and record the father when known.">
          <div className="grid gap-4 sm:grid-cols-2">
            <SearchableAnimalSelect label="Mother" animals={motherOptions} value={form.mother} onChange={setMother} placeholder="Search female animals" error={errors.mother} required />
            <SearchableAnimalSelect label="Father" animals={fatherOptions} value={form.father} onChange={(value) => setForm({ ...form, father: value })} placeholder="Search male animals" error={errors.father} includeUnknown />
          </div>
        </FormSection>

        <FormSection number="2" title="Birth Details" description="The birth date is copied to newly created offspring.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Birth date" type="date" value={form.birthDate} onChange={(value) => setForm({ ...form, birthDate: value })} error={errors.birthDate} required />
            <Field label="Number of offspring" type="number" min="1" max={MAX_OFFSPRING} value={form.numberOfOffspring} onChange={changeCount} error={errors.numberOfOffspring} required />
          </div>
        </FormSection>

        <FormSection number="3" title="Offspring Records" description="Create animal records now or link animals already in your farm.">
          <div className="grid grid-cols-2 gap-2 rounded-md bg-slate-100 p-1">
            <ModeButton active={form.offspringMode === "create"} onClick={() => setMode("create")} icon={Baby}>Create new offspring</ModeButton>
            <ModeButton active={form.offspringMode === "link"} onClick={() => setMode("link")} icon={Link2}>Link existing animals</ModeButton>
          </div>
          {errors.offspring && <FieldError>{errors.offspring}</FieldError>}
          {form.offspringMode === "create"
            ? <div className="mt-4 space-y-3">{form.newOffspring.map((offspring, index) => <OffspringCard key={`${index}-${offspring.animalId}`} index={index} offspring={offspring} errors={errors} onChange={(field, value) => updateOffspring(index, field, value)} />)}</div>
            : <ExistingOffspringPicker animals={animals} mother={mother} parentIds={[form.mother, form.father]} birthDate={form.birthDate} selected={form.offspring || []} onChange={(offspring) => setForm({ ...form, offspring })} />}
        </FormSection>

        <FormSection number="4" title="Birth Notes" description="Record complications and veterinary observations.">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextArea label="Birth complications" value={form.birthComplications || ""} onChange={(value) => setForm({ ...form, birthComplications: value })} />
            <TextArea label="Vet notes" value={form.vetNotes || ""} onChange={(value) => setForm({ ...form, vetNotes: value })} />
            <div className="sm:col-span-2"><TextArea label="Additional notes" value={form.notes || ""} onChange={(value) => setForm({ ...form, notes: value })} /></div>
          </div>
        </FormSection>

        <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <button type="button" className="btn-muted" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save birth"}</button>
        </div>
      </form>
    </CrudModal>
  );
}

function FormSection({ number, title, description, children }) {
  return <section className="rounded-lg border border-slate-200 p-4"><div className="mb-4 flex items-start gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-farm-900 text-xs font-black text-white">{number}</span><div><h3 className="font-black text-farm-950">{title}</h3><p className="mt-0.5 text-sm text-slate-500">{description}</p></div></div>{children}</section>;
}

function ModeButton({ active, onClick, icon: Icon, children }) {
  return <button type="button" onClick={onClick} className={`flex min-h-12 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-bold ${active ? "bg-white text-farm-950 shadow-sm" : "text-slate-500"}`}><Icon className="h-4 w-4" />{children}</button>;
}

function OffspringCard({ index, offspring, errors, onChange }) {
  return (
    <details className="rounded-lg border border-slate-200 bg-white" open={index === 0}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4"><div><div className="font-black text-farm-950">Offspring {index + 1}</div><div className="text-xs text-slate-500">{offspring.animalId || "Animal ID needed"} · {labelStatus(offspring.gender)}</div></div><ChevronDown className="h-4 w-4 text-slate-400" /></summary>
      <div className="grid gap-4 border-t border-slate-100 p-4 sm:grid-cols-2">
        <Field label="Animal ID or tag" value={offspring.animalId} onChange={(value) => onChange("animalId", value)} required />
        <Field label="Name (optional)" value={offspring.name} onChange={(value) => onChange("name", value)} />
        <Select label="Sex" value={offspring.gender} onChange={(value) => onChange("gender", value)} options={["Male", "Female", "Unknown"]} />
        <Field label="Species" value={offspring.species} onChange={(value) => onChange("species", value)} error={errors[`species-${index}`]} required />
        <Field label="Breed" value={offspring.breed} onChange={(value) => onChange("breed", value)} />
        <div className="grid grid-cols-[1fr_6rem] gap-2"><Field label="Birth weight" type="number" min="0" step="any" value={offspring.birthWeight} onChange={(value) => onChange("birthWeight", value)} error={errors[`weight-${index}`]} /><Select label="Unit" value={offspring.weightUnit} onChange={(value) => onChange("weightUnit", value)} options={["kg", "g", "lb"]} /></div>
        <Select label="Health at birth" value={offspring.healthStatus} onChange={(value) => onChange("healthStatus", value)} options={healthStatuses} />
        <Select label="Lifecycle status" value={offspring.lifecycleStatus} onChange={(value) => onChange("lifecycleStatus", value)} options={lifecycleStatuses} />
        <Field label="Colour or distinguishing marks" value={offspring.distinguishingMarks} onChange={(value) => onChange("distinguishingMarks", value)} />
        <Field label="Notes" value={offspring.notes} onChange={(value) => onChange("notes", value)} />
      </div>
    </details>
  );
}

function ExistingOffspringPicker({ animals, mother, parentIds, birthDate, selected, onChange }) {
  const [search, setSearch] = useState("");
  const candidates = useMemo(() => animals.filter((animal) => {
    if (parentIds.includes(animal._id)) return false;
    if (mother?.species && animal.species?.toLowerCase() !== mother.species.toLowerCase()) return false;
    if (birthDate && animal.dateOfBirth && inputDate(animal.dateOfBirth) > birthDate) return false;
    const term = search.toLowerCase();
    return !term || [animal.animalId, animal.name, animal.species, animal.gender].some((value) => String(value || "").toLowerCase().includes(term));
  }), [animals, birthDate, mother?.species, parentIds, search]);
  const selectedAnimals = selected.map((animalId) => animals.find((animal) => animal._id === animalId)).filter(Boolean);
  function toggle(animalId) {
    if (selected.includes(animalId) && !confirm("Unlink this offspring from the birth record? The animal record itself will be preserved.")) return;
    onChange(selected.includes(animalId) ? selected.filter((value) => value !== animalId) : [...selected, animalId]);
  }
  return (
    <div className="mt-4 space-y-3">
      <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input className="input pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search animal ID, name, species or sex" /></div>
      {selectedAnimals.length > 0 && <div className="flex flex-wrap gap-2">{selectedAnimals.map((animal) => <button type="button" key={animal._id} onClick={() => toggle(animal._id)} className="inline-flex items-center gap-1 rounded-full bg-farm-100 px-3 py-1 text-xs font-bold text-farm-800">{animal.animalId}<X className="h-3 w-3" /></button>)}</div>}
      <div className="max-h-56 space-y-1 overflow-auto rounded-lg border border-slate-200 p-2">
        {candidates.map((animal) => <label key={animal._id} className="flex cursor-pointer items-center gap-3 rounded-md p-2 text-sm hover:bg-slate-50"><input type="checkbox" checked={selected.includes(animal._id)} onChange={() => toggle(animal._id)} /><span><strong>{animal.animalId}</strong>{animal.name ? ` · ${animal.name}` : ""}<span className="block text-xs text-slate-500">{animal.species} · {labelStatus(animal.gender)}</span></span></label>)}
        {!candidates.length && <div className="p-4 text-center text-sm text-slate-500">No compatible animals found.</div>}
      </div>
    </div>
  );
}

function SearchableAnimalSelect({ label, animals, value, onChange, placeholder, error, includeUnknown, required }) {
  const [search, setSearch] = useState("");
  const visible = animals.filter((animal) => !search || animalLabel(animal).toLowerCase().includes(search.toLowerCase()) || animal.breed?.toLowerCase().includes(search.toLowerCase()));
  return <label className="space-y-1"><span className="label">{label}</span><div className="relative mb-2"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input className="input pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={placeholder} /></div><select className="input" value={value || ""} onChange={(event) => onChange(event.target.value)} required={required}>{includeUnknown ? <option value="">Unknown / Not recorded</option> : <option value="">Select animal</option>}{visible.map((animal) => <option key={animal._id} value={animal._id}>{animalOptionLabel(animal)}</option>)}</select>{error && <FieldError>{error}</FieldError>}</label>;
}

function animalLabel(animal) { return animal ? `${animal.animalId} - ${animal.name || animal.species}` : "Not set"; }
function animalOptionLabel(animal) { return [animal.animalId, animal.name, animal.species, animal.breed].filter(Boolean).join(" · "); }
function labelStatus(value) { return String(value || "unknown").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function FieldError({ children }) { return <p className="mt-1 text-xs font-semibold text-red-600">{children}</p>; }
function Field({ label, value, onChange, type = "text", required, min, max, step, error }) { return <label className="space-y-1"><span className="label">{label}</span><input className="input" type={type} min={min} max={max} step={step} value={value ?? ""} onChange={(event) => onChange(event.target.value)} required={required} />{error && <FieldError>{error}</FieldError>}</label>; }
function Select({ label, value, onChange, options }) { return <label className="space-y-1"><span className="label">{label}</span><select className="input" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{labelStatus(option)}</option>)}</select></label>; }
function TextArea({ label, value, onChange }) { return <label className="space-y-1"><span className="label">{label}</span><textarea className="input min-h-24" value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
