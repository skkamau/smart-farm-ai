import { Baby, Beef, Boxes, Edit, Eye, FileText, HeartHandshake, Plus, ShieldPlus, Trash2, UsersRound } from "lucide-react";
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
const emptyGroup = { groupId: "", groupName: "", category: "poultry", species: "Chicken", breedOrStrain: "", productionPurpose: "", startingQuantity: "", quantityType: "confirmed", quantityConfidence: "not_applicable", hatchStockingOrArrivalDate: "", locationType: "poultry_house", locationName: "", averageWeight: "", averageWeightUnit: "kg", purchaseCost: "", estimatedValue: "", supplierOrSource: "", healthStatus: "unknown", notes: "" };
const groupCategories = ["poultry", "fish", "rabbits", "bees", "other"];
const locationTypes = ["poultry_house", "coop", "pond", "tank", "cage", "hutch", "apiary", "other"];

export default function Animals() {
  const [animals, setAnimals] = useState([]);
  const [groups, setGroups] = useState([]);
  const [editing, setEditing] = useState(null);
  const [groupEditing, setGroupEditing] = useState(null);
  const [addMode, setAddMode] = useState(false);
  const [view, setView] = useState("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const navigate = useNavigate();

  function load() {
    Promise.all([api.get("/animals"), api.get("/animal-groups")])
      .then(([animalResponse, groupResponse]) => { setAnimals(animalResponse.data); setGroups(groupResponse.data); })
      .catch(() => toast.error("Could not load animal records"));
  }

  useEffect(load, []);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return animals.filter((animal) => (!statusFilter || animal.lifecycleStatus === statusFilter) && [animal.animalId, animal.name, animal.species, animal.breed, animal.lifecycleStatus, animal.healthStatus, animal.reproductiveStatus].join(" ").toLowerCase().includes(term));
  }, [animals, search, statusFilter]);

  const filteredGroups = useMemo(() => {
    const term = search.toLowerCase();
    return groups.filter((group) => (!statusFilter || group.lifecycleStatus === statusFilter) && [group.groupId, group.groupName, group.species, group.breedOrStrain, group.locationName, group.healthStatus].join(" ").toLowerCase().includes(term));
  }, [groups, search, statusFilter]);

  async function remove(id) {
    if (!confirm("Delete this animal record?")) return;
    await api.delete(`/animals/${id}`);
    toast.success("Animal deleted");
    load();
  }

  return (
    <div>
      <PageHeader title="Animals" eyebrow="Individuals and managed groups" action={<div className="flex flex-wrap gap-2"><ExportButtons type="animals" basename="animals" /><button className="btn-primary" onClick={() => setAddMode(true)}><Plus className="h-4 w-4" /> Add animals</button></div>} />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <AnimalToolCard to="/animals" label="All Animals" icon={Beef} />
        <AnimalToolCard to="/vaccinations" label="Vaccines" icon={ShieldPlus} />
        <AnimalToolCard to="/breeding" label="Breeding" icon={HeartHandshake} />
        <AnimalToolCard to="/births" label="Births" icon={Baby} />
        <AnimalToolCard to="/reports" label="Reports" icon={FileText} />
      </div>
      <div className="mb-4 flex w-full gap-1 overflow-x-auto rounded-lg border border-farm-100 bg-white p-1 sm:w-fit">
        {[['all', 'All'], ['individuals', `Individuals (${animals.length})`], ['groups', `Groups (${groups.length})`]].map(([key, label]) => (
          <button key={key} className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold ${view === key ? "bg-farm-900 text-white" : "text-slate-600 hover:bg-farm-50"}`} onClick={() => setView(key)}>{label}</button>
        ))}
      </div>
      <div className="mb-4 grid gap-3 sm:max-w-3xl sm:grid-cols-[1fr_220px]">
        <input className="input" placeholder="Search by ID, name, species, breed, or status" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All animals</option>{lifecycleStatuses.map((status) => <option key={status} value={status}>{labelStatus(status)}</option>)}</select>
      </div>
      {(view === "all" || view === "individuals") && <section className="mb-6">
      {view === "all" && <h2 className="mb-3 text-base font-black text-farm-950">Individual animals</h2>}
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
      </section>}
      {(view === "all" || view === "groups") && <section>
        {view === "all" && <h2 className="mb-3 text-base font-black text-farm-950">Groups and batches</h2>}
        <DataTable
          rows={filteredGroups}
          emptyText="No animal groups or batches yet."
          columns={[
            { key: "groupId", label: "Group", render: (row) => <div><div className="font-black text-farm-950">{row.groupId}</div><div className="text-xs text-slate-500">{row.groupName}</div></div> },
            { key: "species", label: "Species / strain", render: (row) => <div>{row.species}<div className="text-xs text-slate-500">{row.breedOrStrain || "Not set"}</div></div> },
            { key: "currentQuantity", label: "Current quantity", render: (row) => <div><span className="text-base font-black">{Number(row.currentQuantity).toLocaleString()}</span><div className="text-xs text-slate-500">{labelStatus(row.quantityType)}</div></div> },
            { key: "locationName", label: "Location", render: (row) => row.locationName || labelStatus(row.locationType) },
            { key: "healthStatus", label: "Health", render: (row) => <Status value={row.healthStatus} /> },
            { key: "averageWeight", label: "Weight / biomass", render: (row) => row.category === "fish" ? `${row.estimatedBiomass || 0} kg biomass` : `${row.averageWeight || 0} ${row.averageWeightUnit}` }
          ]}
          actions={(row) => <button className="btn-muted px-2" onClick={() => navigate(`/groups/${row._id}`)} aria-label="View group"><Eye className="h-4 w-4" /></button>}
        />
      </section>}
      {editing && <AnimalModal animal={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {groupEditing && <GroupModal group={groupEditing} onClose={() => setGroupEditing(null)} onSaved={(group) => { setGroupEditing(null); load(); navigate(`/groups/${group._id}`); }} />}
      {addMode && <TrackingModeModal onClose={() => setAddMode(false)} onChoose={(mode) => { setAddMode(false); mode === "individual" ? setEditing(emptyAnimal) : setGroupEditing(emptyGroup); }} />}
    </div>
  );
}

function TrackingModeModal({ onClose, onChoose }) {
  return <CrudModal title="How do you track these animals?" onClose={onClose}>
    <div className="grid gap-4 sm:grid-cols-2">
      <button className="rounded-lg border border-farm-100 p-5 text-left transition hover:border-farm-600 hover:bg-farm-50" onClick={() => onChoose("individual")}>
        <Beef className="h-7 w-7 text-farm-700" /><div className="mt-4 font-black text-farm-950">Individual Animal</div><p className="mt-1 text-sm text-slate-600">For cattle, goats, sheep, pigs, breeding stock, and tagged animals.</p>
      </button>
      <button className="rounded-lg border border-farm-100 p-5 text-left transition hover:border-farm-600 hover:bg-farm-50" onClick={() => onChoose("group")}>
        <UsersRound className="h-7 w-7 text-farm-700" /><div className="mt-4 font-black text-farm-950">Animal Group / Batch</div><p className="mt-1 text-sm text-slate-600">For poultry flocks, fish ponds, rabbit colonies, bee colonies, and other large groups.</p>
      </button>
    </div>
  </CrudModal>;
}

function GroupModal({ group, onClose, onSaved }) {
  const [form, setForm] = useState(group);
  const [saving, setSaving] = useState(false);
  const isFish = form.category === "fish";

  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); }
  function setCategory(category) {
    const defaults = category === "fish" ? { species: "Tilapia", locationType: "pond", quantityType: "estimated", quantityConfidence: "medium", averageWeightUnit: "g" } : category === "rabbits" ? { species: "Rabbit", locationType: "hutch", quantityType: "confirmed", quantityConfidence: "not_applicable" } : category === "bees" ? { species: "Honey bee", locationType: "apiary", quantityType: "estimated", quantityConfidence: "medium" } : { species: "Chicken", locationType: "poultry_house", quantityType: "confirmed", quantityConfidence: "not_applicable" };
    setForm((current) => ({ ...current, category, ...defaults }));
  }
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, startingQuantity: Number(form.startingQuantity), averageWeight: Number(form.averageWeight || 0), purchaseCost: Number(form.purchaseCost || 0), estimatedValue: Number(form.estimatedValue || 0) };
      const { data } = await api.post("/animal-groups", payload);
      toast.success("Animal group created"); onSaved(data);
    } catch (error) { toast.error(error.response?.data?.message || "Could not create group"); }
    finally { setSaving(false); }
  }
  return <CrudModal title="Add Animal Group / Batch" onClose={onClose}>
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2 grid grid-cols-2 gap-2 sm:grid-cols-5">{groupCategories.map((category) => <button type="button" key={category} className={`rounded-md border px-3 py-2 text-sm font-bold ${form.category === category ? "border-farm-700 bg-farm-50 text-farm-900" : "border-slate-200 text-slate-600"}`} onClick={() => setCategory(category)}>{labelStatus(category)}</button>)}</div>
      <Field label="Group ID (optional)" value={form.groupId} onChange={(v) => update("groupId", v)} /><Field label="Group name" value={form.groupName} onChange={(v) => update("groupName", v)} required />
      <Field label="Species" value={form.species} onChange={(v) => update("species", v)} required /><Field label="Breed or strain" value={form.breedOrStrain} onChange={(v) => update("breedOrStrain", v)} />
      <Field label="Production purpose" value={form.productionPurpose} onChange={(v) => update("productionPurpose", v)} /><Field label="Starting quantity" type="number" min="1" value={form.startingQuantity} onChange={(v) => update("startingQuantity", v)} required />
      <Select label="Quantity type" value={form.quantityType} onChange={(v) => update("quantityType", v)} options={["confirmed", "estimated"]} />
      {(isFish || form.quantityType === "estimated") && <Select label="Quantity confidence" value={form.quantityConfidence} onChange={(v) => update("quantityConfidence", v)} options={["high", "medium", "low"]} />}
      <Field label="Hatch, stocking or arrival date" type="date" value={form.hatchStockingOrArrivalDate} onChange={(v) => update("hatchStockingOrArrivalDate", v)} />
      <Select label="Location type" value={form.locationType} onChange={(v) => update("locationType", v)} options={locationTypes} />
      <Field label="Location name" value={form.locationName} onChange={(v) => update("locationName", v)} /><Field label={`Average weight (${form.averageWeightUnit})`} type="number" min="0" value={form.averageWeight} onChange={(v) => update("averageWeight", v)} />
      <Select label="Weight unit" value={form.averageWeightUnit} onChange={(v) => update("averageWeightUnit", v)} options={["g", "kg"]} />
      <Field label="Purchase cost / opening value" type="number" min="0" value={form.purchaseCost} onChange={(v) => update("purchaseCost", v)} />
      <Field label="Estimated current value" type="number" min="0" value={form.estimatedValue} onChange={(v) => update("estimatedValue", v)} /><Field label="Supplier or source" value={form.supplierOrSource} onChange={(v) => update("supplierOrSource", v)} />
      <label className="space-y-1 sm:col-span-2"><span className="label">Notes</span><textarea className="input min-h-24" value={form.notes} onChange={(e) => update("notes", e.target.value)} /></label>
      <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="btn-muted" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={saving}><Boxes className="h-4 w-4" /> {saving ? "Creating..." : "Create group"}</button></div>
    </form>
  </CrudModal>;
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

function Field({ label, value, onChange, type = "text", required, min }) {
  return <label className="space-y-1"><span className="label">{label}</span><input className="input" type={type} min={min} value={value ?? ""} onChange={(event) => onChange(event.target.value)} required={required} /></label>;
}

function Select({ label, value, onChange, options, disabled }) {
  return <label className="space-y-1"><span className="label">{label}</span><select className="input" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{labelStatus(option)}</option>)}</select></label>;
}

function labelStatus(value) { return String(value || "unknown").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
