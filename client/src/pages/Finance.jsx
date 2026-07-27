import { Download, Edit, FileSpreadsheet, FileText, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import CrudModal from "../components/CrudModal";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import InventoryWorkspace from "../components/InventoryWorkspace";
import api from "../services/api";
import { currency, formatDate, inputDate } from "../utils";
import { downloadReport, todayStamp } from "../utils/downloads";

const tabs = [
  { id: "Overview", label: "Overview" },
  { id: "Income", label: "Income" },
  { id: "Expenses", label: "Expenses" },
  { id: "CropExpense", label: "Crop Expenses" },
  { id: "AnimalHealth", label: "Animal Health" },
  { id: "Construction", label: "Construction" },
  { id: "Inventory", label: "Inventory" },
  { id: "Equipment", label: "Equipment" },
  { id: "Feed", label: "Feed" },
  { id: "Fuel", label: "Fuel" },
  { id: "Consumables", label: "Consumables" },
  { id: "CashSavings", label: "Cash & Savings" },
  { id: "Reports", label: "Reports" }
];

const workspaceTabs = [
  { id: "Overview", label: "Overview" },
  { id: "Income", label: "Income" },
  { id: "Expenses", label: "Expenses" },
  { id: "Inventory", label: "Inventory" },
  { id: "Reports", label: "Reports" },
  { id: "Downloads", label: "Downloads" },
  { id: "Settings", label: "Settings" }
];

const stockSections = ["Feed", "Fuel", "Consumables"];
const inventorySections = ["Equipment", "Feed", "Fuel", "Consumables"];
const expenseSections = ["Expenses", "CropExpense", "AnimalHealth", "Construction", "Feed", "Fuel", "Equipment", "Consumables"];
const paymentMethods = ["Mpesa", "Bank Transfer", "Cash", "Other"];

const sectionItems = {
  Income: ["Animal sale", "Milk sale", "Crop sale", "Manure sale", "Service income", "Other income"],
  CropExpense: ["Fertilizer", "Weed killer", "Pesticide", "Seeds", "Labour", "Irrigation", "Transport", "Equipment use", "Harvesting", "Storage", "Other"],
  AnimalHealth: ["Vet consultation", "Vaccination", "Deworming", "Treatment", "Surgery", "Medicine", "Lab test", "Emergency visit", "Pregnancy check", "Artificial insemination", "Other"],
  Feed: ["Hay", "Maize germ", "Daily Meal", "Pellets", "Salt with Copper", "Salt without Copper", "Salt Powder"],
  Fuel: ["Fuel (Petrol)"],
  Consumables: ["Eartags Blue Single", "Eartags Blue 2 pieces", "Eartags Green 2 pieces", "Syringes 10ml", "Syringes 20ml", "Needles"],
  Construction: ["Shed Construction", "Fence", "Labour", "Materials"],
  Equipment: ["Solar Inverter", "Solar Battery", "Solar Pump", "Power Sprayer", "Motorized Chopper", "Motorcycle", "Clipper", "Water Tank"],
  Expenses: ["Medicine", "Labour", "Transport", "Utilities", "Other"]
};

const emptyRecord = {
  type: "expense",
  financeSection: "Expenses",
  category: "Other",
  transactionDate: inputDate(new Date()),
  item: "",
  description: "",
  quantity: "",
  unit: "",
  unitCost: "",
  amount: "",
  paymentMethod: "Mpesa",
  crop: "",
  animal: "",
  supplierVendor: "",
  storageLocation: "",
  inventoryStatus: "",
  minimumStockLevel: "",
  expiryDate: "",
  quantityIn: "",
  quantityOut: "",
  balance: "",
  month: "",
  cashAmount: "",
  savingsAmount: "",
  serviceCharge: "",
  medicineCost: "",
  transportCost: "",
  otherCost: "",
  followUpDate: "",
  remarks: "",
  notes: ""
};

export default function Finance() {
  const [records, setRecords] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [crops, setCrops] = useState([]);
  const [animals, setAnimals] = useState([]);
  const [activeTab, setActiveTab] = useState("Overview");
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ crop: "", animal: "", category: "", paymentMethod: "", dateFrom: "", dateTo: "" });

  function load() {
    Promise.all([api.get("/transactions"), api.get("/crops"), api.get("/animals"), api.get("/inventory")])
      .then(([transactionRes, cropRes, animalRes, inventoryRes]) => {
        setRecords(transactionRes.data);
        setCrops(cropRes.data);
        setAnimals(animalRes.data);
        setInventoryItems(inventoryRes.data);
      })
      .catch(() => toast.error("Could not load finance records"));
  }

  useEffect(load, []);

  const summary = useMemo(() => {
    const base = buildSummary(records);
    base.currentInventoryValue = inventoryItems
      .filter((item) => item.classification !== "equipment_asset")
      .reduce((sum, item) => sum + Number(item.inventoryValue || 0), 0);
    base.nonCurrentInventoryValue = inventoryItems
      .filter((item) => item.classification === "equipment_asset")
      .reduce((sum, item) => sum + Number(item.inventoryValue || 0), 0);
    base.lowStockItems = inventoryItems.filter((item) => ["Low stock", "Out of stock"].includes(item.status)).length;
    return base;
  }, [records, inventoryItems]);
  const filteredRecords = useMemo(() => {
    let sectionRecords = recordsForWorkspace(activeTab, records);
    if (filters.crop) sectionRecords = sectionRecords.filter((record) => entityId(record.crop) === filters.crop);
    if (filters.animal) sectionRecords = sectionRecords.filter((record) => entityId(record.animal) === filters.animal);
    if (filters.category) sectionRecords = sectionRecords.filter((record) => record.category === filters.category);
    if (filters.paymentMethod) sectionRecords = sectionRecords.filter((record) => record.paymentMethod === filters.paymentMethod);
    if (filters.dateFrom) sectionRecords = sectionRecords.filter((record) => new Date(record.transactionDate) >= new Date(filters.dateFrom));
    if (filters.dateTo) sectionRecords = sectionRecords.filter((record) => new Date(record.transactionDate) <= new Date(filters.dateTo));
    const term = search.trim().toLowerCase();
    if (!term) return sectionRecords;
    return sectionRecords.filter((record) => [record.item, record.description, record.category, record.paymentMethod, record.remarks, record.notes, record.month, cropLabel(record.crop), animalLabel(record.animal)].join(" ").toLowerCase().includes(term));
  }, [records, activeTab, search, filters]);

  async function remove(id) {
    if (!confirm("Delete this finance record?")) return;
    await api.delete(`/transactions/${id}`);
    toast.success("Finance record deleted");
    load();
  }

  function startAdd(section = activeTab) {
    const financeSection = section === "Overview" || section === "Reports" || section === "Downloads" || section === "Settings" ? "Expenses" : section === "Inventory" ? "Feed" : section;
    setEditing({ ...emptyRecord, financeSection, category: defaultCategory(financeSection), item: sectionItems[financeSection]?.[0] || "" });
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Finance" eyebrow="Subukia goat shed records" action={<FinancePrimaryAction activeTab={activeTab} onAdd={startAdd} />} />
      <FinanceNavigation activeTab={activeTab} setActiveTab={setActiveTab} />

      {activeTab === "Overview" && <Overview summary={summary} onAdd={startAdd} onSelect={setActiveTab} />}
      {activeTab === "Income" && (
        <IncomeSection records={filteredRecords} allRecords={records} summary={summary} crops={crops} animals={animals} filters={filters} setFilters={setFilters} search={search} setSearch={setSearch} onAdd={() => startAdd("Income")} onEdit={setEditing} onDelete={remove} />
      )}
      {activeTab === "Expenses" && (
        <ExpensesSection records={filteredRecords} allRecords={records} summary={summary} crops={crops} animals={animals} filters={filters} setFilters={setFilters} search={search} setSearch={setSearch} onAdd={startAdd} onEdit={setEditing} onDelete={remove} />
      )}
      {activeTab === "Inventory" && <InventoryWorkspace animals={animals} crops={crops} onBack={() => setActiveTab("Overview")} />}
      {activeTab === "Reports" && <Reports summary={summary} records={records} />}
      {activeTab === "Downloads" && <DownloadsSection filters={filters} />}
      {activeTab === "Settings" && <FinanceSettingsPanel activeTab={activeTab} />}

      {editing && <FinanceModal record={editing} crops={crops} animals={animals} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function FinancePrimaryAction({ activeTab, onAdd }) {
  if (activeTab === "Income") return <button className="btn-primary" onClick={() => onAdd("Income")}><Plus className="h-4 w-4" /> Add Income</button>;
  if (activeTab === "Expenses") return <button className="btn-primary" onClick={() => onAdd("Expenses")}><Plus className="h-4 w-4" /> Add Expense</button>;
  if (activeTab === "Inventory") return null;
  return <button className="btn-primary" onClick={() => onAdd("Expenses")}><Plus className="h-4 w-4" /> Add record</button>;
}

function FinanceNavigation({ activeTab, setActiveTab }) {
  return (
    <section className="card p-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {workspaceTabs.map((tab) => (
          <button key={tab.id} className={activeTab === tab.id ? "btn-primary whitespace-nowrap" : "btn-muted whitespace-nowrap"} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function FinanceExportBar({ activeTab, filters, title = "Export current finance view", exportParams = {} }) {
  const type = financeExportType(activeTab);
  const params = { ...filters, ...exportParams };
  Object.keys(params).forEach((key) => !params[key] && delete params[key]);
  const base = `finance_${type}_${todayStamp()}`;
  return (
    <section className="card p-4">
      <div className="label">Downloads</div>
      <div className="mt-1 font-black text-farm-950">{title}</div>
      <p className="mt-2 text-sm font-semibold text-slate-500">Downloads respect the active section and filters.</p>
      <div className="mt-4 grid gap-2">
        <button className="btn-primary" onClick={() => downloadReport(type, "pdf", `${base}.pdf`, params)}><Download className="h-4 w-4" /> PDF</button>
        <button className="btn-muted" onClick={() => downloadReport(type, "csv", `${base}.csv`, params)}><FileText className="h-4 w-4" /> CSV</button>
        <button className="btn-muted" onClick={() => downloadReport(type, "xlsx", `${base}.xlsx`, params)}><FileSpreadsheet className="h-4 w-4" /> Excel</button>
      </div>
    </section>
  );
}

function financeExportType(tab) {
  const map = {
    Overview: "finance",
    Reports: "finance",
    Income: "finance",
    Expenses: "finance",
    CropExpense: "crop-expenses",
    AnimalHealth: "animal-health",
    Inventory: "finance",
    Construction: "construction",
    Equipment: "equipment",
    Feed: "feed",
    Fuel: "fuel",
    Consumables: "consumables",
    CashSavings: "cash-savings"
  };
  return map[tab] || "finance";
}

function Overview({ summary, onAdd, onSelect }) {
  const inventory = summary.currentInventoryValue + summary.nonCurrentInventoryValue;
  return (
    <>
      <section className="card p-5">
        <div className="label">Finance overview</div>
        <h2 className="mt-1 text-xl font-black text-farm-950">Key farm money numbers</h2>
        <p className="mt-1 text-sm font-semibold text-slate-500">Choose a section below when you need details, records, reports, or downloads.</p>
      </section>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total Income" value={currency.format(summary.totalIncome)} />
        <StatCard label="Total Expenses" value={currency.format(summary.totalExpenses)} tone="amber" />
        <StatCard label="Profit / loss" value={currency.format(summary.totalIncome - summary.totalExpenses)} tone={summary.totalIncome >= summary.totalExpenses ? "slate" : "amber"} />
        <StatCard label="Cash Available" value={currency.format(summary.cash)} />
        <StatCard label="Inventory Value" value={currency.format(inventory)} tone="slate" />
        <StatCard label="Low Stock Alerts" value={summary.lowStockItems.toLocaleString()} tone={summary.lowStockItems ? "amber" : "slate"} />
      </div>
      <section className="card p-5">
        <div className="label">Shortcuts</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <button className="btn-primary justify-center" onClick={() => onAdd("Income")}><Plus className="h-4 w-4" /> Add Income</button>
          <button className="btn-muted justify-center" onClick={() => onAdd("Expenses")}><Plus className="h-4 w-4" /> Add Expense</button>
          <button className="btn-muted justify-center" onClick={() => onSelect("Inventory")}>Open Inventory</button>
          <button className="btn-muted justify-center" onClick={() => onSelect("Reports")}>View Reports</button>
        </div>
      </section>
    </>
  );
}

function ProgressRow({ label, value, total }) {
  const width = Math.min(100, Math.round((Number(value || 0) / total) * 100));
  return (
    <div className="rounded-lg border border-farm-100 bg-white p-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-black text-farm-950">{label}</span>
        <span className="font-black text-slate-700">{currency.format(value)}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-field-sage">
        <div className="h-full rounded-full bg-farm-700" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function IncomeSection({ records, allRecords, summary, crops, animals, filters, setFilters, search, setSearch, onAdd, onEdit, onDelete }) {
  const sources = Object.entries(summary.byIncomeSource).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return (
    <div className="space-y-5">
      <SectionHeader eyebrow="Income" title="Farm income records" description="Sales, cash income, and savings records stay here without expense or inventory clutter." action={<button className="btn-primary" onClick={onAdd}><Plus className="h-4 w-4" /> Add Income</button>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total Income" value={currency.format(summary.totalIncome)} />
        <StatCard label="This Month" value={currency.format(summary.monthlyIncome)} tone="slate" />
        <StatCard label="Cash & Savings" value={currency.format(summary.cash + summary.savings)} />
      </div>
      <FinanceFilters records={allRecords.filter((record) => record.type === "income")} crops={crops} animals={animals} filters={filters} setFilters={setFilters} search={search} setSearch={setSearch} />
      <section className="grid gap-5 xl:grid-cols-[0.7fr_1fr]">
        <div className="card p-5">
          <h3 className="mb-4 font-black text-farm-950">Income source breakdown</h3>
          <div className="space-y-2">
            {sources.map(([label, value]) => <ProgressRow key={label} label={label} value={value} total={summary.totalIncome || 1} />)}
            {!sources.length && <EmptyState text="No income sources added yet." />}
          </div>
        </div>
        <div>
          <FinanceList records={records} section="Income" onEdit={onEdit} onDelete={onDelete} emptyText="No income added yet." />
        </div>
      </section>
    </div>
  );
}

function ExpensesSection({ records, allRecords, summary, crops, animals, filters, setFilters, search, setSearch, onAdd, onEdit, onDelete }) {
  const [expenseFilter, setExpenseFilter] = useState("All");
  const filtered = records.filter((record) => {
    if (expenseFilter === "All") return true;
    if (expenseFilter === "CropExpense") return sectionOf(record) === "CropExpense";
    if (expenseFilter === "AnimalHealth") return sectionOf(record) === "AnimalHealth";
    return sectionOf(record) === expenseFilter;
  });
  const expenseOptions = [
    ["All", "All expenses"],
    ["CropExpense", "Crop expenses"],
    ["AnimalHealth", "Animal health"],
    ["Feed", "Feed"],
    ["Fuel", "Fuel"],
    ["Equipment", "Equipment"],
    ["Construction", "Construction"],
    ["Consumables", "Consumables"]
  ];
  return (
    <div className="space-y-5">
      <SectionHeader eyebrow="Expenses" title="Manage farm expenses" description="Review and record costs without inventory, downloads, or settings taking over the page." action={<button className="btn-primary" onClick={() => onAdd("Expenses")}><Plus className="h-4 w-4" /> Add Expense</button>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total Expenses" value={currency.format(summary.totalExpenses)} tone="amber" />
        <StatCard label="Crop Expenses" value={currency.format(summary.cropExpenses)} tone="amber" />
        <StatCard label="Animal Health Expenses" value={currency.format(summary.animalHealth)} tone="amber" />
        <StatCard label="Feed Costs" value={currency.format(summary.feed)} />
        <StatCard label="Fuel Costs" value={currency.format(summary.fuel)} tone="amber" />
        <StatCard label="Equipment Costs" value={currency.format(summary.equipment)} />
      </div>
      <FinanceFilters records={allRecords.filter((record) => record.type === "expense")} crops={crops} animals={animals} filters={filters} setFilters={setFilters} search={search} setSearch={setSearch} />
      <section className="card p-4">
        <div className="label mb-3">Expense type</div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {expenseOptions.map(([value, label]) => (
            <button key={value} className={expenseFilter === value ? "btn-primary whitespace-nowrap" : "btn-muted whitespace-nowrap"} onClick={() => setExpenseFilter(value)}>
              {label}
            </button>
          ))}
        </div>
      </section>
      <FinanceList records={filtered} section="Expenses" onEdit={onEdit} onDelete={onDelete} emptyText="No expenses added yet." />
    </div>
  );
}

function SectionHeader({ eyebrow, title, description, action }) {
  return (
    <section className="card p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="label">{eyebrow}</div>
          <h2 className="mt-1 text-xl font-black text-farm-950">{title}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">{description}</p>
        </div>
        {action}
      </div>
    </section>
  );
}

function DownloadsSection({ filters }) {
  const exportRows = [
    ["Export all finance data", "Overview", {}],
    ["Export income", "Income", { type: "income" }],
    ["Export expenses", "Expenses", { type: "expense" }],
    ["Export inventory", "Inventory", { financeSections: inventorySections.join(",") }],
    ["Export reports", "Reports", {}]
  ];
  return (
    <div className="space-y-5">
      <SectionHeader eyebrow="Downloads" title="Export finance records" description="All finance export buttons are collected here so daily work screens stay clean." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {exportRows.map(([label, type, exportParams]) => (
          <FinanceExportBar key={label} activeTab={type} filters={filters} title={label} exportParams={exportParams} />
        ))}
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return <div className="rounded-xl border border-dashed border-farm-100 bg-white p-8 text-center text-sm font-semibold text-slate-500">{text}</div>;
}

function QuickAddPanel({ onAdd }) {
  return (
    <section className="card p-4">
      <div className="label">Actions</div>
      <div className="mt-1 font-black text-farm-950">Quick add record</div>
      <div className="mt-4 grid gap-2">
        {tabs.filter((tab) => !["Overview", "Inventory", "Reports"].includes(tab.id)).map((tab) => (
          <button key={tab.id} className="btn-muted justify-between" onClick={() => onAdd(tab.id)}>
            {tab.label}
            <Plus className="h-4 w-4" />
          </button>
        ))}
      </div>
    </section>
  );
}

function FinanceSettingsPanel({ activeTab }) {
  return (
    <section className="card p-4">
      <div className="label">Settings</div>
      <div className="mt-1 font-black text-farm-950">Current section setup</div>
      <div className="mt-3 space-y-2 text-sm font-semibold text-slate-600">
        <div className="rounded-lg bg-field-cream p-3">Section: {labelFor(activeTab)}</div>
        <div className="rounded-lg bg-field-cream p-3">Payment methods: {paymentMethods.join(", ")}</div>
        <div className="rounded-lg bg-field-cream p-3">Categories preserved from existing finance records.</div>
      </div>
    </section>
  );
}

function Inventory({ records, summary, onAdd, onEdit, onDelete, onBack }) {
  const [inventoryFilter, setInventoryFilter] = useState("All");
  const [inventorySearch, setInventorySearch] = useState("");
  const allItems = aggregateInventory(records);
  const currentItems = allItems.filter((item) => item.kind === "Current");
  const nonCurrentItems = allItems.filter((item) => item.kind === "NonCurrent");
  const filteredItems = allItems.filter((item) => {
    if (inventoryFilter === "Current" && item.kind !== "Current") return false;
    if (inventoryFilter === "NonCurrent" && item.kind !== "NonCurrent") return false;
    if (inventoryFilter === "LowStock" && !item.lowStock) return false;
    if (inventoryFilter === "Finished" && item.status !== "Finished") return false;
    if (inventoryFilter === "ExpiringSoon" && !item.expiringSoon) return false;
    const term = inventorySearch.trim().toLowerCase();
    if (!term) return true;
    return [item.name, item.category, item.unit, item.storageLocation, item.status, item.supplierVendor].join(" ").toLowerCase().includes(term);
  });
  const currentValue = currentItems.reduce((sum, item) => sum + item.value, 0);
  const nonCurrentValue = nonCurrentItems.reduce((sum, item) => sum + item.value, 0);
  const lowStockCount = currentItems.filter((item) => item.lowStock).length;
  const finishedCount = allItems.filter((item) => item.status === "Finished").length;

  return (
    <div className="space-y-5">
      <section className="card p-5">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <div className="label">Inventory</div>
            <h2 className="mt-1 text-xl font-black text-farm-950">All farm inventory</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Current inventory covers feed, fuel and consumables. Non-current inventory covers tools and equipment.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-muted" onClick={onBack}>Back to finance</button>
            <button className="btn-primary" onClick={() => onAdd("Feed")}><Plus className="h-4 w-4" /> Add Inventory</button>
            <button className="btn-muted" onClick={() => onAdd("Equipment")}>Add tool/equipment</button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MiniStat label="Total inventory value" value={currency.format(currentValue + nonCurrentValue)} />
          <MiniStat label="Current inventory value" value={currency.format(currentValue)} />
          <MiniStat label="Non-current inventory value" value={currency.format(nonCurrentValue)} />
          <MiniStat label="Low stock items" value={lowStockCount.toLocaleString()} />
          <MiniStat label="Finished items" value={finishedCount.toLocaleString()} />
        </div>
      </section>

      <section className="card p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <label className="space-y-1">
            <span className="label">Search inventory</span>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-slate-400" />
              <input className="input" placeholder="Search item name, category, location, status" value={inventorySearch} onChange={(event) => setInventorySearch(event.target.value)} />
            </div>
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              ["All", "All inventory"],
              ["Current", "Current Inventory"],
              ["NonCurrent", "Non-Current Inventory"],
              ["LowStock", "Low Stock"],
              ["Finished", "Finished"],
              ["ExpiringSoon", "Expiring Soon"]
            ].map(([value, label]) => (
              <button key={value} className={inventoryFilter === value ? "btn-primary whitespace-nowrap" : "btn-muted whitespace-nowrap"} onClick={() => setInventoryFilter(value)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <div className="label">Inventory list</div>
            <h3 className="mt-1 font-black text-farm-950">{filteredItems.length} item{filteredItems.length === 1 ? "" : "s"}</h3>
          </div>
          <div className="text-sm font-semibold text-slate-500">Current: {currentItems.length} / Non-current: {nonCurrentItems.length}</div>
        </div>
        <div className="grid gap-3">
          {filteredItems.map((item) => (
            <article key={`${item.section}-${item.name}`} className="rounded-xl border border-farm-100 bg-field-cream/50 p-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="truncate text-lg font-black text-farm-950">{item.name}</h4>
                    <span className="badge bg-white text-farm-900">{item.kind === "Current" ? "Current" : "Non-current"}</span>
                    {item.lowStock && <span className="badge bg-red-100 text-red-700">Low stock</span>}
                    {item.expiringSoon && <span className="badge bg-amber-100 text-amber-700">Expiring soon</span>}
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{item.category} - {item.storageLocation || "No storage location"}</p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-muted px-2" onClick={() => onEdit(recordForEdit(item.latestRecord))} aria-label="Edit inventory item"><Edit className="h-4 w-4" /></button>
                  <button className="btn-muted px-2 text-red-700" onClick={() => onDelete(item.latestRecord._id)} aria-label="Delete inventory item"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-6">
                <Info label="Quantity" value={`${item.displayQuantity.toLocaleString()} ${item.unit || "units"}`} />
                <Info label="Unit" value={item.unit || "-"} />
                <Info label="Category" value={item.category} />
                <Info label="Value" value={currency.format(item.value)} />
                <Info label="Status" value={item.status} />
                <Info label="Storage" value={item.storageLocation || "-"} />
                <Info label="Minimum" value={item.minimumStockLevel || "-"} />
                <Info label="Expiry" value={item.expiryDate ? formatDate(item.expiryDate) : "-"} />
                <Info label="Supplier" value={item.supplierVendor || "-"} />
              </div>
            </article>
          ))}
          {!filteredItems.length && <div className="rounded-xl border border-dashed border-farm-100 bg-white p-8 text-center text-sm font-semibold text-slate-500">No inventory items match this view.</div>}
        </div>
      </section>
    </div>
  );
}

function FinanceFilters({ records, crops, animals, filters, setFilters, search, setSearch }) {
  const categories = Array.from(new Set(records.map((record) => record.category).filter(Boolean))).sort();
  return (
    <section className="card mb-5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Search className="h-4 w-4 text-slate-400" />
        <input className="input" placeholder="Search item, crop, animal, category, payment, remarks" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <SelectFilter label="Crop" value={filters.crop} onChange={(value) => setFilters({ ...filters, crop: value })} options={crops.map((crop) => ({ value: crop._id, label: `${crop.name} - ${crop.field}${crop.plot ? ` / ${crop.plot}` : ""}` }))} />
        <SelectFilter label="Animal" value={filters.animal} onChange={(value) => setFilters({ ...filters, animal: value })} options={animals.map((animal) => ({ value: animal._id, label: animalLabel(animal) }))} />
        <SelectFilter label="Category" value={filters.category} onChange={(value) => setFilters({ ...filters, category: value })} options={categories.map((category) => ({ value: category, label: category }))} />
        <SelectFilter label="Payment" value={filters.paymentMethod} onChange={(value) => setFilters({ ...filters, paymentMethod: value })} options={paymentMethods.map((method) => ({ value: method, label: method }))} />
        <Field label="From" type="date" value={filters.dateFrom} onChange={(value) => setFilters({ ...filters, dateFrom: value })} />
        <Field label="To" type="date" value={filters.dateTo} onChange={(value) => setFilters({ ...filters, dateTo: value })} />
      </div>
      <button className="btn-muted mt-3" onClick={() => setFilters({ crop: "", animal: "", category: "", paymentMethod: "", dateFrom: "", dateTo: "" })}>Clear filters</button>
    </section>
  );
}

function SectionSummary({ section, records, onAdd }) {
  const totals = buildSectionTotals(section, records);
  return (
    <section className="card mb-5 p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="label">{labelFor(section)}</div>
          <h2 className="mt-1 text-xl font-black text-farm-950">{section === "CashSavings" ? "Cash & Savings" : section}</h2>
          <p className="mt-1 text-sm text-slate-500">{records.length} record{records.length === 1 ? "" : "s"}</p>
        </div>
        <button className="btn-primary" onClick={onAdd}><Plus className="h-4 w-4" /> Add {labelFor(section)}</button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MiniStat label="Total cost" value={currency.format(totals.cost)} />
        {section === "Income" && <MiniStat label="Income" value={currency.format(totals.income)} />}
        <MiniStat label="Qty in" value={totals.qtyIn.toLocaleString()} />
        <MiniStat label="Qty out" value={totals.qtyOut.toLocaleString()} />
        {section === "CashSavings" && <><MiniStat label="Cash" value={currency.format(totals.cash)} /><MiniStat label="Savings" value={currency.format(totals.savings)} /></>}
        {stockSections.includes(section) && <MiniStat label="Stock balance" value={totals.balance.toLocaleString()} />}
      </div>
    </section>
  );
}

function Reports({ summary, records }) {
  const monthly = groupByMonth(records);
  const categoryRows = Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1]);
  const reportCards = [
    ["Monthly expense report", currency.format(summary.totalExpenses)],
    ["Monthly income report", currency.format(summary.totalIncome)],
    ["Profit / loss report", currency.format(summary.totalIncome - summary.totalExpenses)],
    ["Crop expenses by crop", `${summary.highestCrop.label}: ${currency.format(summary.highestCrop.value)}`],
    ["Crop expenses by category", currency.format(summary.cropExpenses)],
    ["Vet costs by animal", `${summary.highestAnimal.label}: ${currency.format(summary.highestAnimal.value)}`],
    ["Vet costs by month", currency.format(summary.monthlyHealth)],
    ["Health cost history per animal", currency.format(summary.animalHealth)],
    ["Farm total expenses by month", currency.format(summary.totalExpenses)],
    ["Construction cost report", currency.format(summary.construction)],
    ["Feed usage report", `${summary.feedOut.toLocaleString()} out`],
    ["Fuel usage report", `${summary.fuelOut.toLocaleString()} out`],
    ["Equipment inventory report", currency.format(summary.equipment)],
    ["Consumables stock report", summary.consumablesBalance.toLocaleString()],
    ["Cash and savings report", currency.format(summary.cash + summary.savings)]
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-[0.8fr_1fr]">
      <section className="card p-5">
        <h2 className="mb-4 font-black text-farm-950">Finance reports</h2>
        <div className="space-y-3">
          {reportCards.map(([label, value]) => <MiniStat key={label} label={label} value={value} />)}
        </div>
      </section>
      <section className="card p-5">
        <h2 className="mb-4 font-black text-farm-950">Monthly totals</h2>
        <div className="space-y-2">
          {Object.entries(monthly).map(([month, total]) => <MiniStat key={month} label={month} value={currency.format(total)} />)}
        </div>
        <h2 className="mb-4 mt-6 font-black text-farm-950">Expense by category</h2>
        <div className="space-y-2">
          {categoryRows.map(([category, total]) => <MiniStat key={category} label={category} value={currency.format(total)} />)}
        </div>
      </section>
    </div>
  );
}

function FinanceList({ records, section, onEdit, onDelete, emptyText = "No records in this section yet." }) {
  return (
    <div className="space-y-3">
      {records.map((record) => (
        <article key={record._id} className="card p-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <FinanceRow record={record} />
            <div className="flex gap-2">
              <button className="btn-muted px-2" onClick={() => onEdit(recordForEdit(record))} aria-label="Edit record"><Edit className="h-4 w-4" /></button>
              <button className="btn-muted px-2 text-red-700" onClick={() => onDelete(record._id)} aria-label="Delete record"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-4">
            <Info label="Crop" value={cropLabel(record.crop) || "-"} />
            <Info label="Animal" value={animalLabel(record.animal) || "-"} />
            <Info label="Qty" value={record.quantity || "-"} />
            <Info label="Unit cost" value={record.unitCost ? currency.format(record.unitCost) : "-"} />
            <Info label="Qty In/Out" value={`${record.quantityIn || 0} / ${record.quantityOut || 0}`} />
            <Info label="Balance" value={computedBalance(record, section)} />
          </div>
          {(record.remarks || record.notes) && <p className="mt-3 text-sm text-slate-500">{record.remarks || record.notes}</p>}
        </article>
      ))}
      {!records.length && <EmptyState text={emptyText} />}
    </div>
  );
}

function FinanceRow({ record }) {
  const total = recordAmount(record);
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-black text-farm-950">{record.item || record.description || record.category}</span>
        <span className="badge bg-field-sage text-farm-900">{labelFor(sectionOf(record))}</span>
      </div>
      <div className="mt-1 text-sm text-slate-500">{formatDate(record.transactionDate)} - {record.description || "No description"}</div>
      <div className={record.type === "income" ? "mt-2 font-black text-farm-700" : "mt-2 font-black text-red-700"}>{currency.format(total)}</div>
    </div>
  );
}

function FinanceModal({ record, crops, animals, onClose, onSaved }) {
  const [form, setForm] = useState(recordForEdit(record));
  const isEdit = Boolean(record._id);
  const section = form.financeSection;
  const isStock = stockSections.includes(section);
  const isCash = section === "CashSavings";
  const isIncome = section === "Income";
  const isCropExpense = section === "CropExpense";
  const isAnimalHealth = section === "AnimalHealth";
  const isEquipment = section === "Equipment";
  const isInventorySection = inventorySections.includes(section);

  async function submit(event) {
    event.preventDefault();
    const quantity = Number(form.quantity || 0);
    const unitCost = Number(form.unitCost || 0);
    const quantityIn = Number(form.quantityIn || 0);
    const quantityOut = Number(form.quantityOut || 0);
    const healthTotal = Number(form.serviceCharge || 0) + Number(form.medicineCost || 0) + Number(form.transportCost || 0) + Number(form.otherCost || 0);
    const totalCost = isAnimalHealth ? healthTotal : quantity && unitCost ? quantity * unitCost : Number(form.totalCost || form.amount || 0);
    const payload = {
      ...form,
      type: isCash || isIncome ? "income" : "expense",
      category: defaultCategory(section, form),
      amount: Number(form.amount || totalCost || form.cashAmount || form.savingsAmount || 0),
      quantity,
      unitCost,
      totalCost,
      crop: form.crop || null,
      animal: form.animal || null,
      supplierVendor: form.supplierVendor,
      storageLocation: form.storageLocation,
      inventoryStatus: form.inventoryStatus,
      minimumStockLevel: Number(form.minimumStockLevel || 0),
      expiryDate: form.expiryDate || null,
      quantityIn,
      quantityOut,
      balance: Number(form.balance || quantityIn - quantityOut || 0),
      cashAmount: Number(form.cashAmount || 0),
      savingsAmount: Number(form.savingsAmount || 0),
      serviceCharge: Number(form.serviceCharge || 0),
      medicineCost: Number(form.medicineCost || 0),
      transportCost: Number(form.transportCost || 0),
      otherCost: Number(form.otherCost || 0),
      followUpDate: form.followUpDate || null
    };
    if (isEdit) await api.put(`/transactions/${record._id}`, payload);
    else await api.post("/transactions", payload);
    toast.success(isEdit ? "Finance record updated" : "Finance record added");
    onSaved();
  }

  return (
    <CrudModal title={`${isEdit ? "Edit" : "Add"} ${labelFor(section)} Record`} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Date" type="date" value={form.transactionDate} onChange={(v) => setForm({ ...form, transactionDate: v })} />
        <label className="space-y-1">
          <span className="label">Section</span>
          <select className="input" value={section} onChange={(event) => setForm({ ...form, financeSection: event.target.value, item: sectionItems[event.target.value]?.[0] || "" })}>
            {tabs.filter((tab) => !["Overview", "Inventory", "Reports"].includes(tab.id)).map((tab) => <option key={tab.id} value={tab.id}>{tab.label}</option>)}
          </select>
        </label>
        <Field label={isCash ? "Month" : "Item"} value={isCash ? form.month : form.item} onChange={(v) => setForm(isCash ? { ...form, month: v } : { ...form, item: v })} list={isCash ? undefined : `${section}-items`} required={!isCash} />
        {!isCash && sectionItems[section] && <datalist id={`${section}-items`}>{sectionItems[section].map((item) => <option key={item} value={item} />)}</datalist>}
        {isCropExpense && <SelectField label="Crop" value={form.crop || ""} onChange={(value) => setForm({ ...form, crop: value })} options={crops.map((crop) => ({ value: crop._id, label: `${crop.name} - ${crop.field}${crop.plot ? ` / ${crop.plot}` : ""}` }))} required />}
        {isAnimalHealth && <SelectField label="Animal" value={form.animal || ""} onChange={(value) => setForm({ ...form, animal: value })} options={animals.map((animal) => ({ value: animal._id, label: animalLabel(animal) }))} required />}
        <Field label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
        {(isEquipment || !isCash) && <Field label="Quantity" type="number" value={form.quantity} onChange={(v) => setForm({ ...form, quantity: v })} />}
        {(isEquipment || !isCash) && <Field label="Unit" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} />}
        {(isEquipment || !isCash) && <Field label="Unit cost" type="number" value={form.unitCost} onChange={(v) => setForm({ ...form, unitCost: v })} />}
        {!isCash && <Field label={isIncome ? "Income amount" : "Amount / Total cost"} type="number" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} />}
        {isAnimalHealth && <Field label="Service charge" type="number" value={form.serviceCharge} onChange={(v) => setForm({ ...form, serviceCharge: v })} />}
        {isAnimalHealth && <Field label="Medicine / vaccine cost" type="number" value={form.medicineCost} onChange={(v) => setForm({ ...form, medicineCost: v })} />}
        {isAnimalHealth && <Field label="Transport cost" type="number" value={form.transportCost} onChange={(v) => setForm({ ...form, transportCost: v })} />}
        {isAnimalHealth && <Field label="Other cost" type="number" value={form.otherCost} onChange={(v) => setForm({ ...form, otherCost: v })} />}
        {isAnimalHealth && <Field label="Follow-up date" type="date" value={form.followUpDate} onChange={(v) => setForm({ ...form, followUpDate: v })} />}
        {isStock && <Field label="Quantity In" type="number" value={form.quantityIn} onChange={(v) => setForm({ ...form, quantityIn: v })} />}
        {isStock && <Field label="Quantity Out" type="number" value={form.quantityOut} onChange={(v) => setForm({ ...form, quantityOut: v })} />}
        {isStock && <Field label="Balance" type="number" value={form.balance} onChange={(v) => setForm({ ...form, balance: v })} />}
        {isCash && <Field label="Cash" type="number" value={form.cashAmount} onChange={(v) => setForm({ ...form, cashAmount: v })} />}
        {isCash && <Field label="Savings" type="number" value={form.savingsAmount} onChange={(v) => setForm({ ...form, savingsAmount: v })} />}
        {!isCash && <label className="space-y-1"><span className="label">Payment method</span><select className="input" value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}>{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></label>}
        {(isCropExpense || isAnimalHealth) && <Field label="Supplier / vendor / clinic" value={form.supplierVendor || ""} onChange={(v) => setForm({ ...form, supplierVendor: v })} />}
        {isInventorySection && <Field label="Storage location" value={form.storageLocation || ""} onChange={(v) => setForm({ ...form, storageLocation: v })} />}
        {isInventorySection && <Field label="Supplier" value={form.supplierVendor || ""} onChange={(v) => setForm({ ...form, supplierVendor: v })} />}
        {isInventorySection && <Field label="Minimum stock level" type="number" value={form.minimumStockLevel || ""} onChange={(v) => setForm({ ...form, minimumStockLevel: v })} />}
        {isInventorySection && <Field label="Expiry date" type="date" value={form.expiryDate || ""} onChange={(v) => setForm({ ...form, expiryDate: v })} />}
        {isInventorySection && (
          <label className="space-y-1">
            <span className="label">Status</span>
            <select className="input" value={form.inventoryStatus || ""} onChange={(event) => setForm({ ...form, inventoryStatus: event.target.value })}>
              <option value="">Auto</option>
              <option value="In stock">In stock</option>
              <option value="Low stock">Low stock</option>
              <option value="Finished">Finished</option>
              <option value="Needs update">Needs update</option>
            </select>
          </label>
        )}
        <label className="space-y-1 sm:col-span-2"><span className="label">Remarks</span><textarea className="input min-h-20" value={form.remarks || ""} onChange={(event) => setForm({ ...form, remarks: event.target.value })} /></label>
        <div className="rounded-lg bg-field-cream p-3 text-sm font-semibold text-slate-600 sm:col-span-2">
          Total Cost: {currency.format((isAnimalHealth ? Number(form.serviceCharge || 0) + Number(form.medicineCost || 0) + Number(form.transportCost || 0) + Number(form.otherCost || 0) : Number(form.quantity || 0) * Number(form.unitCost || 0)) || Number(form.amount || 0) || Number(form.cashAmount || 0) || Number(form.savingsAmount || 0))}
          {isStock && <span> - Balance: {Number(form.balance || Number(form.quantityIn || 0) - Number(form.quantityOut || 0) || 0)}</span>}
        </div>
        <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="btn-muted" onClick={onClose}>Cancel</button><button className="btn-primary">Save record</button></div>
      </form>
    </CrudModal>
  );
}

function Field({ label, value, onChange, type = "text", required, list }) {
  return <label className="space-y-1"><span className="label">{label}</span><input className="input" list={list} type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} required={required} /></label>;
}

function SelectField({ label, value, onChange, options, required }) {
  return (
    <label className="space-y-1">
      <span className="label">{label}</span>
      <select className="input" value={value || ""} onChange={(event) => onChange(event.target.value)} required={required}>
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function SelectFilter({ label, value, onChange, options }) {
  return (
    <label className="space-y-1">
      <span className="label">{label}</span>
      <select className="input" value={value || ""} onChange={(event) => onChange(event.target.value)}>
        <option value="">All</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function Info({ label, value }) {
  return <div><span className="label block">{label}</span><span className="font-bold text-slate-700">{value}</span></div>;
}

function MiniStat({ label, value }) {
  return <div className="rounded-lg border border-farm-100 bg-white p-3"><div className="label">{label}</div><div className="mt-1 font-black text-farm-950">{value}</div></div>;
}

function recordsForWorkspace(activeTab, records) {
  if (activeTab === "Income") return records.filter((record) => record.type === "income" || sectionOf(record) === "CashSavings");
  if (activeTab === "Expenses") return records.filter((record) => record.type === "expense" && expenseSections.includes(sectionOf(record)));
  if (activeTab === "Inventory") return records.filter((record) => inventorySections.includes(sectionOf(record)));
  return records;
}

function sectionOf(record) {
  if (record.crop) return "CropExpense";
  if (record.animal || record.healthRecord || record.vaccinationRecord) return "AnimalHealth";
  if (record.type === "income" && ["Sales", "Income"].includes(record.category)) return "Income";
  if (record.category === "Equipment") return "Equipment";
  if (record.category === "Feed") return "Feed";
  if (record.category === "Fuel") return "Fuel";
  if (record.category === "Construction") return "Construction";
  if (record.category === "Crop") return "CropExpense";
  if (["Medicine", "Vet/Health", "Vaccination"].includes(record.category)) return "AnimalHealth";
  if (["Cash", "Savings"].includes(record.category)) return "CashSavings";
  if (record.financeSection) return record.financeSection;
  return "Expenses";
}

function labelFor(section) {
  if (section === "CashSavings") return "Cash & Savings";
  if (section === "CropExpense") return "Crop Expenses";
  if (section === "AnimalHealth") return "Animal Health";
  return section;
}

function defaultCategory(section, form = {}) {
  if (section === "CashSavings") return Number(form.savingsAmount || 0) > 0 ? "Savings" : "Cash";
  if (section === "Income") return "Sales";
  if (section === "CropExpense") return form.category || "Crop";
  if (section === "AnimalHealth") return form.category || "Vet/Health";
  return section === "Expenses" ? "Other" : section;
}

function recordAmount(record) {
  return Number(record.totalCost || record.amount || record.cashAmount || record.savingsAmount || 0);
}

function computedBalance(record, section) {
  if (record.balance || record.balance === 0) return record.balance;
  if (stockSections.includes(section)) return Number(record.quantityIn || 0) - Number(record.quantityOut || 0);
  return "-";
}

function aggregateInventory(records) {
  const grouped = {};
  for (const record of records) {
    const section = sectionOf(record);
    const name = record.item || record.description || record.category || labelFor(section);
    const key = `${section}:${name}`;
    if (!grouped[key]) {
      grouped[key] = {
        section,
        name,
        kind: stockSections.includes(section) ? "Current" : "NonCurrent",
        category: labelFor(section),
        storageLocation: record.storageLocation || "",
        supplierVendor: record.supplierVendor || "",
        inventoryStatus: record.inventoryStatus || "",
        minimumStockLevel: Number(record.minimumStockLevel || 0),
        expiryDate: record.expiryDate || "",
        latestRecord: record,
        unit: record.unit || "",
        quantity: 0,
        quantityIn: 0,
        quantityOut: 0,
        balance: 0,
        value: 0
      };
    }
    grouped[key].unit = grouped[key].unit || record.unit || "";
    grouped[key].storageLocation = grouped[key].storageLocation || record.storageLocation || "";
    grouped[key].supplierVendor = grouped[key].supplierVendor || record.supplierVendor || "";
    grouped[key].inventoryStatus = record.inventoryStatus || grouped[key].inventoryStatus || "";
    grouped[key].minimumStockLevel = Number(record.minimumStockLevel || grouped[key].minimumStockLevel || 0);
    grouped[key].expiryDate = record.expiryDate || grouped[key].expiryDate || "";
    grouped[key].latestRecord = newerRecord(record, grouped[key].latestRecord) ? record : grouped[key].latestRecord;
    grouped[key].quantity += Number(record.quantity || 0);
    grouped[key].quantityIn += Number(record.quantityIn || 0);
    grouped[key].quantityOut += Number(record.quantityOut || 0);
    grouped[key].balance += stockSections.includes(section) ? stockMovement(record) : Number(record.quantity || 0);
    grouped[key].value += recordAmount(record);
  }
  return Object.values(grouped)
    .map((item) => {
      const displayQuantity = stockSections.includes(item.section) ? item.balance : item.quantity;
      const lowStock = isLowStockItem(item, displayQuantity);
      const expiringSoon = isExpiringSoon(item.expiryDate);
      const explicitStatus = item.inventoryStatus || "";
      const status = explicitStatus || (displayQuantity <= 0 ? "Finished" : lowStock ? "Low stock" : "In stock");
      return {
        ...item,
        displayQuantity,
        lowStock,
        expiringSoon,
        status
      };
    })
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.section.localeCompare(b.section) || a.name.localeCompare(b.name));
}

function newerRecord(record, current) {
  if (!current) return true;
  const recordDate = new Date(record.transactionDate || record.createdAt || 0).getTime();
  const currentDate = new Date(current.transactionDate || current.createdAt || 0).getTime();
  return recordDate >= currentDate;
}

function isLowStockItem(item, quantity) {
  if (item.kind !== "Current") return false;
  const name = `${item.name} ${item.category}`.toLowerCase();
  const consumable = ["feed", "fuel", "fertilizer", "medicine", "seed", "seeds", "consumable"].some((term) => name.includes(term));
  const minimum = Number(item.minimumStockLevel || 0);
  if (minimum > 0) return Number(quantity || 0) <= minimum;
  return consumable && Number(quantity || 0) <= 5;
}

function isExpiringSoon(date) {
  if (!date) return false;
  const expiry = new Date(date).getTime();
  if (Number.isNaN(expiry)) return false;
  const now = new Date();
  const soon = new Date(now);
  soon.setDate(now.getDate() + 30);
  return expiry >= now.getTime() && expiry <= soon.getTime();
}

function recordForEdit(record) {
  return {
    ...emptyRecord,
    ...record,
    financeSection: sectionOf(record),
    transactionDate: inputDate(record.transactionDate),
    amount: record.amount || "",
    quantity: record.quantity || "",
    unitCost: record.unitCost || "",
    totalCost: record.totalCost || "",
    crop: entityId(record.crop) || "",
    animal: entityId(record.animal) || "",
    storageLocation: record.storageLocation || "",
    inventoryStatus: record.inventoryStatus || "",
    minimumStockLevel: record.minimumStockLevel || "",
    expiryDate: inputDate(record.expiryDate),
    quantityIn: record.quantityIn || "",
    quantityOut: record.quantityOut || "",
    balance: record.balance || "",
    cashAmount: record.cashAmount || "",
    savingsAmount: record.savingsAmount || "",
    serviceCharge: record.serviceCharge || "",
    medicineCost: record.medicineCost || "",
    transportCost: record.transportCost || "",
    otherCost: record.otherCost || "",
    followUpDate: inputDate(record.followUpDate)
  };
}

function buildSummary(records) {
  const summary = {
    totalExpenses: 0,
    totalIncome: 0,
    monthlyExpenses: 0,
    monthlyIncome: 0,
    cropExpenses: 0,
    animalHealth: 0,
    monthlyCrop: 0,
    monthlyHealth: 0,
    highestCrop: { label: "None", value: 0 },
    highestAnimal: { label: "None", value: 0 },
    construction: 0,
    feed: 0,
    fuel: 0,
    equipment: 0,
    consumablesBalance: 0,
    currentInventoryValue: 0,
    nonCurrentInventoryValue: 0,
    lowStockItems: 0,
    cash: 0,
    savings: 0,
    feedOut: 0,
    fuelOut: 0,
    byCategory: {},
    byIncomeSource: {},
    byCrop: {},
    byAnimal: {}
  };
  const inventoryItems = aggregateInventory(records.filter((record) => inventorySections.includes(sectionOf(record))));
  summary.currentInventoryValue = inventoryItems.filter((item) => item.kind === "Current").reduce((sum, item) => sum + item.value, 0);
  summary.nonCurrentInventoryValue = inventoryItems.filter((item) => item.kind === "NonCurrent").reduce((sum, item) => sum + item.value, 0);
  summary.lowStockItems = inventoryItems.filter((item) => item.lowStock).length;
  const currentMonth = new Date().toISOString().slice(0, 7);
  for (const record of records) {
    const section = sectionOf(record);
    const amount = recordAmount(record);
    const month = record.transactionDate ? new Date(record.transactionDate).toISOString().slice(0, 7) : "";
    if (record.type === "expense") {
      summary.totalExpenses += amount;
      if (month === currentMonth) summary.monthlyExpenses += amount;
    }
    if (record.type === "income" && section !== "CashSavings") {
      summary.totalIncome += amount;
      if (month === currentMonth) summary.monthlyIncome += amount;
      const source = record.item || record.category || "Income";
      summary.byIncomeSource[source] = (summary.byIncomeSource[source] || 0) + amount;
    }
    if (section === "CropExpense") {
      summary.cropExpenses += amount;
      if (month === currentMonth) summary.monthlyCrop += amount;
      const label = cropLabel(record.crop) || "Unlinked crop";
      summary.byCrop[label] = (summary.byCrop[label] || 0) + amount;
    }
    if (section === "AnimalHealth") {
      summary.animalHealth += amount;
      if (month === currentMonth) summary.monthlyHealth += amount;
      const label = animalLabel(record.animal) || "Unlinked animal";
      summary.byAnimal[label] = (summary.byAnimal[label] || 0) + amount;
    }
    if (section === "Construction") summary.construction += amount;
    if (section === "Feed") {
      summary.feed += amount;
      summary.feedOut += Number(record.quantityOut || 0);
    }
    if (section === "Fuel") {
      summary.fuel += amount;
      summary.fuelOut += Number(record.quantityOut || 0);
    }
    if (section === "Equipment") summary.equipment += amount;
    if (section === "Consumables") summary.consumablesBalance += stockMovement(record);
    if (section === "CashSavings") {
      summary.cash += Number(record.cashAmount || 0);
      summary.savings += Number(record.savingsAmount || 0);
    }
    const category = record.category || section;
    summary.byCategory[category] = (summary.byCategory[category] || 0) + amount;
  }
  summary.highestCrop = highest(summary.byCrop);
  summary.highestAnimal = highest(summary.byAnimal);
  return summary;
}

function buildSectionTotals(section, records) {
  return records.reduce((totals, record) => {
    totals.cost += recordAmount(record);
    if (record.type === "income") totals.income += recordAmount(record);
    totals.qtyIn += Number(record.quantityIn || 0);
    totals.qtyOut += Number(record.quantityOut || 0);
    totals.balance += stockMovement(record);
    totals.cash += Number(record.cashAmount || 0);
    totals.savings += Number(record.savingsAmount || 0);
    return totals;
  }, { cost: 0, income: 0, qtyIn: 0, qtyOut: 0, balance: 0, cash: 0, savings: 0 });
}

function stockMovement(record) {
  if (Number(record.quantityIn || 0) || Number(record.quantityOut || 0)) {
    return Number(record.quantityIn || 0) - Number(record.quantityOut || 0);
  }
  return Number(record.balance || 0);
}

function entityId(entity) {
  return typeof entity === "object" && entity ? entity._id : entity;
}

function cropLabel(crop) {
  if (!crop || typeof crop !== "object") return "";
  return `${crop.name || "Crop"}${crop.field ? ` - ${crop.field}` : ""}${crop.plot ? ` / ${crop.plot}` : ""}`;
}

function animalLabel(animal) {
  if (!animal || typeof animal !== "object") return "";
  return `${animal.animalId || "Animal"}${animal.name ? ` - ${animal.name}` : animal.species ? ` - ${animal.species}` : ""}`;
}

function highest(grouped) {
  const [label, value] = Object.entries(grouped).sort((a, b) => b[1] - a[1])[0] || ["None", 0];
  return { label, value };
}

function groupByMonth(records) {
  return records.reduce((out, record) => {
    const date = record.transactionDate ? new Date(record.transactionDate) : new Date();
    const key = record.month || date.toLocaleString("en-GB", { month: "short", year: "numeric" });
    out[key] = (out[key] || 0) + (record.type === "expense" ? recordAmount(record) : 0);
    return out;
  }, {});
}
