import { Droplets, Egg, Fish, Plus, Scale, Sprout, Warehouse } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import api from "../services/api";

const productOptions = [
  { value: "eggs", label: "Eggs", icon: Egg, productName: "Table Eggs", sourceType: "animal_group", unit: "egg" },
  { value: "milk", label: "Milk", icon: Droplets, productName: "Fresh Milk", sourceType: "individual_animal", unit: "litre" },
  { value: "crop_harvest", label: "Crop harvest", icon: Sprout, productName: "", sourceType: "crop", unit: "kilogram" },
  { value: "fish_harvest", label: "Fish harvest", icon: Fish, productName: "Fresh Fish", sourceType: "fish_group", unit: "kilogram" },
  { value: "other_produce", label: "Other produce", icon: Warehouse, productName: "", sourceType: "other", unit: "kilogram" }
];

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = {
  productType: "eggs", productName: "Table Eggs", sourceType: "animal_group", sourceId: "",
  productionDate: today(), session: "", quantityProduced: "", baseUnit: "egg",
  quantityDamaged: 0, quantityRejected: 0, quantityUsedInternally: 0, quantityReserved: 0,
  quantityFedToYoung: 0, storageLocation: "", expiryDate: "", qualityGrade: "", qualityNotes: "",
  fishHarvestType: "partial", fishHarvestCount: 0, totalHarvestedWeight: 0, averageWeight: 0,
  averageWeightUnit: "kg", notes: ""
};

export default function Production() {
  const [tab, setTab] = useState("overview");
  const [records, setRecords] = useState([]);
  const [overview, setOverview] = useState({ totalsByUnit: [], recent: [] });
  const [animals, setAnimals] = useState([]);
  const [groups, setGroups] = useState([]);
  const [crops, setCrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ productType: "", from: "", to: "", search: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
      const [recordResult, overviewResult, animalResult, groupResult, cropResult] = await Promise.all([
        api.get("/production", { params }), api.get("/production/overview"), api.get("/animals"),
        api.get("/animal-groups"), api.get("/crops")
      ]);
      setRecords(recordResult.data); setOverview(overviewResult.data);
      setAnimals(animalResult.data); setGroups(groupResult.data); setCrops(cropResult.data);
    } catch (error) { toast.error(error.response?.data?.message || "Could not load Production"); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  return <div className="production-page">
    <PageHeader title="Production" eyebrow="Produce before sale" action={<button className="btn-primary" onClick={() => setTab("record")}><Plus className="h-4 w-4" /> Record production</button>} />
    <div className="mb-5 flex gap-1 overflow-x-auto rounded-lg border border-farm-100 bg-white p-1 dark:border-farm-800 dark:bg-farm-950">
      {[["overview", "Overview"], ["record", "Record Production"], ["history", "Production History"]].map(([key, label]) =>
        <button key={key} onClick={() => setTab(key)} className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold ${tab === key ? "bg-farm-900 text-white" : "text-slate-600 hover:bg-farm-50 dark:text-slate-300 dark:hover:bg-farm-900"}`}>{label}</button>)}
    </div>
    {tab === "overview" && <Overview overview={overview} loading={loading} onRecord={() => setTab("record")} />}
    {tab === "record" && <ProductionForm animals={animals} groups={groups} crops={crops} onSaved={() => { setTab("history"); load(); }} />}
    {tab === "history" && <History records={records} filters={filters} setFilters={setFilters} loading={loading} />}
  </div>;
}

function Overview({ overview, loading, onRecord }) {
  if (loading) return <div className="card p-8 text-center text-slate-500">Loading production records...</div>;
  if (!overview.totalsByUnit.length) return <div className="card p-8 text-center"><Warehouse className="mx-auto h-10 w-10 text-farm-700" /><h2 className="mt-3 text-xl font-black text-farm-950 dark:text-white">No production recorded yet</h2><p className="mt-1 text-sm text-slate-500">Start with eggs, milk, a crop harvest, or a fish harvest.</p><button className="btn-primary mt-5" onClick={onRecord}>Record first production</button></div>;
  return <>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {overview.totalsByUnit.map((row) => <div className="card p-4" key={`${row.productType}-${row.baseUnit}`}>
        <div className="flex items-start justify-between"><div><div className="label">{label(row.productType)}</div><div className="mt-2 text-2xl font-black text-farm-950 dark:text-white">{formatQuantity(row.sellable, row.baseUnit)}</div><div className="mt-1 text-xs text-slate-500">Sellable quantity</div></div><Scale className="h-5 w-5 text-farm-600" /></div>
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-farm-100 pt-3 text-xs dark:border-farm-800"><Metric label="Today" value={formatQuantity(row.today, row.baseUnit)} /><Metric label="This week" value={formatQuantity(row.week, row.baseUnit)} /><Metric label="Produced" value={formatQuantity(row.produced, row.baseUnit)} /><Metric label="Excluded" value={formatQuantity(row.damaged + row.rejected + row.internal + row.reserved + row.fedToYoung, row.baseUnit)} /></div>
      </div>)}
    </div>
    <section className="mt-6"><h2 className="mb-3 text-lg font-black text-farm-950 dark:text-white">Recent production</h2><ProductionTable records={overview.recent} /></section>
  </>;
}

function ProductionForm({ animals, groups, crops, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const sources = useMemo(() => sourceOptions(form.productType, animals, groups, crops), [form.productType, animals, groups, crops]);
  const sellable = calculateSellable(form);
  const invalidQuantity = sellable < 0;

  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); }
  function chooseProduct(option) {
    setForm({ ...emptyForm, productType: option.value, productName: option.productName, sourceType: option.sourceType, baseUnit: option.unit, productionDate: today() });
  }
  async function submit(event) {
    event.preventDefault();
    if (invalidQuantity) return toast.error("Excluded quantities cannot exceed production");
    setSaving(true);
    try {
      const numericFields = ["quantityProduced", "quantityDamaged", "quantityRejected", "quantityUsedInternally", "quantityReserved", "quantityFedToYoung", "fishHarvestCount", "totalHarvestedWeight", "averageWeight"];
      const payload = { ...form };
      numericFields.forEach((field) => { payload[field] = Number(payload[field] || 0); });
      await api.post("/production", payload);
      toast.success("Production recorded"); onSaved(); setForm(emptyForm);
    } catch (error) { toast.error(error.response?.data?.message || error.response?.data?.errors?.[0]?.message || "Could not save production"); }
    finally { setSaving(false); }
  }

  return <form onSubmit={submit} className="space-y-5">
    <section className="card p-4 sm:p-5"><Step number="1" title="Select product type" />
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">{productOptions.map((option) => <button type="button" key={option.value} onClick={() => chooseProduct(option)} className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-md border p-3 text-sm font-bold ${form.productType === option.value ? "border-farm-700 bg-farm-50 text-farm-950 dark:bg-farm-900 dark:text-white" : "border-farm-100 text-slate-600 dark:border-farm-800 dark:text-slate-300"}`}><option.icon className="h-6 w-6" />{option.label}</button>)}</div>
    </section>
    <section className="card p-4 sm:p-5"><Step number="2" title="Select source" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Product name" value={form.productName} onChange={(value) => update("productName", value)} required />
        {form.sourceType === "other" ? <div className="rounded-md bg-field-mist p-3 text-sm font-semibold text-slate-600 dark:bg-farm-900 dark:text-slate-300">Other farm source</div> : <Select label={sourceLabel(form.productType)} value={form.sourceId} onChange={(value) => { const source = sources.find((item) => item.value === value); setForm((current) => ({ ...current, sourceId: value, sourceType: source?.sourceType || current.sourceType })); }} options={sources} placeholder="Select source" required />}
      </div>
    </section>
    <section className="card p-4 sm:p-5"><Step number="3" title="Enter production details" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label={dateLabel(form.productType)} type="date" value={form.productionDate} onChange={(value) => update("productionDate", value)} required />
        {(form.productType === "eggs" || form.productType === "milk") && <Select label="Session (optional)" value={form.session} onChange={(value) => update("session", value)} options={sessionOptions(form.productType)} placeholder="Not specified" />}
        {form.productType === "fish_harvest" && <Select label="Harvest type" value={form.fishHarvestType} onChange={(value) => update("fishHarvestType", value)} options={[{ value: "sample", label: "Sample harvest" }, { value: "partial", label: "Partial harvest" }, { value: "full", label: "Full harvest" }]} required />}
        <Field label={producedLabel(form.productType)} type="number" min="0" step="any" value={form.quantityProduced} onChange={(value) => update("quantityProduced", value)} required />
        <Select label="Base unit" value={form.baseUnit} onChange={(value) => update("baseUnit", value)} options={unitOptions(form.productType)} required />
        {form.productType === "fish_harvest" && <><Field label="Confirmed fish count removed" type="number" min="0" step="1" value={form.fishHarvestCount} onChange={(value) => update("fishHarvestCount", value)} /><Field label="Total harvested weight" type="number" min="0" step="any" value={form.totalHarvestedWeight} onChange={(value) => update("totalHarvestedWeight", value)} /><Field label="Average weight (optional)" type="number" min="0" step="any" value={form.averageWeight} onChange={(value) => update("averageWeight", value)} /><Select label="Average weight unit" value={form.averageWeightUnit} onChange={(value) => update("averageWeightUnit", value)} options={["g", "kg"]} /></>}
        <Field label={damageLabel(form.productType)} type="number" min="0" step="any" value={form.quantityDamaged} onChange={(value) => update("quantityDamaged", value)} />
        <Field label={rejectLabel(form.productType)} type="number" min="0" step="any" value={form.quantityRejected} onChange={(value) => update("quantityRejected", value)} />
        <Field label="Used internally" type="number" min="0" step="any" value={form.quantityUsedInternally} onChange={(value) => update("quantityUsedInternally", value)} />
        {form.productType === "eggs" && <Field label="Reserved for incubation" type="number" min="0" step="1" value={form.quantityReserved} onChange={(value) => update("quantityReserved", value)} />}
        {form.productType === "crop_harvest" && <Field label="Reserved for seed" type="number" min="0" step="any" value={form.quantityReserved} onChange={(value) => update("quantityReserved", value)} />}
        {form.productType === "other_produce" && <Field label="Reserved" type="number" min="0" step="any" value={form.quantityReserved} onChange={(value) => update("quantityReserved", value)} />}
        {form.productType === "milk" && <Field label="Fed to calves" type="number" min="0" step="any" value={form.quantityFedToYoung} onChange={(value) => update("quantityFedToYoung", value)} />}
      </div>
      <div className={`mt-5 flex items-center justify-between rounded-md border p-4 ${invalidQuantity ? "border-red-200 bg-red-50 text-red-800" : "border-farm-200 bg-field-sage text-farm-950"}`}><div><div className="label">Sellable quantity</div><div className="mt-1 text-xs">Calculated automatically</div></div><div className="text-2xl font-black">{formatQuantity(Math.max(0, sellable), form.baseUnit)}</div></div>
    </section>
    <section className="card p-4 sm:p-5"><Step number="4" title="Storage and notes" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Storage location" value={form.storageLocation} onChange={(value) => update("storageLocation", value)} /><Field label="Expiry or use-by date" type="date" value={form.expiryDate} onChange={(value) => update("expiryDate", value)} />{form.productType === "crop_harvest" && <Field label="Quality grade" value={form.qualityGrade} onChange={(value) => update("qualityGrade", value)} />}<label className="space-y-1 sm:col-span-2"><span className="label">Notes</span><textarea className="input min-h-24" value={form.notes} onChange={(event) => update("notes", event.target.value)} /></label></div>
    </section>
    <div className="sticky bottom-24 flex justify-end"><button className="btn-primary min-w-40" disabled={saving || invalidQuantity}>{saving ? "Saving..." : "Save production"}</button></div>
  </form>;
}

function History({ records, filters, setFilters, loading }) {
  return <div><div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4"><input className="input" placeholder="Search product, batch, source" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /><select className="input" value={filters.productType} onChange={(event) => setFilters({ ...filters, productType: event.target.value })}><option value="">All products</option>{productOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><Field label="From" type="date" value={filters.from} onChange={(value) => setFilters({ ...filters, from: value })} /><Field label="To" type="date" value={filters.to} onChange={(value) => setFilters({ ...filters, to: value })} /></div>{loading ? <div className="card p-8 text-center text-slate-500">Loading history...</div> : <ProductionTable records={records} />}</div>;
}

function ProductionTable({ records }) {
  return <DataTable rows={records} emptyText="No production records match this view." columns={[
    { key: "productionDate", label: "Date", render: (row) => new Date(row.productionDate).toLocaleDateString() },
    { key: "productName", label: "Product", render: (row) => <div><div className="font-black text-farm-950 dark:text-white">{row.productName}</div><div className="text-xs text-slate-500">{row.batchReference}</div></div> },
    { key: "sourceLabel", label: "Source" },
    { key: "quantityProduced", label: "Produced", render: (row) => formatQuantity(row.quantityProduced, row.baseUnit) },
    { key: "quantitySellable", label: "Sellable", render: (row) => <span className="font-black text-farm-800 dark:text-field-lime">{formatQuantity(row.quantitySellable, row.baseUnit)}</span> },
    { key: "storageLocation", label: "Storage", render: (row) => row.storageLocation || "Not set" },
    { key: "status", label: "Status", render: (row) => <span className={`badge ${row.status === "active" ? "bg-farm-50 text-farm-700" : "bg-slate-100 text-slate-600"}`}>{label(row.status)}</span> }
  ]} />;
}

function sourceOptions(type, animals, groups, crops) {
  if (type === "eggs") return groups.filter((item) => item.category === "poultry" && item.lifecycleStatus === "active").map((item) => ({ value: item._id, label: `${item.groupId} - ${item.groupName}` }));
  if (type === "milk") return [...animals.filter((item) => item.lifecycleStatus === "active").map((item) => ({ value: item._id, label: `${item.animalId} - ${item.name || item.species}`, sourceType: "individual_animal" })), ...groups.filter((item) => item.lifecycleStatus === "active").map((item) => ({ value: item._id, label: `${item.groupId} - ${item.groupName}`, sourceType: "animal_group" }))];
  if (type === "crop_harvest") return crops.map((item) => ({ value: item._id, label: `${item.name} - ${item.plot || item.field}` }));
  if (type === "fish_harvest") return groups.filter((item) => item.category === "fish" && item.lifecycleStatus === "active").map((item) => ({ value: item._id, label: `${item.groupId} - ${item.groupName}` }));
  return [];
}

function calculateSellable(form) { return Number(form.quantityProduced || 0) - [form.quantityDamaged, form.quantityRejected, form.quantityUsedInternally, form.quantityReserved, form.quantityFedToYoung].reduce((sum, value) => sum + Number(value || 0), 0); }
function sourceLabel(type) { return type === "eggs" ? "Poultry flock" : type === "milk" ? "Animal" : type === "crop_harvest" ? "Crop or field" : "Fish group, pond, tank, or cage"; }
function dateLabel(type) { return type === "eggs" ? "Collection date" : type === "milk" ? "Milking date" : "Harvest date"; }
function producedLabel(type) { return type === "eggs" ? "Total eggs collected" : type === "milk" ? "Total milk produced" : type === "crop_harvest" ? "Total harvested quantity" : "Sellable-unit quantity harvested"; }
function damageLabel(type) { return type === "eggs" ? "Cracked or damaged eggs" : type === "milk" ? "Spoiled milk" : "Damaged quantity"; }
function rejectLabel(type) { return type === "milk" ? "Rejected milk" : type === "fish_harvest" ? "Rejected or spoiled quantity" : "Rejected or low-grade quantity"; }
function sessionOptions(type) { return type === "milk" ? ["Morning", "Afternoon", "Evening", "Other"] : ["Morning", "Midday", "Evening", "Other"]; }
function unitOptions(type) { if (type === "eggs") return ["egg"]; if (type === "milk") return ["litre", "millilitre"]; if (type === "fish_harvest") return ["kilogram", "piece"]; return ["kilogram", "tonne", "bag", "crate", "piece", "other"]; }
function formatQuantity(value, unit) { return `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })} ${label(unit)}${Number(value) === 1 ? "" : unit === "fish" ? "" : "s"}`; }
function label(value) { return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function Step({ number, title }) { return <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-farm-900 text-sm font-black text-white">{number}</span><h2 className="text-lg font-black text-farm-950 dark:text-white">{title}</h2></div>; }
function Metric({ label: text, value }) { return <div><div className="text-slate-400">{text}</div><div className="mt-0.5 font-black text-farm-950 dark:text-white">{value}</div></div>; }
function Field({ label: text, value, onChange, type = "text", required, min, step }) { return <label className="space-y-1"><span className="label">{text}</span><input className="input" type={type} value={value ?? ""} required={required} min={min} step={step} onChange={(event) => onChange(event.target.value)} /></label>; }
function Select({ label: text, value, onChange, options, placeholder, required }) { return <label className="space-y-1"><span className="label">{text}</span><select className="input" value={value} required={required} onChange={(event) => onChange(event.target.value)}>{placeholder && <option value="">{placeholder}</option>}{options.map((option) => { const item = typeof option === "string" ? { value: option, label: label(option) } : option; return <option key={item.value} value={item.value}>{item.label}</option>; })}</select></label>; }
