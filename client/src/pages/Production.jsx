import { ArrowRightLeft, CreditCard, Download, Droplets, Edit, Egg, Eye, Fish, MinusCircle, Plus, Scale, ShoppingCart, Sprout, Trash2, Warehouse, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import DataTable from "../components/DataTable";
import CrudModal from "../components/CrudModal";
import PageHeader from "../components/PageHeader";
import api from "../services/api";
import { saveBlob } from "../utils/downloads";
import { useAuth } from "../context/AuthContext";

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
  const [available, setAvailable] = useState([]);
  const [removals, setRemovals] = useState([]);
  const [sales, setSales] = useState([]);
  const [report, setReport] = useState({ rows: [], production: [], sales: [] });
  const [overview, setOverview] = useState({ totalsByUnit: [], recent: [] });
  const [animals, setAnimals] = useState([]);
  const [groups, setGroups] = useState([]);
  const [crops, setCrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ productType: "", from: "", to: "", search: "" });
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [transferring, setTransferring] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [selling, setSelling] = useState(null);
  const [viewingSale, setViewingSale] = useState(null);
  const [editingSale, setEditingSale] = useState(null);
  const [payingSale, setPayingSale] = useState(null);
  const [cancellingSale, setCancellingSale] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
      const [recordResult, overviewResult, availableResult, removalResult, saleResult, reportResult, animalResult, groupResult, cropResult] = await Promise.all([
        api.get("/production", { params }), api.get("/production/overview"), api.get("/production/available"),
        api.get("/production/removals"), api.get("/produce-sales"), api.get("/produce-sales/reports/summary", { params }),
        api.get("/animals"), api.get("/animal-groups"), api.get("/crops")
      ]);
      setRecords(recordResult.data); setOverview(overviewResult.data); setAvailable(availableResult.data); setRemovals(removalResult.data);
      setSales(saleResult.data); setReport(reportResult.data);
      setAnimals(animalResult.data); setGroups(groupResult.data); setCrops(cropResult.data);
    } catch (error) { toast.error(error.response?.data?.message || "Could not load Production"); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  return <div className="production-page">
    <PageHeader title="Production" eyebrow="Produce before sale" action={<button className="btn-primary" onClick={() => setTab("record")}><Plus className="h-4 w-4" /> Record production</button>} />
    <div className="mb-5 flex gap-1 overflow-x-auto rounded-lg border border-farm-100 bg-white p-1 dark:border-farm-800 dark:bg-farm-950">
      {[["overview", "Overview"], ["record", "Record Production"], ["available", "Available Produce"], ["sales", "Sales"], ["losses", "Losses & Internal Use"], ["history", "History"], ["reports", "Reports"]].map(([key, label]) =>
        <button key={key} onClick={() => setTab(key)} className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold ${tab === key ? "bg-farm-900 text-white" : "text-slate-600 hover:bg-farm-50 dark:text-slate-300 dark:hover:bg-farm-900"}`}>{label}</button>)}
    </div>
    {tab === "overview" && <Overview overview={overview} loading={loading} onRecord={() => setTab("record")} />}
    {tab === "record" && <ProductionForm animals={animals} groups={groups} crops={crops} onSaved={() => { setTab("history"); load(); }} />}
    {tab === "available" && <AvailableProduce records={available} loading={loading} onSale={setSelling} onRemove={setRemoving} onTransfer={setTransferring} onView={setViewing} onDelete={setDeleting} />}
    {tab === "sales" && <Sales sales={sales} loading={loading} onView={setViewingSale} onEdit={setEditingSale} onPay={setPayingSale} onCancel={setCancellingSale} />}
    {tab === "losses" && <RemovalHistory movements={removals} loading={loading} />}
    {tab === "history" && <History records={records} filters={filters} setFilters={setFilters} loading={loading} onEdit={setEditing} onDelete={setDeleting} onView={setViewing} />}
    {tab === "reports" && <ProductionReports report={report} filters={filters} loading={loading} />}
    {editing && <CrudModal title={`Edit production - ${editing.batchReference}`} onClose={() => setEditing(null)}><ProductionForm initial={editing} animals={animals} groups={groups} crops={crops} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} /></CrudModal>}
    {removing && <RemovalModal record={removing} onClose={() => setRemoving(null)} onSaved={() => { setRemoving(null); load(); }} />}
    {transferring && <TransferModal record={transferring} onClose={() => setTransferring(null)} onSaved={() => { setTransferring(null); load(); }} />}
    {deleting && <DeleteProductModal record={deleting} onClose={() => setDeleting(null)} onSaved={() => { setDeleting(null); load(); }} />}
    {viewing && <BatchHistoryModal record={viewing} onClose={() => setViewing(null)} />}
    {selling && <SaleModal batch={selling} onClose={() => setSelling(null)} onSaved={() => { setSelling(null); setTab("sales"); load(); }} />}
    {editingSale && <SaleModal sale={editingSale} batch={available.find((item) => item._id === (editingSale.productionRecord?._id || editingSale.productionRecord))} onClose={() => setEditingSale(null)} onSaved={() => { setEditingSale(null); load(); }} />}
    {payingSale && <SalePaymentModal sale={payingSale} onClose={() => setPayingSale(null)} onSaved={() => { setPayingSale(null); load(); }} />}
    {cancellingSale && <CancelSaleModal sale={cancellingSale} onClose={() => setCancellingSale(null)} onSaved={() => { setCancellingSale(null); load(); }} />}
    {viewingSale && <SaleDetailModal sale={viewingSale} onClose={() => setViewingSale(null)} onChanged={() => { setViewingSale(null); load(); }} />}
  </div>;
}

function Overview({ overview, loading, onRecord }) {
  if (loading) return <div className="card p-8 text-center text-slate-500">Loading production records...</div>;
  if (!overview.totalsByUnit.length) return <div className="card p-8 text-center"><Warehouse className="mx-auto h-10 w-10 text-farm-700" /><h2 className="mt-3 text-xl font-black text-farm-950 dark:text-white">No production recorded yet</h2><p className="mt-1 text-sm text-slate-500">Start with eggs, milk, a crop harvest, or a fish harvest.</p><button className="btn-primary mt-5" onClick={onRecord}>Record first production</button></div>;
  return <>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {overview.totalsByUnit.map((row) => <div className="card p-4" key={`${row.productType}-${row.baseUnit}`}>
        <div className="flex items-start justify-between"><div><div className="label">{label(row.productType)}</div><div className="mt-2 text-2xl font-black text-farm-950 dark:text-white">{formatQuantity(row.available, row.baseUnit)}</div><div className="mt-1 text-xs text-slate-500">Currently available</div></div><Scale className="h-5 w-5 text-farm-600" /></div>
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-farm-100 pt-3 text-xs dark:border-farm-800"><Metric label="Today" value={formatQuantity(row.today, row.baseUnit)} /><Metric label="This week" value={formatQuantity(row.week, row.baseUnit)} /><Metric label="Sold" value={formatQuantity(row.sold, row.baseUnit)} /><Metric label="Excluded" value={formatQuantity(row.damaged + row.rejected + row.internal + row.reserved + row.fedToYoung, row.baseUnit)} /></div>
      </div>)}
    </div>
    <section className="mt-6"><h2 className="mb-3 text-lg font-black text-farm-950 dark:text-white">Recent production</h2><ProductionTable records={overview.recent} /></section>
  </>;
}

function ProductionForm({ initial, animals, groups, crops, onSaved, onCancel }) {
  const editing = Boolean(initial?._id);
  const [form, setForm] = useState(() => editing ? toProductionForm(initial) : { ...emptyForm });
  const [saving, setSaving] = useState(false);
  const sources = useMemo(() => sourceOptions(form.productType, animals, groups, crops), [form.productType, animals, groups, crops]);
  const sellable = calculateSellable(form);
  const invalidQuantity = sellable < 0;

  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); }
  function chooseProduct(option) {
    if (editing) return;
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
      if (editing) await api.put(`/production/${initial._id}`, payload);
      else await api.post("/production", payload);
      toast.success(editing ? "Production updated" : "Production recorded"); onSaved();
      if (!editing) setForm({ ...emptyForm });
    } catch (error) { toast.error(error.response?.data?.message || error.response?.data?.errors?.[0]?.message || "Could not save production"); }
    finally { setSaving(false); }
  }

  return <form onSubmit={submit} className="space-y-5">
    <section className="card p-4 sm:p-5"><Step number="1" title="Select product type" />
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">{productOptions.map((option) => <button type="button" disabled={editing} key={option.value} onClick={() => chooseProduct(option)} className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-md border p-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-70 ${form.productType === option.value ? "border-farm-700 bg-farm-50 text-farm-950 dark:bg-farm-900 dark:text-white" : "border-farm-100 text-slate-600 dark:border-farm-800 dark:text-slate-300"}`}><option.icon className="h-6 w-6" />{option.label}</button>)}</div>
    </section>
    <section className="card p-4 sm:p-5"><Step number="2" title="Select source" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Product name" value={form.productName} onChange={(value) => update("productName", value)} required disabled={editing} />
        {form.sourceType === "other" ? <div className="rounded-md bg-field-mist p-3 text-sm font-semibold text-slate-600 dark:bg-farm-900 dark:text-slate-300">Other farm source</div> : <Select label={sourceLabel(form.productType)} value={form.sourceId} disabled={editing} onChange={(value) => { const source = sources.find((item) => item.value === value); setForm((current) => ({ ...current, sourceId: value, sourceType: source?.sourceType || current.sourceType })); }} options={editing && !sources.some((item) => item.value === form.sourceId) ? [{ value: form.sourceId, label: initial.sourceLabel }, ...sources] : sources} placeholder="Select source" required />}
      </div>
    </section>
    <section className="card p-4 sm:p-5"><Step number="3" title="Enter production details" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label={dateLabel(form.productType)} type="date" value={form.productionDate} onChange={(value) => update("productionDate", value)} required disabled={editing} />
        {(form.productType === "eggs" || form.productType === "milk") && <Select label="Session (optional)" value={form.session} onChange={(value) => update("session", value)} options={sessionOptions(form.productType)} placeholder="Not specified" />}
        {form.productType === "fish_harvest" && <Select label="Harvest type" value={form.fishHarvestType} onChange={(value) => update("fishHarvestType", value)} options={[{ value: "sample", label: "Sample harvest" }, { value: "partial", label: "Partial harvest" }, { value: "full", label: "Full harvest" }]} required />}
        <Field label={producedLabel(form.productType)} type="number" min="0" step="any" value={form.quantityProduced} onChange={(value) => update("quantityProduced", value)} required />
        <Select label="Base unit" value={form.baseUnit} disabled={editing} onChange={(value) => update("baseUnit", value)} options={unitOptions(form.productType)} required />
        {form.productType === "fish_harvest" && <><Field label="Confirmed fish count removed" type="number" min="0" step="1" disabled={editing} value={form.fishHarvestCount} onChange={(value) => update("fishHarvestCount", value)} /><Field label="Total harvested weight" type="number" min="0" step="any" value={form.totalHarvestedWeight} onChange={(value) => update("totalHarvestedWeight", value)} /><Field label="Average weight (optional)" type="number" min="0" step="any" value={form.averageWeight} onChange={(value) => update("averageWeight", value)} /><Select label="Average weight unit" value={form.averageWeightUnit} onChange={(value) => update("averageWeightUnit", value)} options={["g", "kg"]} /></>}
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
    <div className="sticky bottom-24 flex justify-end gap-2">{onCancel && <button type="button" className="btn-muted" onClick={onCancel}>Cancel</button>}<button className="btn-primary min-w-40" disabled={saving || invalidQuantity}>{saving ? "Saving..." : editing ? "Update production" : "Save production"}</button></div>
  </form>;
}

function History({ records, filters, setFilters, loading, onEdit, onDelete, onView }) {
  return <div><div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4"><input className="input" placeholder="Search product, batch, source" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /><select className="input" value={filters.productType} onChange={(event) => setFilters({ ...filters, productType: event.target.value })}><option value="">All products</option>{productOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><Field label="From" type="date" value={filters.from} onChange={(value) => setFilters({ ...filters, from: value })} /><Field label="To" type="date" value={filters.to} onChange={(value) => setFilters({ ...filters, to: value })} /></div>{loading ? <div className="card p-8 text-center text-slate-500">Loading history...</div> : <ProductionTable records={records} onEdit={onEdit} onDelete={onDelete} onView={onView} />}</div>;
}

function ProductionTable({ records, onEdit, onDelete, onView }) {
  return <DataTable rows={records} emptyText="No production records match this view." columns={[
    { key: "productionDate", label: "Date", render: (row) => new Date(row.productionDate).toLocaleDateString() },
    { key: "productName", label: "Product", render: (row) => <div><div className="font-black text-farm-950 dark:text-white">{row.productName}</div><div className="text-xs text-slate-500">{row.batchReference}</div></div> },
    { key: "sourceLabel", label: "Source" },
    { key: "quantityProduced", label: "Produced", render: (row) => formatQuantity(row.quantityProduced, row.baseUnit) },
    { key: "quantitySellable", label: "Sellable", render: (row) => <span className="font-black text-farm-800 dark:text-field-lime">{formatQuantity(row.quantitySellable, row.baseUnit)}</span> },
    { key: "availableQuantity", label: "Available", render: (row) => formatQuantity(row.availableQuantity || 0, row.baseUnit) },
    { key: "storageLocation", label: "Storage", render: (row) => row.storageLocation || "Not set" },
    { key: "status", label: "Status", render: (row) => <span className={`badge ${row.status === "active" ? "bg-farm-50 text-farm-700" : "bg-slate-100 text-slate-600"}`}>{label(row.status)}</span> }
  ]} actions={onView ? (row) => <div className="flex justify-end gap-2"><button className="btn-muted px-2" onClick={() => onView(row)} aria-label="View batch history" title="View history"><Eye className="h-4 w-4" /></button>{row.status === "active" && <button className="btn-muted px-2" onClick={() => onEdit(row)} aria-label="Edit production" title="Edit product"><Edit className="h-4 w-4" /></button>}{row.status === "active" && <button className="btn-muted px-2 text-red-700" onClick={() => onDelete(row)} aria-label="Delete product" title="Delete product"><Trash2 className="h-4 w-4" /></button>}</div> : undefined} />;
}

function AvailableProduce({ records, loading, onSale, onRemove, onTransfer, onView, onDelete }) {
  if (loading) return <div className="card p-8 text-center text-slate-500">Loading available produce...</div>;
  if (!records.length) return <div className="card p-8 text-center"><Warehouse className="mx-auto h-9 w-9 text-farm-700" /><h2 className="mt-3 text-lg font-black text-farm-950 dark:text-white">No sellable produce available</h2></div>;
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{records.map((record) => {
    const expiryState = expiryStatus(record.expiryDate);
    return <article className="card p-4" key={record._id}><div className="flex items-start justify-between gap-3"><div><div className="label">{record.batchReference}</div><h2 className="mt-1 text-lg font-black text-farm-950 dark:text-white">{record.productName}</h2><p className="mt-1 text-sm text-slate-500">{record.sourceLabel}</p></div>{expiryState && <span className={`badge ${expiryState === "Expired" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{expiryState}</span>}</div><div className="mt-4 rounded-md bg-field-sage p-4 dark:bg-farm-900"><div className="label">Available quantity</div><div className="mt-1 text-2xl font-black text-farm-950 dark:text-white">{formatQuantity(record.availableQuantity, record.baseUnit)}</div></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><Info label="Produced" value={new Date(record.productionDate).toLocaleDateString()} /><Info label="Storage" value={record.storageLocation || "Not set"} />{record.expiryDate && <Info label="Expiry" value={new Date(record.expiryDate).toLocaleDateString()} />}</div><button className="btn-primary mt-4 w-full justify-center" onClick={() => onSale(record)}><ShoppingCart className="h-4 w-4" /> Create sale</button><div className="mt-2 grid grid-cols-2 gap-2"><button className="btn-muted px-2" onClick={() => onRemove(record)}><MinusCircle className="h-4 w-4" /> Use</button><button className="btn-muted px-2" onClick={() => onTransfer(record)}><ArrowRightLeft className="h-4 w-4" /> Move</button><button className="btn-muted px-2" onClick={() => onView(record)}><Eye className="h-4 w-4" /> History</button><button className="btn-muted px-2 text-red-700" onClick={() => onDelete(record)}><Trash2 className="h-4 w-4" /> Delete</button></div></article>;
  })}</div>;
}

function RemovalHistory({ movements, loading }) {
  if (loading) return <div className="card p-8 text-center text-slate-500">Loading removals...</div>;
  return <DataTable rows={movements} emptyText="No internal use or produce losses recorded." columns={[
    { key: "movementDate", label: "Date", render: (row) => new Date(row.movementDate).toLocaleDateString() },
    { key: "productionRecord", label: "Batch", render: (row) => <div><div className="font-black text-farm-950 dark:text-white">{row.productionRecord?.productName || "Produce"}</div><div className="text-xs text-slate-500">{row.productionRecord?.batchReference}</div></div> },
    { key: "productionRemovalReason", label: "Reason", render: (row) => label(row.productionRemovalReason || row.reason) },
    { key: "quantity", label: "Quantity", render: (row) => formatQuantity(row.quantity, row.productionRecord?.baseUnit || "") },
    { key: "source", label: "Source", render: (row) => row.productionRecord?.sourceLabel || "Not set" },
    { key: "notes", label: "Notes", render: (row) => row.notes || "" }
  ]} />;
}

function RemovalModal({ record, onClose, onSaved }) {
  const [form, setForm] = useState({ reason: "household", quantity: "", movementDate: today(), notes: "", idempotencyKey: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}` });
  const [saving, setSaving] = useState(false);
  async function submit(event) {
    event.preventDefault(); setSaving(true);
    try { await api.post(`/production/${record._id}/removals`, { ...form, quantity: Number(form.quantity) }); toast.success("Produce removal recorded"); onSaved(); }
    catch (error) { toast.error(error.response?.data?.message || error.response?.data?.errors?.[0]?.message || "Could not remove produce"); }
    finally { setSaving(false); }
  }
  return <CrudModal title={`Remove stock - ${record.productName}`} onClose={onClose}><form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}><div className="rounded-md bg-field-sage p-3 sm:col-span-2 dark:bg-farm-900"><div className="label">Available in batch</div><div className="mt-1 text-xl font-black text-farm-950 dark:text-white">{formatQuantity(record.availableQuantity, record.baseUnit)}</div></div><Select label="Reason" value={form.reason} onChange={(reason) => setForm({ ...form, reason })} options={[{ value: "household", label: "Household use" }, { value: "animal_feed", label: "Animal feeding" }, { value: "farm_input", label: "Farm input" }, { value: "seed", label: "Reserved for seed" }, { value: "incubation", label: "Reserved for incubation" }, { value: "damaged", label: "Damaged" }, { value: "spoiled", label: "Spoiled" }, { value: "missing", label: "Missing" }, { value: "donated", label: "Donated" }, { value: "other", label: "Other" }]} required /><Field label={`Quantity (${record.baseUnit})`} type="number" min="0.000001" step="any" value={form.quantity} onChange={(quantity) => setForm({ ...form, quantity })} required /><Field label="Date" type="date" value={form.movementDate} onChange={(movementDate) => setForm({ ...form, movementDate })} required /><label className="space-y-1 sm:col-span-2"><span className="label">Notes</span><textarea className="input min-h-20" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="btn-muted" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Record removal"}</button></div></form></CrudModal>;
}

function TransferModal({ record, onClose, onSaved }) {
  const [form, setForm] = useState({ storageLocation: "", movementDate: today(), idempotencyKey: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}` });
  const [saving, setSaving] = useState(false);
  async function submit(event) {
    event.preventDefault(); setSaving(true);
    try { await api.post(`/production/${record._id}/transfer`, form); toast.success("Storage location updated"); onSaved(); }
    catch (error) { toast.error(error.response?.data?.message || error.response?.data?.errors?.[0]?.message || "Could not transfer produce"); }
    finally { setSaving(false); }
  }
  return <CrudModal title={`Move produce - ${record.productName}`} onClose={onClose}><form className="space-y-4" onSubmit={submit}><div className="rounded-md bg-field-sage p-3 dark:bg-farm-900"><div className="label">Current storage</div><div className="mt-1 font-black text-farm-950 dark:text-white">{record.storageLocation || "Not set"}</div><div className="mt-1 text-sm text-slate-500">{formatQuantity(record.availableQuantity, record.baseUnit)} available in this batch</div></div><Field label="New storage location" value={form.storageLocation} onChange={(storageLocation) => setForm({ ...form, storageLocation })} required /><Field label="Transfer date" type="date" value={form.movementDate} onChange={(movementDate) => setForm({ ...form, movementDate })} required /><div className="flex justify-end gap-2"><button type="button" className="btn-muted" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={saving}>{saving ? "Moving..." : "Move produce"}</button></div></form></CrudModal>;
}

function Sales({ sales, loading, onView, onEdit, onPay, onCancel }) {
  const { user } = useAuth();
  const currency = moneyFormatter(user?.preferences?.currency);
  if (loading) return <div className="card p-8 text-center text-slate-500">Loading produce sales...</div>;
  return <DataTable rows={sales} emptyText="No produce sales recorded yet." columns={[
    { key: "saleNumber", label: "Sale", render: (row) => <div><div className="font-black text-farm-950 dark:text-white">{row.saleNumber}</div><div className="text-xs text-slate-500">{new Date(row.saleDate).toLocaleDateString()}</div></div> },
    { key: "productName", label: "Produce", render: (row) => <div><div className="font-bold">{row.productName}</div><div className="text-xs text-slate-500">{row.productionRecord?.batchReference}</div></div> },
    { key: "quantity", label: "Quantity", render: (row) => `${row.quantity.toLocaleString()} ${label(row.saleUnit)}` },
    { key: "customer", label: "Customer" },
    { key: "totalAmount", label: "Total", render: (row) => <strong>{currency.format(row.totalAmount)}</strong> },
    { key: "payment", label: "Payment", render: (row) => <div><PaymentState transaction={row.financeTransaction} /><div className="mt-1 text-xs text-slate-500">Due {currency.format(row.financeTransaction?.amountOutstanding || 0)}</div></div> },
    { key: "status", label: "Status", render: (row) => <span className={`badge ${row.status === "confirmed" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{label(row.status)}</span> }
  ]} actions={(row) => <div className="flex justify-end gap-1"><button className="btn-muted px-2" onClick={() => onView(row)} aria-label="View sale"><Eye className="h-4 w-4" /></button>{row.status === "confirmed" && <button className="btn-muted px-2" onClick={() => onEdit(row)} aria-label="Edit sale"><Edit className="h-4 w-4" /></button>}{row.status === "confirmed" && Number(row.financeTransaction?.amountOutstanding || 0) > 0 && <button className="btn-primary px-2" onClick={() => onPay(row)} aria-label="Record payment"><CreditCard className="h-4 w-4" /></button>}{row.status === "confirmed" && <button className="btn-muted px-2 text-red-700" onClick={() => onCancel(row)} aria-label="Cancel sale"><XCircle className="h-4 w-4" /></button>}</div>} />;
}

function SaleModal({ batch, sale, onClose, onSaved }) {
  const editing = Boolean(sale?._id);
  const source = batch || { _id: sale?.productionRecord?._id || sale?.productionRecord, productName: sale?.productName, baseUnit: sale?.baseUnit, availableQuantity: 0, batchReference: sale?.productionRecord?.batchReference };
  const units = saleUnitsFor(source.baseUnit);
  const initialUnit = sale?.saleUnit || units[0];
  const [form, setForm] = useState({
    productionRecord: source._id, saleUnit: initialUnit, quantity: sale?.quantity || "", unitPrice: sale?.unitPrice || "",
    conversionToBase: sale?.conversionToBase || standardConversion(source.baseUnit, initialUnit) || "",
    customer: sale?.customer || "", customerPhone: sale?.customerPhone || "", saleDate: sale ? inputDate(sale.saleDate) : today(),
    dueDate: sale?.dueDate ? inputDate(sale.dueDate) : "", notes: sale?.notes || "", amountReceived: "",
    paymentMethod: "Cash", referenceNumber: "", idempotencyKey: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
  });
  const [saving, setSaving] = useState(false);
  const conversion = standardConversion(source.baseUnit, form.saleUnit) || Number(form.conversionToBase || 0);
  const baseQuantity = Number(form.quantity || 0) * conversion;
  const total = Number(form.quantity || 0) * Number(form.unitPrice || 0);
  function changeUnit(saleUnit) { setForm((current) => ({ ...current, saleUnit, conversionToBase: standardConversion(source.baseUnit, saleUnit) || "" })); }
  async function submit(event) {
    event.preventDefault(); setSaving(true);
    const payload = { ...form, quantity: Number(form.quantity), unitPrice: Number(form.unitPrice), conversionToBase: Number(form.conversionToBase || conversion), amountReceived: Number(form.amountReceived || 0) };
    try {
      if (editing) await api.put(`/produce-sales/${sale._id}`, payload); else await api.post("/produce-sales", payload);
      toast.success(editing ? "Sale updated" : "Sale recorded and Inventory deducted"); onSaved();
    } catch (error) { toast.error(error.response?.data?.message || error.response?.data?.errors?.[0]?.message || "Could not save sale"); }
    finally { setSaving(false); }
  }
  return <CrudModal title={editing ? `Edit ${sale.saleNumber}` : `Sell ${source.productName}`} onClose={onClose}><form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}><div className="rounded-md bg-field-sage p-3 sm:col-span-2 dark:bg-farm-900"><div className="label">Production batch</div><div className="mt-1 font-black text-farm-950 dark:text-white">{source.batchReference || sale?.productionRecord?.batchReference} - {source.productName}</div><div className="mt-1 text-sm text-slate-500">{editing ? `Originally sold ${sale.baseQuantity} ${sale.baseUnit}` : `${source.availableQuantity} ${source.baseUnit} available`}</div></div><Select label="Sales unit" value={form.saleUnit} onChange={changeUnit} options={units} required /><Field label={`Quantity (${form.saleUnit})`} type="number" min="0.000001" step="any" value={form.quantity} onChange={(quantity) => setForm({ ...form, quantity })} required />{!standardConversion(source.baseUnit, form.saleUnit) && source.baseUnit !== form.saleUnit && <Field label={`${source.baseUnit}s per ${form.saleUnit}`} type="number" min="0.000001" step="any" value={form.conversionToBase} onChange={(conversionToBase) => setForm({ ...form, conversionToBase })} required />}<Field label={`Price per ${form.saleUnit}`} type="number" min="0" step="any" value={form.unitPrice} onChange={(unitPrice) => setForm({ ...form, unitPrice })} required /><Field label="Sale date" type="date" disabled={editing} value={form.saleDate} onChange={(saleDate) => setForm({ ...form, saleDate })} required /><Field label="Customer" value={form.customer} onChange={(customer) => setForm({ ...form, customer })} /><Field label="Customer phone" value={form.customerPhone} onChange={(customerPhone) => setForm({ ...form, customerPhone })} /><Field label="Payment due date" type="date" value={form.dueDate} onChange={(dueDate) => setForm({ ...form, dueDate })} /><div className="rounded-md border border-farm-100 p-3 sm:col-span-2"><div className="grid grid-cols-2 gap-3"><Info label="Inventory deduction" value={`${baseQuantity.toLocaleString()} ${label(source.baseUnit)}`} /><Info label="Sale total" value={Number(total).toLocaleString(undefined, { minimumFractionDigits: 2 })} /></div></div>{!editing && <><Field label="Amount received now" type="number" min="0" max={total} step="any" value={form.amountReceived} onChange={(amountReceived) => setForm({ ...form, amountReceived })} /><Select label="Payment method" value={form.paymentMethod} onChange={(paymentMethod) => setForm({ ...form, paymentMethod })} options={["Cash", "M-Pesa", "Bank transfer", "Card", "Credit", "Other"]} /><Field label="Payment reference" value={form.referenceNumber} onChange={(referenceNumber) => setForm({ ...form, referenceNumber })} /></>}<label className="space-y-1 sm:col-span-2"><span className="label">Notes</span><textarea className="input min-h-20" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="btn-muted" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={saving || baseQuantity <= 0}>{saving ? "Saving..." : editing ? "Update sale" : "Confirm sale"}</button></div></form></CrudModal>;
}

function SalePaymentModal({ sale, onClose, onSaved }) {
  const outstanding = Number(sale.financeTransaction?.amountOutstanding || 0);
  const [form, setForm] = useState({ amount: "", paymentDate: today(), paymentMethod: sale.financeTransaction?.paymentMethod || "Cash", referenceNumber: "", notes: "", idempotencyKey: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}` });
  const [saving, setSaving] = useState(false);
  async function submit(event) { event.preventDefault(); setSaving(true); try { await api.post(`/produce-sales/${sale._id}/payments`, { ...form, amount: Number(form.amount) }); toast.success("Payment recorded and receipt issued"); onSaved(); } catch (error) { toast.error(error.response?.data?.message || "Could not record payment"); } finally { setSaving(false); } }
  return <CrudModal title={`Payment - ${sale.saleNumber}`} onClose={onClose}><form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}><div className="rounded-md bg-field-sage p-3 sm:col-span-2 dark:bg-farm-900"><Info label="Outstanding balance" value={outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })} /></div><Field label="Amount received" type="number" min="0.01" max={outstanding} step="any" value={form.amount} onChange={(amount) => setForm({ ...form, amount })} required /><Field label="Payment date" type="date" value={form.paymentDate} onChange={(paymentDate) => setForm({ ...form, paymentDate })} required /><Select label="Payment method" value={form.paymentMethod} onChange={(paymentMethod) => setForm({ ...form, paymentMethod })} options={["Cash", "M-Pesa", "Bank transfer", "Card", "Credit", "Other"]} /><Field label="Reference" value={form.referenceNumber} onChange={(referenceNumber) => setForm({ ...form, referenceNumber })} /><label className="space-y-1 sm:col-span-2"><span className="label">Notes</span><textarea className="input min-h-20" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="btn-muted" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Record payment"}</button></div></form></CrudModal>;
}

function CancelSaleModal({ sale, onClose, onSaved }) {
  const [reason, setReason] = useState(""); const [saving, setSaving] = useState(false);
  async function submit(event) { event.preventDefault(); setSaving(true); try { await api.post(`/produce-sales/${sale._id}/cancel`, { reason }); toast.success("Sale cancelled and stock restored"); onSaved(); } catch (error) { toast.error(error.response?.data?.message || "Could not cancel sale"); } finally { setSaving(false); } }
  return <CrudModal title={`Cancel ${sale.saleNumber}`} onClose={onClose}><form className="space-y-4" onSubmit={submit}><div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Unpaid sales can be cancelled safely. Received payments must be voided first. Stock and the linked Finance income will be reversed.</div><label className="space-y-1"><span className="label">Cancellation reason</span><textarea className="input min-h-24" minLength="3" maxLength="500" required value={reason} onChange={(event) => setReason(event.target.value)} /></label><div className="flex justify-end gap-2"><button type="button" className="btn-muted" onClick={onClose}>Keep sale</button><button className="btn-primary" disabled={saving}>{saving ? "Cancelling..." : "Cancel sale"}</button></div></form></CrudModal>;
}

function SaleDetailModal({ sale, onClose, onChanged }) {
  const { user } = useAuth(); const currency = moneyFormatter(user?.preferences?.currency);
  const [detail, setDetail] = useState(null); const [voiding, setVoiding] = useState(null); const [reason, setReason] = useState("");
  useEffect(() => { api.get(`/produce-sales/${sale._id}`).then(({ data }) => setDetail(data)).catch(() => toast.error("Could not load sale")); }, [sale._id]);
  async function downloadReceipt(receipt) { try { const { data } = await api.get(`/produce-sales/${sale._id}/receipts/${receipt._id}/pdf`, { responseType: "blob" }); saveBlob(data, `${receipt.receiptNumber}.pdf`); } catch { toast.error("Could not download receipt"); } }
  async function voidReceipt() { try { await api.post(`/produce-sales/${sale._id}/receipts/${voiding._id}/void`, { reason }); toast.success("Payment and receipt voided"); onChanged(); } catch (error) { toast.error(error.response?.data?.message || "Could not void receipt"); } }
  return <CrudModal title={`Sale ${sale.saleNumber}`} onClose={onClose}>{!detail ? <div className="p-6 text-center text-slate-500">Loading sale...</div> : <div className="space-y-5"><div className="grid grid-cols-2 gap-3"><Info label="Produce" value={detail.productName} /><Info label="Customer" value={detail.customer} /><Info label="Quantity" value={`${detail.quantity} ${label(detail.saleUnit)}`} /><Info label="Sale total" value={currency.format(detail.totalAmount)} /><Info label="Paid" value={currency.format(detail.financeTransaction?.amountPaid || 0)} /><Info label="Outstanding" value={currency.format(detail.financeTransaction?.amountOutstanding || 0)} /></div><section><div className="label">Payment receipts</div><div className="mt-2 space-y-2">{detail.receipts.map((receipt) => <div className="rounded-md border border-farm-100 p-3" key={receipt._id}><div className="flex items-start justify-between gap-3"><div><div className="font-black text-farm-950 dark:text-white">{receipt.receiptNumber}</div><div className="mt-1 text-sm text-slate-500">{currency.format(receipt.amountReceived)} - {receipt.paymentMethod}</div></div><span className={`badge ${receipt.voidedAt ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-800"}`}>{receipt.voidedAt ? "Voided" : "Issued"}</span></div><div className="mt-3 flex gap-2"><button className="btn-muted" onClick={() => downloadReceipt(receipt)}><Download className="h-4 w-4" /> PDF</button>{!receipt.voidedAt && detail.status === "confirmed" && <button className="btn-muted text-red-700" onClick={() => { setVoiding(receipt); setReason(""); }}><XCircle className="h-4 w-4" /> Void</button>}</div></div>)}{!detail.receipts.length && <div className="rounded-md bg-field-mist p-3 text-sm text-slate-500">No money received, so no receipt has been issued.</div>}</div></section>{voiding && <div className="rounded-md border border-red-200 bg-red-50 p-3"><div className="font-black text-red-900">Void {voiding.receiptNumber}</div><p className="mt-1 text-sm text-red-700">This also reverses the linked payment and restores the outstanding balance.</p><textarea className="input mt-3 min-h-20" minLength="3" maxLength="500" placeholder="Reason for voiding" value={reason} onChange={(event) => setReason(event.target.value)} /><div className="mt-3 flex gap-2"><button className="btn-muted" onClick={() => setVoiding(null)}>Keep receipt</button><button className="btn-primary" disabled={reason.trim().length < 3} onClick={voidReceipt}>Void receipt</button></div></div>}</div>}</CrudModal>;
}

function ProductionReports({ report, filters, loading }) {
  const { user } = useAuth(); const currency = moneyFormatter(user?.preferences?.currency);
  async function downloadCsv() { try { const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value)); const { data } = await api.get("/produce-sales/reports/csv", { responseType: "blob", params }); saveBlob(data, `production_sales_${today()}.csv`); } catch { toast.error("Could not download Production report"); } }
  if (loading) return <div className="card p-8 text-center text-slate-500">Loading reports...</div>;
  return <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black text-farm-950 dark:text-white">Production and sales report</h2><p className="text-sm text-slate-500">Quantities stay grouped by product and unit.</p></div><button className="btn-primary" onClick={downloadCsv}><Download className="h-4 w-4" /> Download CSV</button></div><DataTable rows={report.rows} emptyText="No report data for this period." columns={[{ key: "product", label: "Product" }, { key: "unit", label: "Unit", render: (row) => label(row.unit) }, { key: "produced", label: "Produced" }, { key: "sellable", label: "Sellable" }, { key: "internal", label: "Internal" }, { key: "losses", label: "Losses" }, { key: "sold", label: "Sold" }, { key: "remaining", label: "Remaining" }, { key: "revenue", label: "Revenue", render: (row) => currency.format(row.revenue) }]} /></div>;
}

function DeleteProductModal({ record, onClose, onSaved }) {
  const [reason, setReason] = useState(""); const [saving, setSaving] = useState(false);
  async function submit(event) { event.preventDefault(); setSaving(true); try { await api.post(`/production/${record._id}/reverse`, { reason }); toast.success("Product deleted from active production"); onSaved(); } catch (error) { toast.error(error.response?.data?.message || "Could not delete product"); } finally { setSaving(false); } }
  return <CrudModal title={`Delete ${record.productName}`} onClose={onClose}><form className="space-y-4" onSubmit={submit}><div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900"><strong>{record.batchReference}</strong> will be removed from available production and its remaining stock will be reversed. Its audit history will remain. Products with linked sales, losses, or usage cannot be deleted.</div><label className="space-y-1"><span className="label">Reason for deletion</span><textarea className="input min-h-24" minLength="3" maxLength="500" required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="For example: entered by mistake" /></label><div className="flex justify-end gap-2"><button type="button" className="btn-muted" onClick={onClose}>Cancel</button><button className="btn-primary bg-red-700 hover:bg-red-800" disabled={saving}><Trash2 className="h-4 w-4" /> {saving ? "Deleting..." : "Delete product"}</button></div></form></CrudModal>;
}

function BatchHistoryModal({ record, onClose }) {
  const [detail, setDetail] = useState(null);
  useEffect(() => { api.get(`/production/${record._id}`).then(({ data }) => setDetail(data)).catch(() => toast.error("Could not load batch history")); }, [record._id]);
  return <CrudModal title={`Batch history - ${record.batchReference}`} onClose={onClose}>{!detail ? <div className="p-6 text-center text-slate-500">Loading history...</div> : <div className="space-y-4"><div className="grid grid-cols-2 gap-3"><Info label="Produced" value={formatQuantity(detail.quantityProduced, detail.baseUnit)} /><Info label="Sellable" value={formatQuantity(detail.quantitySellable, detail.baseUnit)} /><Info label="Available" value={formatQuantity(detail.availableQuantity, detail.baseUnit)} /><Info label="Source" value={detail.sourceLabel} /></div><div className="space-y-2">{detail.movements.map((movement) => <div key={movement._id} className="flex items-start justify-between gap-3 rounded-md border border-farm-100 p-3 dark:border-farm-800"><div><div className="font-black text-farm-950 dark:text-white">{movement.reason || label(movement.type)}</div><div className="mt-1 text-xs text-slate-500">{new Date(movement.movementDate).toLocaleDateString()}</div></div><div className={`font-black ${movement.quantityChange < 0 ? "text-red-700" : "text-farm-700"}`}>{movement.quantityChange > 0 ? "+" : ""}{formatQuantity(movement.quantityChange, detail.baseUnit)}</div></div>)}</div></div>}</CrudModal>;
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
function toProductionForm(record) { return { ...emptyForm, ...record, sourceId: record.sourceId || "", productionDate: new Date(record.productionDate).toISOString().slice(0, 10), expiryDate: record.expiryDate ? new Date(record.expiryDate).toISOString().slice(0, 10) : "" }; }
function expiryStatus(value) { if (!value) return ""; const days = (new Date(value).getTime() - Date.now()) / 86400000; return days < 0 ? "Expired" : days <= 3 ? "Expiring soon" : ""; }
function inputDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10); }
function saleUnitsFor(baseUnit) { if (baseUnit === "egg") return ["egg", "dozen", "tray", "crate"]; if (["litre", "millilitre"].includes(baseUnit)) return ["litre", "millilitre"]; if (["kilogram", "tonne"].includes(baseUnit)) return [baseUnit, baseUnit === "kilogram" ? "tonne" : "kilogram", "bag", "crate"]; return [baseUnit, "other"]; }
function standardConversion(baseUnit, saleUnit) { if (baseUnit === saleUnit) return 1; return { "egg:dozen": 12, "egg:tray": 30, "litre:millilitre": 0.001, "millilitre:litre": 1000, "kilogram:tonne": 1000, "tonne:kilogram": 0.001 }[`${baseUnit}:${saleUnit}`] || 0; }
function moneyFormatter(currency = "KES") { try { return new Intl.NumberFormat("en-KE", { style: "currency", currency: currency || "KES", maximumFractionDigits: 2 }); } catch { return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 2 }); } }
function PaymentState({ transaction }) { const state = transaction?.paymentStatus || "unpaid"; return <span className={`badge ${state === "paid" ? "bg-emerald-100 text-emerald-800" : state === "partially_paid" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>{label(state)}</span>; }
function Step({ number, title }) { return <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-farm-900 text-sm font-black text-white">{number}</span><h2 className="text-lg font-black text-farm-950 dark:text-white">{title}</h2></div>; }
function Metric({ label: text, value }) { return <div><div className="text-slate-400">{text}</div><div className="mt-0.5 font-black text-farm-950 dark:text-white">{value}</div></div>; }
function Info({ label: text, value }) { return <div><span className="label block">{text}</span><span className="font-bold text-slate-700 dark:text-slate-200">{value}</span></div>; }
function Field({ label: text, value, onChange, type = "text", required, min, step, disabled }) { return <label className="space-y-1"><span className="label">{text}</span><input className="input" type={type} value={value ?? ""} required={required} min={min} step={step} disabled={disabled} onChange={(event) => onChange(event.target.value)} /></label>; }
function Select({ label: text, value, onChange, options, placeholder, required, disabled }) { return <label className="space-y-1"><span className="label">{text}</span><select className="input" value={value} required={required} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{placeholder && <option value="">{placeholder}</option>}{options.map((option) => { const item = typeof option === "string" ? { value: option, label: label(option) } : option; return <option key={item.value} value={item.value}>{item.label}</option>; })}</select></label>; }
