import {
  Archive, ArrowDownToLine, ArrowLeft, ArrowUpFromLine, Edit,
  History, MoreVertical, Plus, Search, SlidersHorizontal, Trash2
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import CrudModal from "./CrudModal";
import api from "../services/api";
import { currency, formatDate, inputDate } from "../utils";

const categories = ["Feed", "Medicine", "Vaccine", "Fertilizer", "Seed", "Chemical", "Fuel", "Farm supplies", "Produce", "Equipment", "Other"];
const units = ["kg", "g", "litres", "ml", "bags", "bales", "pieces", "bottles", "doses", "units"];
const paymentMethods = ["Mpesa", "Bank Transfer", "Cash", "Other"];
const blankItem = {
  name: "", category: "Feed", unit: "kg", openingQuantity: "", minimumStockLevel: "",
  unitCost: "", storageLocation: "", supplier: "", expiryDate: "", notes: ""
};

export default function InventoryWorkspace({ animals = [], crops = [], onBack }) {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [itemModal, setItemModal] = useState(null);
  const [movementModal, setMovementModal] = useState(null);
  const [historyItem, setHistoryItem] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const { data } = await api.get("/inventory");
      setItems(data);
    } catch {
      toast.error("Could not load inventory");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => items.filter((item) => {
    if (filter === "consumable" && !["consumable", "produce"].includes(item.classification)) return false;
    if (filter === "non_current" && item.classification !== "equipment_asset") return false;
    if (filter === "low" && !["Low stock", "Out of stock"].includes(item.status)) return false;
    if (filter === "expiry" && !["Expired", "Expiring soon"].includes(item.status)) return false;
    const term = search.trim().toLowerCase();
    return !term || [item.name, item.category, item.unit, item.storageLocation, item.status].join(" ").toLowerCase().includes(term);
  }), [items, search, filter]);

  const totalValue = items.reduce((sum, item) => sum + Number(item.inventoryValue || 0), 0);
  const lowCount = items.filter((item) => ["Low stock", "Out of stock"].includes(item.status)).length;

  async function archive(item) {
    if (!confirm(`Archive ${item.name}? Its stock history will remain available.`)) return;
    await api.patch(`/inventory/${item._id}/archive`, { archived: true });
    toast.success("Inventory item archived");
    load();
  }

  async function remove(item) {
    if (!confirm(`Delete ${item.name}? Items with stock history must be archived instead.`)) return;
    try {
      await api.delete(`/inventory/${item._id}`);
      toast.success("Inventory item deleted");
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "This item cannot be deleted");
    }
  }

  return (
    <div className="space-y-4">
      <section className="card p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <button className="btn-muted px-3" onClick={onBack} aria-label="Back to finance"><ArrowLeft className="h-4 w-4" /></button>
            <div>
              <div className="label">Stock control</div>
              <h2 className="mt-1 text-xl font-black text-farm-950">Inventory</h2>
              <p className="mt-1 text-sm text-slate-500">Balances update from opening stock, additions, usage and adjustments.</p>
            </div>
          </div>
          <button className="btn-primary" onClick={() => setItemModal(blankItem)}><Plus className="h-4 w-4" /> Add inventory</button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Summary label="Items" value={items.length.toLocaleString()} />
          <Summary label="Inventory value" value={currency.format(totalValue)} />
          <Summary label="Needs attention" value={lowCount.toLocaleString()} alert={lowCount > 0} />
        </div>
      </section>

      <section className="card p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <label className="space-y-1">
            <span className="label">Search by item name</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <input className="input pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Feed, vaccine, fertilizer, fuel..." />
            </div>
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              ["all", "All"], ["consumable", "Current"], ["non_current", "Non-current"],
              ["low", "Low stock"], ["expiry", "Expiry"]
            ].map(([value, label]) => (
              <button key={value} className={filter === value ? "btn-primary whitespace-nowrap" : "btn-muted whitespace-nowrap"} onClick={() => setFilter(value)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        {visible.map((item) => (
          <InventoryCard
            key={item._id}
            item={item}
            onAdd={() => setMovementModal({ item, mode: "add" })}
            onUse={() => setMovementModal({ item, mode: "use" })}
            onAdjust={() => setMovementModal({ item, mode: "adjust" })}
            onHistory={() => setHistoryItem(item)}
            onEdit={() => setItemModal(toItemForm(item))}
            onArchive={() => archive(item)}
            onDelete={() => remove(item)}
          />
        ))}
      </section>
      {!loading && !visible.length && <div className="card p-10 text-center text-sm font-semibold text-slate-500">No inventory items match this view.</div>}
      {loading && <div className="card p-10 text-center text-sm font-semibold text-slate-500">Loading inventory...</div>}

      {itemModal && <ItemModal value={itemModal} onClose={() => setItemModal(null)} onSaved={() => { setItemModal(null); load(); }} />}
      {movementModal && <MovementModal {...movementModal} animals={animals} crops={crops} onClose={() => setMovementModal(null)} onSaved={() => { setMovementModal(null); load(); }} />}
      {historyItem && <HistoryModal item={historyItem} onClose={() => setHistoryItem(null)} />}
    </div>
  );
}

function InventoryCard({ item, onAdd, onUse, onAdjust, onHistory, onEdit, onArchive, onDelete }) {
  const optional = [
    item.storageLocation && ["Storage", item.storageLocation],
    item.expiryDate && ["Expiry", formatDate(item.expiryDate)]
  ].filter(Boolean);
  return (
    <article className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg font-black text-farm-950">{item.name}</h3>
            <StatusBadge status={item.status} />
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-500">{item.category} - {item.classification === "equipment_asset" ? "Equipment / Asset" : item.classification === "produce" ? "Produce" : "Consumable"}</p>
        </div>
        <details className="relative">
          <summary className="btn-muted list-none px-2" aria-label="More inventory actions"><MoreVertical className="h-4 w-4" /></summary>
          <div className="absolute right-0 z-20 mt-2 w-48 rounded-md border border-farm-100 bg-white p-1 shadow-xl">
            <MenuButton icon={History} label="View history" onClick={onHistory} />
            <MenuButton icon={Edit} label="Edit item" onClick={onEdit} />
            <MenuButton icon={SlidersHorizontal} label="Adjust stock" onClick={onAdjust} />
            <MenuButton icon={Archive} label="Archive" onClick={onArchive} />
            <MenuButton icon={Trash2} label="Delete" onClick={onDelete} danger />
          </div>
        </details>
      </div>
      <div className="mt-4 flex items-end justify-between gap-4 border-y border-farm-100 py-4">
        <div>
          <div className="label">Current quantity</div>
          <div className="mt-1 text-2xl font-black text-farm-950">{Number(item.currentQuantity).toLocaleString()} <span className="text-base text-slate-500">{item.unit}</span></div>
        </div>
        <div className="text-right">
          <div className="label">Inventory value</div>
          <div className="mt-1 font-black text-farm-900">{currency.format(item.inventoryValue || 0)}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <Info label="Minimum level" value={`${Number(item.minimumStockLevel || 0).toLocaleString()} ${item.unit}`} />
        {optional.map(([label, value]) => <Info key={label} label={label} value={value} />)}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="btn-primary justify-center" onClick={onAdd}><ArrowDownToLine className="h-4 w-4" /> Add stock</button>
        <button className="btn-muted justify-center" onClick={onUse} disabled={item.currentQuantity <= 0}><ArrowUpFromLine className="h-4 w-4" /> Use stock</button>
      </div>
    </article>
  );
}

function ItemModal({ value, onClose, onSaved }) {
  const [form, setForm] = useState(value);
  const [saving, setSaving] = useState(false);
  const edit = Boolean(form._id);
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        openingQuantity: Number(form.openingQuantity || 0),
        minimumStockLevel: Number(form.minimumStockLevel || 0),
        unitCost: Number(form.unitCost || 0),
        expiryDate: form.expiryDate || null
      };
      if (edit) await api.put(`/inventory/${form._id}`, payload);
      else await api.post("/inventory", payload);
      toast.success(edit ? "Inventory item updated" : "Inventory item added");
      onSaved();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not save inventory item");
    } finally { setSaving(false); }
  }
  return (
    <CrudModal title={edit ? "Edit inventory item" : "Add inventory item"} onClose={onClose}>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
        <Field label="Item name" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
        <Select label="Category" value={form.category} options={categories} onChange={(category) => setForm({ ...form, category })} />
        <Select label="Unit" value={form.unit} options={units} onChange={(unit) => setForm({ ...form, unit })} />
        {!edit && <Field label="Opening quantity" type="number" min="0" step="any" value={form.openingQuantity} onChange={(openingQuantity) => setForm({ ...form, openingQuantity })} />}
        <Field label="Minimum stock level" type="number" min="0" step="any" value={form.minimumStockLevel} onChange={(minimumStockLevel) => setForm({ ...form, minimumStockLevel })} />
        <Field label="Unit cost (optional)" type="number" min="0" step="any" value={form.unitCost} onChange={(unitCost) => setForm({ ...form, unitCost })} />
        <Field label="Storage location (optional)" value={form.storageLocation} onChange={(storageLocation) => setForm({ ...form, storageLocation })} />
        <Field label="Supplier (optional)" value={form.supplier} onChange={(supplier) => setForm({ ...form, supplier })} />
        <Field label="Expiry date (optional)" type="date" value={form.expiryDate} onChange={(expiryDate) => setForm({ ...form, expiryDate })} />
        <label className="space-y-1 sm:col-span-2"><span className="label">Notes (optional)</span><textarea className="input min-h-24" value={form.notes || ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" className="btn-muted" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save item"}</button>
        </div>
      </form>
    </CrudModal>
  );
}

function MovementModal({ item, mode, animals, crops, onClose, onSaved }) {
  const defaults = {
    type: mode === "add" ? "purchase" : mode === "use" ? "used" : "adjustment",
    quantity: "", newCount: mode === "adjust" ? item.currentQuantity : "", movementDate: inputDate(new Date()),
    unitCost: mode === "add" ? item.averageUnitCost || "" : "", supplier: mode === "add" ? item.supplier || "" : "",
    paymentMethod: "Mpesa", purchaseReference: "", usagePurpose: "", animal: "", crop: "",
    farmActivity: "", reason: "", notes: "", createFinanceExpense: false
  };
  const [form, setForm] = useState(defaults);
  const [saving, setSaving] = useState(false);
  const title = mode === "add" ? `Add stock - ${item.name}` : mode === "use" ? `Use stock - ${item.name}` : `Adjust stock - ${item.name}`;
  const nextBalance = mode === "adjust"
    ? Number(form.newCount || 0)
    : Number(item.currentQuantity) + (mode === "add" ? Number(form.quantity || 0) : -Number(form.quantity || 0));

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post(`/inventory/${item._id}/movements`, {
        ...form, quantity: Number(form.quantity || 0), newCount: Number(form.newCount || 0),
        unitCost: Number(form.unitCost || 0), animal: form.animal || null, crop: form.crop || null
      });
      toast.success("Stock balance updated");
      onSaved();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not update stock");
    } finally { setSaving(false); }
  }

  return (
    <CrudModal title={title} onClose={onClose}>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
        {mode === "add" && <Select label="Movement type" value={form.type} options={[["purchase", "Purchase"], ["stock_added", "Stock added"], ["transfer_in", "Transfer in"]]} onChange={(type) => setForm({ ...form, type })} pairs />}
        {mode === "use" && <Select label="Movement type" value={form.type} options={[["used", "Used"], ["sold", "Sold"], ["wasted", "Wasted"], ["expired", "Expired"], ["transfer_out", "Transfer out"]]} onChange={(type) => setForm({ ...form, type })} pairs />}
        {mode !== "adjust" && <Field label={`Quantity (${item.unit})`} type="number" min="0.000001" step="any" value={form.quantity} onChange={(quantity) => setForm({ ...form, quantity })} required />}
        {mode === "adjust" && <Field label={`New counted quantity (${item.unit})`} type="number" min="0" step="any" value={form.newCount} onChange={(newCount) => setForm({ ...form, newCount })} required />}
        <Field label="Date" type="date" value={form.movementDate} onChange={(movementDate) => setForm({ ...form, movementDate })} required />
        {mode === "add" && <Field label="Unit cost (optional)" type="number" min="0" step="any" value={form.unitCost} onChange={(unitCost) => setForm({ ...form, unitCost })} />}
        {mode === "add" && <Field label="Supplier (optional)" value={form.supplier} onChange={(supplier) => setForm({ ...form, supplier })} />}
        {mode === "add" && <Select label="Payment method" value={form.paymentMethod} options={paymentMethods} onChange={(paymentMethod) => setForm({ ...form, paymentMethod })} />}
        {mode === "add" && <Field label="Purchase reference (optional)" value={form.purchaseReference} onChange={(purchaseReference) => setForm({ ...form, purchaseReference })} />}
        {mode === "add" && (
          <label className="flex items-center gap-3 rounded-md border border-farm-100 p-3 sm:col-span-2">
            <input type="checkbox" checked={form.createFinanceExpense} onChange={(event) => setForm({ ...form, createFinanceExpense: event.target.checked })} />
            <span><span className="block font-bold text-farm-950">Add one Finance expense</span><span className="text-sm text-slate-500">Creates a linked purchase expense only once.</span></span>
          </label>
        )}
        {mode === "use" && <Field label="Usage purpose" value={form.usagePurpose} onChange={(usagePurpose) => setForm({ ...form, usagePurpose })} required />}
        {mode === "use" && <Select label="Animal (optional)" value={form.animal} options={[["", "None"], ...animals.map((animal) => [animal._id, animal.name || animal.animalId])]} onChange={(animal) => setForm({ ...form, animal })} pairs />}
        {mode === "use" && <Select label="Crop (optional)" value={form.crop} options={[["", "None"], ...crops.map((crop) => [crop._id, crop.name])]} onChange={(crop) => setForm({ ...form, crop })} pairs />}
        {mode === "use" && <Field label="Farm activity (optional)" value={form.farmActivity} onChange={(farmActivity) => setForm({ ...form, farmActivity })} />}
        {mode === "adjust" && <Field label="Reason" value={form.reason} onChange={(reason) => setForm({ ...form, reason })} required />}
        <label className="space-y-1 sm:col-span-2"><span className="label">Notes (optional)</span><textarea className="input min-h-20" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
        <div className={`rounded-md p-3 text-sm font-bold sm:col-span-2 ${nextBalance < 0 ? "bg-red-50 text-red-700" : "bg-field-cream text-farm-900"}`}>
          New balance: {nextBalance.toLocaleString()} {item.unit}
        </div>
        <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="btn-muted" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={saving || nextBalance < 0}>{saving ? "Saving..." : "Save movement"}</button></div>
      </form>
    </CrudModal>
  );
}

function HistoryModal({ item, onClose }) {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get(`/inventory/${item._id}/movements`).then(({ data }) => setMovements(data)).catch(() => toast.error("Could not load stock history")).finally(() => setLoading(false));
  }, [item._id]);
  return (
    <CrudModal title={`Stock history - ${item.name}`} onClose={onClose}>
      <div className="space-y-3">
        {movements.map((movement) => (
          <article key={movement._id} className="rounded-md border border-farm-100 p-3">
            <div className="flex items-start justify-between gap-3">
              <div><div className="font-black text-farm-950">{movementLabel(movement.type)}</div><div className="mt-1 text-sm text-slate-500">{formatDate(movement.movementDate)} - {movement.createdBy?.name || "Farm user"}</div></div>
              <div className={`font-black ${movement.quantityChange < 0 ? "text-red-700" : "text-farm-700"}`}>{movement.quantityChange > 0 ? "+" : ""}{movement.quantityChange.toLocaleString()} {item.unit}</div>
            </div>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
              <Info label="Balance after" value={`${movement.balanceAfter.toLocaleString()} ${item.unit}`} />
              {movement.unitCost > 0 && <Info label="Unit cost" value={currency.format(movement.unitCost)} />}
              {(movement.usagePurpose || movement.reason || movement.farmActivity) && <Info label="Activity" value={movement.usagePurpose || movement.reason || movement.farmActivity} />}
            </div>
            {movement.notes && <p className="mt-3 text-sm text-slate-600">{movement.notes}</p>}
          </article>
        ))}
        {loading && <div className="p-6 text-center text-sm text-slate-500">Loading history...</div>}
        {!loading && !movements.length && <div className="p-6 text-center text-sm text-slate-500">No stock movements recorded.</div>}
      </div>
    </CrudModal>
  );
}

function Summary({ label, value, alert }) {
  return <div className={`rounded-md border p-3 ${alert ? "border-amber-200 bg-amber-50" : "border-farm-100 bg-field-cream"}`}><div className="label">{label}</div><div className="mt-1 text-lg font-black text-farm-950">{value}</div></div>;
}
function StatusBadge({ status }) {
  const tone = status === "In stock" ? "bg-emerald-100 text-emerald-800" : status === "Low stock" || status === "Expiring soon" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700";
  return <span className={`badge ${tone}`}>{status}</span>;
}
function MenuButton({ icon: Icon, label, onClick, danger }) {
  return <button className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm font-bold hover:bg-field-cream ${danger ? "text-red-700" : "text-slate-700"}`} onClick={onClick}><Icon className="h-4 w-4" /> {label}</button>;
}
function Field({ label, value, onChange, type = "text", required, min, step }) {
  return <label className="space-y-1"><span className="label">{label}</span><input className="input" type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} required={required} min={min} step={step} /></label>;
}
function Select({ label, value, options, onChange, pairs }) {
  return <label className="space-y-1"><span className="label">{label}</span><select className="input" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => { const [key, text] = pairs ? option : [option, option]; return <option key={key || "none"} value={key}>{text}</option>; })}</select></label>;
}
function Info({ label, value }) {
  return <div><span className="label block">{label}</span><span className="font-bold text-slate-700">{value}</span></div>;
}
function toItemForm(item) {
  return { ...item, openingQuantity: item.openingQuantity || "", minimumStockLevel: item.minimumStockLevel || "", unitCost: item.averageUnitCost || "", expiryDate: inputDate(item.expiryDate) };
}
function movementLabel(type) {
  return String(type || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
