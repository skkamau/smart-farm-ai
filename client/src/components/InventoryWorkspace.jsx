import {
  AlertTriangle, Archive, ArrowDownToLine, ArrowUpFromLine, BarChart3,
  ClipboardList, Download, Edit, History, MoreVertical, PackageSearch,
  Plus, Search, SlidersHorizontal, Trash2
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
  unitCost: "", storageLocation: "", supplier: "", expiryDate: "", notes: "",
  openingIsPurchase: false, paymentMethod: "Mpesa"
};

const tabs = [
  ["overview", "Overview"], ["items", "Items"], ["movements", "Stock movements"],
  ["alerts", "Alerts"], ["reports", "Reports"]
];

export default function InventoryWorkspace({ animals = [], groups = [], crops = [] }) {
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [itemModal, setItemModal] = useState(null);
  const [movementModal, setMovementModal] = useState(null);
  const [editingMovement, setEditingMovement] = useState(null);
  const [historyItem, setHistoryItem] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [itemRes, movementRes] = await Promise.all([
        api.get("/inventory"), api.get("/inventory/movements")
      ]);
      setItems(itemRes.data);
      setMovements(movementRes.data);
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
  const outCount = items.filter((item) => item.status === "Out of stock").length;
  const expiryCount = items.filter((item) => ["Expired", "Expiring soon"].includes(item.status)).length;

  async function archive(item) {
    try {
      await api.patch(`/inventory/${item._id}/archive`, { archived: true });
      toast.success("Inventory item archived");
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not archive inventory item");
    }
  }

  async function remove(item) {
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
          <div>
            <div className="label">Stock control</div>
            <h1 className="mt-1 text-2xl font-black text-farm-950">Inventory</h1>
            <p className="mt-1 text-sm text-slate-500">Manage quantities, purchases, usage, expiry and stock alerts separately from Finance.</p>
          </div>
          <button className="btn-primary" onClick={() => setItemModal(blankItem)}><Plus className="h-4 w-4" /> Add inventory</button>
        </div>
      </section>

      <nav className="card p-2" aria-label="Inventory sections">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map(([value, label]) => (
            <button key={value} className={activeTab === value ? "btn-primary whitespace-nowrap" : "btn-muted whitespace-nowrap"} onClick={() => setActiveTab(value)}>
              {label}
            </button>
          ))}
        </div>
      </nav>

      {activeTab === "overview" && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Summary label="Inventory items" value={items.length.toLocaleString()} />
            <Summary label="Inventory value" value={currency.format(totalValue)} />
            <Summary label="Low stock" value={lowCount.toLocaleString()} alert={lowCount > 0} />
            <Summary label="Out of stock" value={outCount.toLocaleString()} alert={outCount > 0} />
            <Summary label="Expiring soon" value={expiryCount.toLocaleString()} alert={expiryCount > 0} />
          </section>
          <section className="card p-4">
            <div className="label">Latest activity</div>
            <h2 className="mt-1 text-lg font-black text-farm-950">Recent stock movements</h2>
            <MovementList movements={movements.slice(0, 8)} />
          </section>
        </>
      )}

      {activeTab === "items" && (
        <>
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
        </>
      )}

      {activeTab === "movements" && <section className="card p-4"><div className="label">Stock ledger</div><h2 className="mt-1 text-lg font-black text-farm-950">All stock movements</h2><MovementList movements={movements} /></section>}
      {activeTab === "alerts" && <InventoryAlerts items={items} />}
      {activeTab === "reports" && <InventoryReports items={items} movements={movements} />}
      {loading && <div className="card p-10 text-center text-sm font-semibold text-slate-500">Loading inventory...</div>}

      {itemModal && <ItemModal value={itemModal} onClose={() => setItemModal(null)} onSaved={() => { setItemModal(null); load(); }} />}
      {movementModal && <MovementModal {...movementModal} animals={animals} groups={groups} crops={crops} onClose={() => setMovementModal(null)} onSaved={() => { setMovementModal(null); load(); }} />}
      {editingMovement && <MovementModal item={editingMovement.item} mode="add" existing={editingMovement.movement} animals={animals} groups={groups} crops={crops} onClose={() => setEditingMovement(null)} onSaved={() => { setEditingMovement(null); setHistoryItem(null); load(); }} />}
      {historyItem && <HistoryModal item={historyItem} onEdit={(movement) => setEditingMovement({ item: historyItem, movement })} onClose={() => setHistoryItem(null)} />}
    </div>
  );
}

function MovementList({ movements }) {
  return (
    <div className="mt-3 divide-y divide-farm-100">
      {movements.map((movement) => (
        <article key={movement._id} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="min-w-0">
            <div className="font-black text-farm-950">{movement.item?.name || "Inventory item"}</div>
            <div className="mt-1 text-sm text-slate-500">{movementLabel(movement.type)} - {formatDate(movement.movementDate)}</div>
          </div>
          <div className={`font-black ${movement.quantityChange < 0 ? "text-red-700" : "text-farm-700"}`}>
            {movement.quantityChange > 0 ? "+" : ""}{Number(movement.quantityChange).toLocaleString()} {movement.item?.unit || ""}
          </div>
        </article>
      ))}
      {!movements.length && <div className="p-8 text-center text-sm font-semibold text-slate-500">No stock movements recorded.</div>}
    </div>
  );
}

function InventoryAlerts({ items }) {
  const groups = [
    ["Low stock", items.filter((item) => item.status === "Low stock")],
    ["Out of stock", items.filter((item) => item.status === "Out of stock")],
    ["Expiry alerts", items.filter((item) => ["Expired", "Expiring soon"].includes(item.status))]
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {groups.map(([title, records]) => (
        <section key={title} className="card p-4">
          <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" /><h2 className="font-black text-farm-950">{title}</h2></div>
          <div className="mt-3 divide-y divide-farm-100">
            {records.map((item) => <div key={item._id} className="py-3"><div className="font-bold text-farm-950">{item.name}</div><div className="mt-1 text-sm text-slate-500">{Number(item.currentQuantity).toLocaleString()} {item.unit} - {item.status}</div></div>)}
            {!records.length && <div className="py-6 text-center text-sm text-slate-500">No alerts.</div>}
          </div>
        </section>
      ))}
    </div>
  );
}

function InventoryReports({ items, movements }) {
  const reports = [
    { label: "Current stock", icon: PackageSearch, rows: items.map(itemReportRow) },
    { label: "Inventory valuation", icon: BarChart3, rows: items.map(itemReportRow) },
    { label: "Low stock", icon: AlertTriangle, rows: items.filter((item) => item.status === "Low stock").map(itemReportRow) },
    { label: "Out of stock", icon: AlertTriangle, rows: items.filter((item) => item.status === "Out of stock").map(itemReportRow) },
    { label: "Expiring items", icon: AlertTriangle, rows: items.filter((item) => ["Expired", "Expiring soon"].includes(item.status)).map(itemReportRow) },
    {
      label: "Stock movement history", icon: ClipboardList,
      rows: movements.map((movement) => ({
        Date: inputDate(movement.movementDate), Item: movement.item?.name || "",
        Type: movementLabel(movement.type), Change: movement.quantityChange,
        "Balance after": movement.balanceAfter, Unit: movement.item?.unit || "",
        "Linked record": movement.animal?.animalId || movement.animalGroup?.groupName || movement.crop?.name || movement.farmActivity || ""
      }))
    }
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {reports.map(({ label, icon: Icon, rows }) => (
        <section key={label} className="card p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-field-sage text-farm-800"><Icon className="h-5 w-5" /></span>
            <div><h2 className="font-black text-farm-950">{label}</h2><p className="mt-1 text-sm text-slate-500">{rows.length} record{rows.length === 1 ? "" : "s"}</p></div>
          </div>
          <button className="btn-muted mt-4 w-full justify-center" onClick={() => downloadCsv(`inventory_${fileSlug(label)}_${inputDate(new Date())}.csv`, rows)} disabled={!rows.length}>
            <Download className="h-4 w-4" /> Download CSV
          </button>
        </section>
      ))}
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
        {!edit && Number(form.openingQuantity || 0) > 0 && (
          <label className="flex items-center gap-3 rounded-md border border-farm-100 p-3 sm:col-span-2">
            <input type="checkbox" checked={form.openingIsPurchase} onChange={(event) => setForm({ ...form, openingIsPurchase: event.target.checked })} />
            <span><span className="block font-bold text-farm-950">This opening stock is a current purchase</span><span className="text-sm text-slate-500">Create one Finance expense using opening quantity x unit cost.</span></span>
          </label>
        )}
        {!edit && form.openingIsPurchase && <Select label="Payment method" value={form.paymentMethod} options={paymentMethods} onChange={(paymentMethod) => setForm({ ...form, paymentMethod })} />}
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

function MovementModal({ item, mode, existing, animals, groups, crops, onClose, onSaved }) {
  const defaults = {
    type: existing?.type || (mode === "add" ? "purchase" : mode === "use" ? "used" : "adjustment"),
    quantity: existing?.quantity || "", newCount: mode === "adjust" ? item.currentQuantity : "",
    movementDate: inputDate(existing?.movementDate || new Date()),
    unitCost: existing?.unitCost || (mode === "add" ? item.averageUnitCost || "" : ""),
    supplier: existing?.supplier || (mode === "add" ? item.supplier || "" : ""),
    paymentMethod: existing?.paymentMethod || "Mpesa", purchaseReference: existing?.purchaseReference || "",
    usagePurpose: existing?.usagePurpose || "", animal: existing?.animal?._id || existing?.animal || "",
    animalGroup: existing?.animalGroup?._id || existing?.animalGroup || "",
    crop: existing?.crop?._id || existing?.crop || "", farmActivity: existing?.farmActivity || "",
    reason: existing?.reason || "", notes: existing?.notes || "",
    createFinanceExpense: Boolean(existing?.financeTransaction)
  };
  const [form, setForm] = useState(defaults);
  const [saving, setSaving] = useState(false);
  const title = existing ? `Edit stock purchase - ${item.name}` : mode === "add" ? `Add stock - ${item.name}` : mode === "use" ? `Use stock - ${item.name}` : `Adjust stock - ${item.name}`;
  const nextBalance = mode === "adjust"
    ? Number(form.newCount || 0)
    : Number(item.currentQuantity) + (mode === "add" ? Number(form.quantity || 0) : -Number(form.quantity || 0));

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form, quantity: Number(form.quantity || 0), newCount: Number(form.newCount || 0),
        unitCost: Number(form.unitCost || 0), animal: form.animal || null,
        animalGroup: form.animalGroup || null, crop: form.crop || null
      };
      if (existing) await api.put(`/inventory/${item._id}/movements/${existing._id}`, payload);
      else await api.post(`/inventory/${item._id}/movements`, payload);
      toast.success(existing ? "Stock purchase updated" : "Stock balance updated");
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
        {mode === "add" && form.type === "purchase" && (
          <label className="flex items-center gap-3 rounded-md border border-farm-100 p-3 sm:col-span-2">
            <input type="checkbox" checked={form.createFinanceExpense} disabled={Boolean(existing?.financeTransaction)} onChange={(event) => setForm({ ...form, createFinanceExpense: event.target.checked })} />
            <span>
              <span className="block font-bold text-farm-950">{existing?.financeTransaction ? "Update linked Finance expense" : "Add one Finance expense"}</span>
              <span className="text-sm text-slate-500">{existing?.financeTransaction ? "This purchase already has one linked expense. The same expense will be updated." : "Creates a linked purchase expense only once."}</span>
            </span>
          </label>
        )}
        {mode === "use" && <Field label="Purpose" value={form.usagePurpose} onChange={(usagePurpose) => setForm({ ...form, usagePurpose })} required />}
        {mode === "use" && <Select label="Animal (optional)" value={form.animal} options={[["", "None"], ...animals.map((animal) => [animal._id, animal.name || animal.animalId])]} onChange={(animal) => setForm({ ...form, animal })} pairs />}
        {mode === "use" && <Select label="Animal group (optional)" value={form.animalGroup} options={[["", "None"], ...groups.map((group) => [group._id, group.groupName || group.groupId])]} onChange={(animalGroup) => setForm({ ...form, animalGroup })} pairs />}
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

function HistoryModal({ item, onEdit, onClose }) {
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
            {["purchase", "stock_added", "transfer_in"].includes(movement.type) && (
              <button className="btn-muted mt-3" onClick={() => onEdit(movement)}><Edit className="h-4 w-4" /> Edit stock addition</button>
            )}
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

function itemReportRow(item) {
  return {
    Item: item.name, Category: item.category, Classification: item.classification,
    Quantity: item.currentQuantity, Unit: item.unit, Status: item.status,
    "Minimum stock": item.minimumStockLevel, "Average unit cost": item.averageUnitCost,
    "Inventory value": item.inventoryValue, "Storage location": item.storageLocation || "",
    Supplier: item.supplier || "", "Expiry date": inputDate(item.expiryDate)
  };
}

function fileSlug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function downloadCsv(filename, rows) {
  if (!rows.length) return;
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [headers.map(escape).join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
