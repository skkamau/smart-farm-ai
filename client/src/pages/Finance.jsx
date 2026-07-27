import {
  ArrowDownLeft, ArrowLeft, ArrowUpRight, CalendarRange, Download, Edit3, Eye,
  FileSpreadsheet, FileText, MoreVertical, Plus, Printer, RefreshCcw, Search,
  Trash2, WalletCards
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import CrudModal from "../components/CrudModal";
import InventoryWorkspace from "../components/InventoryWorkspace";
import PageHeader from "../components/PageHeader";
import api from "../services/api";
import { currency, formatDate, inputDate } from "../utils";
import { downloadReport, todayStamp } from "../utils/downloads";

const tabs = [
  ["overview", "Overview"], ["transactions", "Transactions"], ["income", "Income"],
  ["expenses", "Expenses"], ["outstanding", "Outstanding Payments"], ["reports", "Reports"]
];

const incomeCategories = [
  "Animal Sales", "Milk Sales", "Egg Sales", "Crop Sales", "Fish Harvest Sales",
  "Poultry Sales", "Breeding Services", "Farm Service Income", "Equipment Rental",
  "Grants", "Insurance Compensation", "Other Income"
];
const expenseCategories = [
  "Feed", "Veterinary And Health", "Vaccination", "Medicine", "Seeds", "Fertiliser",
  "Chemicals", "Labour", "Transport", "Fuel", "Utilities", "Repairs And Maintenance",
  "Equipment", "Rent", "Insurance", "Loan Repayment", "Farm Supplies", "Other Expenses"
];
const paymentMethods = ["Cash", "M-Pesa", "Bank transfer", "Card", "Credit", "Other"];
const enterprises = ["Whole farm", "Individual animal", "Animal group", "Poultry", "Sheep and goats", "Cattle", "Fish", "Crop", "Field", "Other"];
const blankFilters = { search: "", type: "", category: "", paymentMethod: "", paymentStatus: "", linkedRecordType: "", dateFrom: "", dateTo: "", sort: "newest" };

function blankTransaction(type = "expense") {
  return {
    type, transactionDate: inputDate(new Date()), amount: "", category: type === "income" ? "Animal Sales" : "Feed",
    description: "", paymentMethod: "Cash", paymentStatus: "paid", amountPaid: "", dueDate: "",
    counterparty: "", referenceNumber: "", enterpriseType: "Whole farm", linkedRecordType: "",
    linkedRecordId: "", notes: ""
  };
}

export default function Finance() {
  const [records, setRecords] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [animals, setAnimals] = useState([]);
  const [groups, setGroups] = useState([]);
  const [crops, setCrops] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [showInventory, setShowInventory] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [paying, setPaying] = useState(null);
  const [filters, setFilters] = useState(blankFilters);
  const [period, setPeriod] = useState("this_month");
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [transactionRes, inventoryRes, animalRes, groupRes, cropRes] = await Promise.all([
        api.get("/transactions"), api.get("/inventory"), api.get("/animals"),
        api.get("/animal-groups"), api.get("/crops")
      ]);
      setRecords(transactionRes.data);
      setInventory(inventoryRes.data);
      setAnimals(animalRes.data);
      setGroups(groupRes.data);
      setCrops(cropRes.data);
    } catch {
      toast.error("Could not load Finance records");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const ledgerRecords = useMemo(() => filterRecords(records, filters, activeTab), [records, filters, activeTab]);
  const periodRecords = useMemo(() => recordsInPeriod(records, period, filters), [records, period, filters.dateFrom, filters.dateTo]);
  const summary = useMemo(() => summarize(periodRecords, inventory), [periodRecords, inventory]);

  function add(type = activeTab === "income" ? "income" : "expense") {
    setEditing(blankTransaction(type));
  }
  async function remove(record) {
    if (!confirm(`Permanently delete ${record.transactionId}? Only unlinked manual records can be deleted.`)) return;
    try {
      await api.delete(`/transactions/${record._id}`);
      toast.success("Transaction deleted");
      load();
    } catch (error) { toast.error(error.response?.data?.message || "Reverse this transaction instead"); }
  }
  async function reverse(record) {
    const reason = prompt("Why is this transaction being reversed?");
    if (!reason) return;
    try {
      await api.post(`/transactions/${record._id}/reverse`, { reason });
      toast.success("Transaction reversed");
      load();
    } catch (error) { toast.error(error.response?.data?.message || "Could not reverse transaction"); }
  }

  if (showInventory) return <InventoryWorkspace animals={animals} crops={crops} onBack={() => setShowInventory(false)} />;

  return (
    <div className="space-y-4">
      <PageHeader title="Finance" eyebrow="Income, expenses and farm profitability" action={<button className="btn-primary" onClick={() => add()}><Plus className="h-4 w-4" /> Add transaction</button>} />
      <FinanceTabs active={activeTab} setActive={setActiveTab} />

      {activeTab === "overview" && <Overview summary={summary} records={periodRecords} period={period} setPeriod={setPeriod} filters={filters} setFilters={setFilters} onInventory={() => setShowInventory(true)} onView={setViewing} />}
      {["transactions", "income", "expenses"].includes(activeTab) && (
        <Ledger
          records={ledgerRecords} allRecords={records} filters={filters} setFilters={setFilters}
          activeTab={activeTab} loading={loading} onAdd={add} onView={setViewing}
          onEdit={(record) => setEditing(toForm(record))} onDuplicate={(record) => setEditing({ ...toForm(record), _id: undefined, transactionId: undefined, description: `${record.description} copy` })}
          onReverse={reverse} onDelete={remove}
        />
      )}
      {activeTab === "outstanding" && <Outstanding records={records.filter((record) => !record.reversedAt && record.amountOutstanding > 0)} onPay={setPaying} onView={setViewing} />}
      {activeTab === "reports" && <Reports records={filterRecords(records, filters, "transactions")} inventory={inventory} filters={filters} setFilters={setFilters} />}

      {editing && <TransactionModal record={editing} animals={animals} groups={groups} crops={crops} inventory={inventory} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {viewing && <TransactionDetails record={viewing} onClose={() => setViewing(null)} />}
      {paying && <PaymentModal record={paying} onClose={() => setPaying(null)} onSaved={() => { setPaying(null); load(); }} />}
    </div>
  );
}

function FinanceTabs({ active, setActive }) {
  return (
    <nav className="card p-2" aria-label="Finance sections">
      <div className="flex gap-1 overflow-x-auto">
        {tabs.map(([id, label]) => <button key={id} className={active === id ? "btn-primary whitespace-nowrap" : "btn-muted whitespace-nowrap"} onClick={() => setActive(id)}>{label}</button>)}
      </div>
    </nav>
  );
}

function Overview({ summary, records, period, setPeriod, filters, setFilters, onInventory, onView }) {
  return (
    <div className="space-y-4">
      <section className="card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><div className="label">Reporting period</div><h2 className="mt-1 text-xl font-black text-farm-950">Financial overview</h2></div>
          <div className="flex flex-wrap gap-2">
            <select className="input w-auto" value={period} onChange={(event) => setPeriod(event.target.value)}>
              <option value="this_month">This month</option><option value="last_month">Last month</option>
              <option value="three_months">Last 3 months</option><option value="this_year">This year</option><option value="custom">Custom</option>
            </select>
            {period === "custom" && <><input aria-label="From date" className="input w-auto" type="date" value={filters.dateFrom} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })} /><input aria-label="To date" className="input w-auto" type="date" value={filters.dateTo} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })} /></>}
          </div>
        </div>
      </section>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total income" value={currency.format(summary.income)} tone="green" icon={ArrowDownLeft} />
        <Metric label="Total expenses" value={currency.format(summary.expenses)} tone="red" icon={ArrowUpRight} />
        <Metric label="Net profit / loss" value={currency.format(summary.net)} tone={summary.net >= 0 ? "green" : "red"} icon={WalletCards} />
        <button className="card p-4 text-left hover:border-farm-400" onClick={onInventory}>
          <div className="label">Inventory value</div><div className="mt-2 text-xl font-black text-farm-950">{currency.format(summary.inventoryValue)}</div>
          <div className="mt-2 text-sm font-bold text-farm-700">Open inventory</div>
        </button>
        <Metric label="Money owed to farm" value={currency.format(summary.receivables)} tone="amber" />
        <Metric label="Unpaid farm bills" value={currency.format(summary.payables)} tone="amber" />
        <Metric label="Income this month" value={currency.format(summary.monthIncome)} tone="green" />
        <Metric label="Expenses this month" value={currency.format(summary.monthExpenses)} tone="red" />
        <Metric label="Net result this month" value={currency.format(summary.monthIncome - summary.monthExpenses)} tone={summary.monthIncome - summary.monthExpenses >= 0 ? "green" : "red"} />
      </section>
      <section className="card p-4">
        <div className="mb-3"><div className="label">Latest activity</div><h3 className="mt-1 font-black text-farm-950">Recent transactions</h3></div>
        <div className="divide-y divide-farm-100">
          {records.slice(0, 6).map((record) => <button key={record._id} className="flex w-full items-center justify-between gap-3 py-3 text-left" onClick={() => onView(record)}><TransactionIdentity record={record} /><Amount record={record} /></button>)}
          {!records.length && <Empty text="No transactions in this period." />}
        </div>
      </section>
    </div>
  );
}

function Ledger({ records, allRecords, filters, setFilters, activeTab, loading, onAdd, onView, onEdit, onDuplicate, onReverse, onDelete }) {
  const categories = [...new Set(allRecords.map((record) => record.category).filter(Boolean))].sort();
  return (
    <div className="space-y-4">
      <section className="card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="label">{activeTab === "transactions" ? "Complete ledger" : activeTab}</div><h2 className="mt-1 text-xl font-black text-farm-950">{records.length} transaction{records.length === 1 ? "" : "s"}</h2></div>
          <button className="btn-primary" onClick={() => onAdd(activeTab === "income" ? "income" : "expense")}><Plus className="h-4 w-4" /> Add {activeTab === "income" ? "income" : activeTab === "expenses" ? "expense" : "transaction"}</button>
        </div>
      </section>
      <Filters value={filters} onChange={setFilters} categories={categories} showType={activeTab === "transactions"} />
      <section className="card overflow-hidden">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-field-cream text-xs font-black uppercase text-slate-500"><tr><th className="p-3">Date</th><th className="p-3">Description</th><th className="p-3">Category</th><th className="p-3">Type</th><th className="p-3">Linked record</th><th className="p-3">Payment</th><th className="p-3 text-right">Amount</th><th className="p-3"></th></tr></thead>
            <tbody className="divide-y divide-farm-100">{records.map((record) => <TransactionRow key={record._id} record={record} actions={{ onView, onEdit, onDuplicate, onReverse, onDelete }} />)}</tbody>
          </table>
        </div>
        <div className="divide-y divide-farm-100 md:hidden">{records.map((record) => <TransactionCard key={record._id} record={record} actions={{ onView, onEdit, onDuplicate, onReverse, onDelete }} />)}</div>
        {!loading && !records.length && <Empty text="No transactions match these filters." />}
      </section>
    </div>
  );
}

function Filters({ value, onChange, categories, showType = true }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="card p-4">
      <div className="flex gap-2">
        <div className="relative flex-1"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input className="input pl-9" placeholder="Search description or reference" value={value.search} onChange={(event) => onChange({ ...value, search: event.target.value })} /></div>
        <button className="btn-muted md:hidden" onClick={() => setOpen(!open)}><CalendarRange className="h-4 w-4" /> Filters</button>
      </div>
      <div className={`${open ? "grid" : "hidden"} mt-3 gap-3 sm:grid-cols-2 md:grid md:grid-cols-4 xl:grid-cols-8`}>
        {showType && <FilterSelect label="Type" value={value.type} onChange={(type) => onChange({ ...value, type })} options={[["", "All"], ["income", "Income"], ["expense", "Expense"]]} />}
        <FilterSelect label="Category" value={value.category} onChange={(category) => onChange({ ...value, category })} options={[["", "All"], ...categories.map((category) => [category, category])]} />
        <FilterSelect label="Payment" value={value.paymentStatus} onChange={(paymentStatus) => onChange({ ...value, paymentStatus })} options={[["", "All"], ["paid", "Paid"], ["partially_paid", "Partially paid"], ["unpaid", "Unpaid"]]} />
        <FilterSelect label="Method" value={value.paymentMethod} onChange={(paymentMethod) => onChange({ ...value, paymentMethod })} options={[["", "All"], ...paymentMethods.map((method) => [method, method])]} />
        <FilterSelect label="Linked record" value={value.linkedRecordType} onChange={(linkedRecordType) => onChange({ ...value, linkedRecordType })} options={[["", "All"], ["Animal", "Animal"], ["Animal group", "Animal group"], ["Crop", "Crop"], ["Inventory item", "Inventory"], ["Health record", "Health"], ["Vaccination record", "Vaccination"], ["Vaccination campaign", "Campaign"]]} />
        <Field label="From" type="date" value={value.dateFrom} onChange={(dateFrom) => onChange({ ...value, dateFrom })} />
        <Field label="To" type="date" value={value.dateTo} onChange={(dateTo) => onChange({ ...value, dateTo })} />
        <FilterSelect label="Sort" value={value.sort} onChange={(sort) => onChange({ ...value, sort })} options={[["newest", "Newest"], ["oldest", "Oldest"], ["highest", "Highest"], ["lowest", "Lowest"]]} />
      </div>
    </section>
  );
}

function TransactionRow({ record, actions }) {
  return <tr className={record.reversedAt ? "bg-slate-50 opacity-60" : ""}><td className="p-3 whitespace-nowrap">{formatDate(record.transactionDate)}</td><td className="p-3"><TransactionIdentity record={record} /></td><td className="p-3">{record.category}</td><td className="p-3"><TypeBadge type={record.type} /></td><td className="p-3">{linkedLabel(record)}</td><td className="p-3"><PaymentBadge record={record} /></td><td className="p-3 text-right"><Amount record={record} /></td><td className="p-3"><Actions record={record} {...actions} /></td></tr>;
}
function TransactionCard({ record, actions }) {
  return <article className={`p-4 ${record.reversedAt ? "opacity-60" : ""}`}><div className="flex items-start justify-between gap-3"><TransactionIdentity record={record} /><Actions record={record} {...actions} /></div><div className="mt-3 flex flex-wrap items-center gap-2"><TypeBadge type={record.type} /><PaymentBadge record={record} /><span className="badge bg-field-cream text-slate-700">{record.category}</span></div><div className="mt-3 flex items-end justify-between gap-3"><div className="text-sm text-slate-500">{formatDate(record.transactionDate)}<br />{linkedLabel(record)}</div><Amount record={record} /></div></article>;
}

function Actions({ record, onView, onEdit, onDuplicate, onReverse, onDelete }) {
  return (
    <details className="relative">
      <summary className="btn-muted list-none px-2" aria-label="Transaction actions"><MoreVertical className="h-4 w-4" /></summary>
      <div className="absolute right-0 z-30 mt-1 w-44 rounded-md border border-farm-100 bg-white p-1 shadow-xl">
        <Menu icon={Eye} label="View" onClick={() => onView(record)} />
        {!record.reversedAt && <Menu icon={Edit3} label="Edit" onClick={() => onEdit(record)} />}
        <Menu icon={RefreshCcw} label="Duplicate" onClick={() => onDuplicate(record)} />
        {!record.reversedAt && <Menu icon={ArrowLeft} label="Reverse" onClick={() => onReverse(record)} />}
        {!record.reversedAt && <Menu icon={Trash2} label="Delete" onClick={() => onDelete(record)} danger />}
      </div>
    </details>
  );
}

function Outstanding({ records, onPay, onView }) {
  const receivables = records.filter((record) => record.type === "income");
  const bills = records.filter((record) => record.type === "expense");
  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2">
        <Metric label="Money owed to farm" value={currency.format(receivables.reduce((sum, record) => sum + record.amountOutstanding, 0))} tone="green" />
        <Metric label="Bills farm still owes" value={currency.format(bills.reduce((sum, record) => sum + record.amountOutstanding, 0))} tone="red" />
      </section>
      <OutstandingList title="Money owed to the farm" records={receivables} onPay={onPay} onView={onView} />
      <OutstandingList title="Unpaid farm bills" records={bills} onPay={onPay} onView={onView} />
    </div>
  );
}
function OutstandingList({ title, records, onPay, onView }) {
  return (
    <section className="card p-4">
      <div className="mb-3"><div className="label">Outstanding payments</div><h2 className="mt-1 text-lg font-black text-farm-950">{title}</h2></div>
      <div className="divide-y divide-farm-100">
        {records.map((record) => <article key={record._id} className="grid gap-3 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><div className="font-black text-farm-950">{record.description}</div><div className="mt-1 text-sm text-slate-500">{record.counterparty || "No customer or supplier"} - Original {currency.format(record.amount)} - Due {record.dueDate ? formatDate(record.dueDate) : "not set"}</div></div><div><PaymentBadge record={record} /><div className="mt-1 font-black text-amber-700">{currency.format(record.amountOutstanding)}</div></div><div className="flex gap-2"><button className="btn-muted px-3" onClick={() => onView(record)}><Eye className="h-4 w-4" /></button><button className="btn-primary" onClick={() => onPay(record)}>Record payment</button></div></article>)}
        {!records.length && <Empty text="Nothing outstanding here." />}
      </div>
    </section>
  );
}

function Reports({ records, inventory, filters, setFilters }) {
  const summary = summarize(records, inventory);
  const byIncome = groupAmounts(records.filter((record) => !record.reversedAt && record.type === "income"), "category");
  const byExpense = groupAmounts(records.filter((record) => !record.reversedAt && record.type === "expense"), "category");
  const enterprises = enterpriseReport(records);
  const monthly = monthlyReport(records);
  const byMethod = groupAmounts(records.filter((record) => !record.reversedAt), "paymentMethod");
  const exportParams = { dateFrom: filters.dateFrom, dateTo: filters.dateTo };
  return (
    <div className="space-y-4">
      <section className="card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="label">Financial reports</div><h2 className="mt-1 text-xl font-black text-farm-950">Profitability and transaction reports</h2></div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-muted" onClick={() => downloadReport("finance", "csv", `finance_${todayStamp()}.csv`, exportParams)}><Download className="h-4 w-4" /> CSV</button>
            <button className="btn-muted" onClick={() => downloadReport("finance", "xlsx", `finance_${todayStamp()}.xlsx`, exportParams)}><FileSpreadsheet className="h-4 w-4" /> Excel</button>
            <button className="btn-muted" onClick={() => downloadReport("finance", "pdf", `finance_${todayStamp()}.pdf`, exportParams)}><FileText className="h-4 w-4" /> PDF</button>
            <button className="btn-primary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="From" type="date" value={filters.dateFrom} onChange={(dateFrom) => setFilters({ ...filters, dateFrom })} /><Field label="To" type="date" value={filters.dateTo} onChange={(dateTo) => setFilters({ ...filters, dateTo })} /></div>
      </section>
      <section className="grid gap-3 sm:grid-cols-3"><Metric label="Income" value={currency.format(summary.income)} tone="green" /><Metric label="Expenses" value={currency.format(summary.expenses)} tone="red" /><Metric label="Profit / loss" value={currency.format(summary.net)} tone={summary.net >= 0 ? "green" : "red"} /></section>
      <section className="grid gap-4 xl:grid-cols-2">
        <Breakdown title="Income by category" data={byIncome} tone="green" />
        <Breakdown title="Expenses by category" data={byExpense} tone="red" />
        <MonthlyReport rows={monthly} />
        <Breakdown title="Payment-method summary" data={byMethod} tone="green" />
      </section>
      <section className="grid gap-3 sm:grid-cols-2"><Metric label="Outstanding receivables" value={currency.format(summary.receivables)} tone="green" /><Metric label="Outstanding bills" value={currency.format(summary.payables)} tone="red" /></section>
      <section className="card p-4">
        <div className="label">Enterprise profitability</div><h3 className="mt-1 font-black text-farm-950">Profit by farm enterprise</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{enterprises.map((item) => <div key={item.name} className="rounded-md border border-farm-100 p-3"><div className="font-black text-farm-950">{item.name}</div><div className="mt-2 text-sm text-slate-500">Income {currency.format(item.income)} - Expenses {currency.format(item.expenses)}</div><div className={`mt-2 font-black ${item.profit >= 0 ? "text-farm-700" : "text-red-700"}`}>{currency.format(item.profit)}</div></div>)}</div>
      </section>
    </div>
  );
}

function TransactionModal({ record, animals, groups, crops, inventory, onClose, onSaved }) {
  const [form, setForm] = useState(record);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(form._id);
  const categories = form.type === "income" ? incomeCategories : expenseCategories;
  const linkedOptions = linksFor(form.linkedRecordType, { animals, groups, crops, inventory });
  const outstanding = Math.max(0, Number(form.amount || 0) - effectivePaid(form));

  function updateType(type) {
    setForm({ ...form, type, category: type === "income" ? "Animal Sales" : "Feed", financeSection: type === "income" ? "Income" : "Expenses" });
  }
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        amount: Number(form.amount),
        amountPaid: effectivePaid(form),
        dueDate: form.dueDate || null,
        linkedRecordId: form.linkedRecordId || null,
        financeSection: form.type === "income" ? "Income" : sectionForExpense(form.category)
      };
      if (isEdit) await api.put(`/transactions/${form._id}`, payload);
      else await api.post("/transactions", payload);
      toast.success(isEdit ? "Transaction updated" : "Transaction added");
      onSaved();
    } catch (error) { toast.error(error.response?.data?.message || "Could not save transaction"); }
    finally { setSaving(false); }
  }
  return (
    <CrudModal title={isEdit ? "Edit transaction" : "Add transaction"} onClose={onClose}>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
        <label className="space-y-1"><span className="label">Transaction type</span><div className="grid grid-cols-2 gap-2"><button type="button" className={form.type === "income" ? "btn-primary justify-center" : "btn-muted justify-center"} onClick={() => updateType("income")}>Income</button><button type="button" className={form.type === "expense" ? "btn-primary justify-center" : "btn-muted justify-center"} onClick={() => updateType("expense")}>Expense</button></div></label>
        <Field label="Date" type="date" value={form.transactionDate} onChange={(transactionDate) => setForm({ ...form, transactionDate })} required />
        <Field label="Amount" type="number" min="0.01" step="any" value={form.amount} onChange={(amount) => setForm({ ...form, amount })} required />
        <label className="space-y-1"><span className="label">Category</span><input className="input" list={`categories-${form.type}`} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required /><datalist id={`categories-${form.type}`}>{categories.map((category) => <option key={category} value={category} />)}</datalist></label>
        <Field label="Description" value={form.description} onChange={(description) => setForm({ ...form, description })} required />
        <FilterSelect label="Payment method" value={form.paymentMethod} onChange={(paymentMethod) => setForm({ ...form, paymentMethod })} options={paymentMethods.map((method) => [method, method])} />
        <FilterSelect label="Payment status" value={form.paymentStatus} onChange={(paymentStatus) => setForm({ ...form, paymentStatus, amountPaid: paymentStatus === "paid" ? form.amount : paymentStatus === "unpaid" ? "" : form.amountPaid })} options={[["paid", "Paid"], ["partially_paid", "Partially paid"], ["unpaid", "Unpaid"]]} />
        {form.paymentStatus === "partially_paid" && <Field label="Amount paid" type="number" min="0.01" max={form.amount} step="any" value={form.amountPaid} onChange={(amountPaid) => setForm({ ...form, amountPaid })} required />}
        {form.paymentStatus !== "paid" && <Field label="Due date (optional)" type="date" value={form.dueDate} onChange={(dueDate) => setForm({ ...form, dueDate })} />}
        {form.paymentStatus !== "paid" && <Field label={form.type === "income" ? "Customer (optional)" : "Supplier (optional)"} value={form.counterparty} onChange={(counterparty) => setForm({ ...form, counterparty })} />}
        <Field label="Reference number (optional)" value={form.referenceNumber} onChange={(referenceNumber) => setForm({ ...form, referenceNumber })} />
        <FilterSelect label="Farm enterprise" value={form.enterpriseType} onChange={(enterpriseType) => setForm({ ...form, enterpriseType })} options={enterprises.map((item) => [item, item])} />
        <FilterSelect label="Linked farm record (optional)" value={form.linkedRecordType} onChange={(linkedRecordType) => setForm({ ...form, linkedRecordType, linkedRecordId: "" })} options={[["", "None"], ["Animal", "Animal"], ["Animal group", "Animal group"], ["Crop", "Crop"], ["Inventory item", "Inventory item"]]} />
        {form.linkedRecordType && <FilterSelect label={`Choose ${form.linkedRecordType.toLowerCase()}`} value={form.linkedRecordId} onChange={(linkedRecordId) => setForm({ ...form, linkedRecordId })} options={[["", "Select"], ...linkedOptions]} />}
        <label className="space-y-1 sm:col-span-2"><span className="label">Notes (optional)</span><textarea className="input min-h-20" value={form.notes || ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
        <div className="rounded-md bg-field-cream p-3 text-sm font-bold text-farm-900 sm:col-span-2">Amount outstanding: {currency.format(outstanding)}. Payment method is recorded as a detail only; no account balance is changed.</div>
        <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="btn-muted" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save transaction"}</button></div>
      </form>
    </CrudModal>
  );
}

function PaymentModal({ record, onClose, onSaved }) {
  const [form, setForm] = useState({ amount: "", paymentDate: inputDate(new Date()), paymentMethod: record.paymentMethod || "Cash", referenceNumber: "", notes: "" });
  async function submit(event) {
    event.preventDefault();
    try {
      await api.post(`/transactions/${record._id}/payments`, { ...form, amount: Number(form.amount) });
      toast.success("Payment recorded");
      onSaved();
    } catch (error) { toast.error(error.response?.data?.message || "Could not record payment"); }
  }
  return <CrudModal title={`Record payment - ${record.description}`} onClose={onClose}><form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}><div className="rounded-md bg-field-cream p-3 sm:col-span-2"><div className="label">Outstanding</div><div className="mt-1 text-xl font-black text-farm-950">{currency.format(record.amountOutstanding)}</div></div><Field label="Payment amount" type="number" min="0.01" max={record.amountOutstanding} step="any" value={form.amount} onChange={(amount) => setForm({ ...form, amount })} required /><Field label="Payment date" type="date" value={form.paymentDate} onChange={(paymentDate) => setForm({ ...form, paymentDate })} required /><FilterSelect label="Payment method" value={form.paymentMethod} onChange={(paymentMethod) => setForm({ ...form, paymentMethod })} options={paymentMethods.map((item) => [item, item])} /><Field label="Reference (optional)" value={form.referenceNumber} onChange={(referenceNumber) => setForm({ ...form, referenceNumber })} /><label className="space-y-1 sm:col-span-2"><span className="label">Notes</span><textarea className="input min-h-20" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="btn-muted" onClick={onClose}>Cancel</button><button className="btn-primary">Record payment</button></div></form></CrudModal>;
}

function TransactionDetails({ record, onClose }) {
  return <CrudModal title={`Transaction ${record.transactionId}`} onClose={onClose}><div className="grid gap-4 sm:grid-cols-2">{[["Type", record.type], ["Date", formatDate(record.transactionDate)], ["Amount", currency.format(record.amount)], ["Category", record.category], ["Payment status", paymentLabel(record.paymentStatus)], ["Amount paid", currency.format(record.amountPaid)], ["Outstanding", currency.format(record.amountOutstanding)], ["Payment method", record.paymentMethod || "Not set"], ["Enterprise", record.enterpriseType || "Whole farm"], ["Linked record", linkedLabel(record)], ["Reference", record.referenceNumber || "Not set"], ["Customer / supplier", record.counterparty || "Not set"]].map(([label, value]) => <Info key={label} label={label} value={value} />)}<div className="sm:col-span-2"><Info label="Description" value={record.description} /></div>{record.notes && <div className="sm:col-span-2"><Info label="Notes" value={record.notes} /></div>}{record.reversedAt && <div className="rounded-md bg-red-50 p-3 text-red-700 sm:col-span-2"><strong>Reversed:</strong> {record.reversalReason} on {formatDate(record.reversedAt)}</div>}{record.payments?.length > 0 && <div className="sm:col-span-2"><div className="label">Payment history</div><div className="mt-2 divide-y divide-farm-100 rounded-md border border-farm-100">{record.payments.map((payment) => <div key={payment._id} className="flex justify-between gap-3 p-3 text-sm"><span>{formatDate(payment.paymentDate)} - {payment.paymentMethod}</span><strong>{currency.format(payment.amount)}</strong></div>)}</div></div>}</div></CrudModal>;
}

function Metric({ label, value, tone = "plain", icon: Icon }) {
  const tones = { green: "border-emerald-200 bg-emerald-50", red: "border-red-200 bg-red-50", amber: "border-amber-200 bg-amber-50", plain: "border-farm-100 bg-white" };
  return <div className={`rounded-md border p-4 ${tones[tone]}`}><div className="flex items-center justify-between gap-2"><div className="label">{label}</div>{Icon && <Icon className="h-4 w-4 text-farm-700" />}</div><div className="mt-2 text-xl font-black text-farm-950">{value}</div></div>;
}
function TransactionIdentity({ record }) {
  return <div className="min-w-0"><div className="truncate font-black text-farm-950">{record.description}</div><div className="mt-1 text-xs font-semibold text-slate-500">{record.transactionId}{record.reversedAt ? " - Reversed" : ""}</div></div>;
}
function TypeBadge({ type }) { return <span className={`badge ${type === "income" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`}>{type === "income" ? "Income" : "Expense"}</span>; }
function PaymentBadge({ record }) { const overdue = record.amountOutstanding > 0 && record.dueDate && new Date(record.dueDate) < new Date(); return <span className={`badge ${record.paymentStatus === "paid" ? "bg-emerald-100 text-emerald-800" : overdue ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{overdue ? "Overdue" : paymentLabel(record.paymentStatus)}</span>; }
function Amount({ record }) { return <div className={`whitespace-nowrap font-black ${record.type === "income" ? "text-emerald-700" : "text-red-700"}`}>{record.type === "income" ? "+" : "-"}{currency.format(record.amount)}</div>; }
function Menu({ icon: Icon, label, onClick, danger }) { return <button className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm font-bold hover:bg-field-cream ${danger ? "text-red-700" : "text-slate-700"}`} onClick={onClick}><Icon className="h-4 w-4" /> {label}</button>; }
function Field({ label, value, onChange, type = "text", required, min, max, step }) { return <label className="space-y-1"><span className="label">{label}</span><input className="input" type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} required={required} min={min} max={max} step={step} /></label>; }
function FilterSelect({ label, value, onChange, options }) { return <label className="space-y-1"><span className="label">{label}</span><select className="input" value={value ?? ""} onChange={(event) => onChange(event.target.value)}>{options.map(([key, text]) => <option key={key || "all"} value={key}>{text}</option>)}</select></label>; }
function Info({ label, value }) { return <div><div className="label">{label}</div><div className="mt-1 break-words font-bold text-slate-700">{value}</div></div>; }
function Empty({ text }) { return <div className="p-8 text-center text-sm font-semibold text-slate-500">{text}</div>; }

function Breakdown({ title, data, tone }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, value]) => value), 1);
  return <section className="card p-4"><div className="label">Report</div><h3 className="mt-1 font-black text-farm-950">{title}</h3><div className="mt-4 space-y-3">{entries.slice(0, 8).map(([label, value]) => <div key={label}><div className="mb-1 flex justify-between gap-2 text-sm font-bold"><span>{label}</span><span>{currency.format(value)}</span></div><div className="h-2 overflow-hidden rounded bg-field-cream"><div className={`h-full ${tone === "green" ? "bg-emerald-600" : "bg-red-500"}`} style={{ width: `${Math.max(3, value / max * 100)}%` }} /></div></div>)}{!entries.length && <Empty text="No report data in this period." />}</div></section>;
}
function MonthlyReport({ rows }) {
  return <section className="card p-4"><div className="label">Report</div><h3 className="mt-1 font-black text-farm-950">Monthly income versus expenses</h3><div className="mt-4 space-y-3">{rows.map((row) => <div key={row.month} className="rounded-md border border-farm-100 p-3"><div className="font-black text-farm-950">{row.month}</div><div className="mt-2 grid grid-cols-3 gap-2 text-sm"><Info label="Income" value={currency.format(row.income)} /><Info label="Expenses" value={currency.format(row.expenses)} /><Info label="Net" value={currency.format(row.income - row.expenses)} /></div></div>)}{!rows.length && <Empty text="No monthly data in this period." />}</div></section>;
}

function effectivePaid(form) {
  const amount = Number(form.amount || 0);
  if (form.paymentStatus === "paid") return amount;
  if (form.paymentStatus === "unpaid") return 0;
  return Number(form.amountPaid || 0);
}
function paymentLabel(status) { return status === "partially_paid" ? "Partially paid" : status === "unpaid" ? "Unpaid" : "Paid"; }
function linkedLabel(record) { if (record.animal) return record.animal.name || record.animal.animalId; if (record.crop) return record.crop.name; if (record.linkedRecordType) return record.linkedRecordType; if (record.healthRecord) return "Health record"; if (record.vaccinationCampaign) return "Vaccination campaign"; return "Whole farm"; }
function sectionForExpense(category) { const key = String(category).toLowerCase(); if (key.includes("crop") || ["seeds", "fertiliser", "chemicals"].includes(key)) return "CropExpense"; if (key.includes("veterinary") || key.includes("vaccination") || key.includes("medicine")) return "AnimalHealth"; if (key === "feed") return "Feed"; if (key === "fuel") return "Fuel"; if (key === "equipment") return "Equipment"; return "Expenses"; }
function toForm(record) { return { ...record, transactionDate: inputDate(record.transactionDate), dueDate: inputDate(record.dueDate), linkedRecordId: record.linkedRecordId || "", amount: record.amount || "", amountPaid: record.amountPaid || "" }; }
function linksFor(type, data) {
  if (type === "Animal") return data.animals.map((item) => [item._id, `${item.animalId}${item.name ? ` - ${item.name}` : ""}`]);
  if (type === "Animal group") return data.groups.map((item) => [item._id, item.groupName || item.groupId]);
  if (type === "Crop") return data.crops.map((item) => [item._id, item.name]);
  if (type === "Inventory item") return data.inventory.map((item) => [item._id, item.name]);
  return [];
}
function filterRecords(records, filters, tab) {
  let out = records.filter((record) => tab === "income" ? record.type === "income" : tab === "expenses" ? record.type === "expense" : true);
  if (filters.type) out = out.filter((record) => record.type === filters.type);
  if (filters.category) out = out.filter((record) => record.category === filters.category);
  if (filters.paymentMethod) out = out.filter((record) => record.paymentMethod === filters.paymentMethod);
  if (filters.paymentStatus) out = out.filter((record) => record.paymentStatus === filters.paymentStatus);
  if (filters.linkedRecordType) out = out.filter((record) => record.linkedRecordType === filters.linkedRecordType);
  if (filters.dateFrom) out = out.filter((record) => new Date(record.transactionDate) >= new Date(filters.dateFrom));
  if (filters.dateTo) out = out.filter((record) => new Date(record.transactionDate) <= new Date(`${filters.dateTo}T23:59:59`));
  const term = filters.search.trim().toLowerCase();
  if (term) out = out.filter((record) => [record.description, record.referenceNumber, record.transactionId, record.category].join(" ").toLowerCase().includes(term));
  return [...out].sort((a, b) => filters.sort === "oldest" ? new Date(a.transactionDate) - new Date(b.transactionDate) : filters.sort === "highest" ? b.amount - a.amount : filters.sort === "lowest" ? a.amount - b.amount : new Date(b.transactionDate) - new Date(a.transactionDate));
}
function recordsInPeriod(records, period, filters) {
  const now = new Date(); let from; let to = new Date();
  if (period === "this_month") from = new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === "last_month") { from = new Date(now.getFullYear(), now.getMonth() - 1, 1); to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59); }
  if (period === "three_months") from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  if (period === "this_year") from = new Date(now.getFullYear(), 0, 1);
  if (period === "custom") { from = filters.dateFrom ? new Date(filters.dateFrom) : new Date(0); to = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`) : new Date(); }
  return records.filter((record) => new Date(record.transactionDate) >= from && new Date(record.transactionDate) <= to);
}
function summarize(records, inventory) {
  const active = records.filter((record) => !record.reversedAt);
  const income = active.filter((record) => record.type === "income").reduce((sum, record) => sum + Number(record.amount), 0);
  const expenses = active.filter((record) => record.type === "expense").reduce((sum, record) => sum + Number(record.amount), 0);
  const month = new Date().toISOString().slice(0, 7);
  const monthRecords = active.filter((record) => String(record.transactionDate).slice(0, 7) === month);
  return {
    income, expenses, net: income - expenses,
    monthIncome: monthRecords.filter((record) => record.type === "income").reduce((sum, record) => sum + Number(record.amount), 0),
    monthExpenses: monthRecords.filter((record) => record.type === "expense").reduce((sum, record) => sum + Number(record.amount), 0),
    receivables: active.filter((record) => record.type === "income").reduce((sum, record) => sum + Number(record.amountOutstanding || 0), 0),
    payables: active.filter((record) => record.type === "expense").reduce((sum, record) => sum + Number(record.amountOutstanding || 0), 0),
    inventoryValue: inventory.reduce((sum, item) => sum + Number(item.inventoryValue || 0), 0)
  };
}
function groupAmounts(records, key) { return records.reduce((out, record) => { const label = record[key] || "Other"; out[label] = (out[label] || 0) + Number(record.amount); return out; }, {}); }
function monthlyReport(records) {
  const grouped = {};
  for (const record of records.filter((item) => !item.reversedAt)) {
    const date = new Date(record.transactionDate);
    const key = date.toLocaleString("en-GB", { month: "short", year: "numeric" });
    grouped[key] ||= { month: key, timestamp: new Date(date.getFullYear(), date.getMonth(), 1).getTime(), income: 0, expenses: 0 };
    grouped[key][record.type === "income" ? "income" : "expenses"] += Number(record.amount);
  }
  return Object.values(grouped).sort((a, b) => b.timestamp - a.timestamp);
}
function enterpriseReport(records) {
  const grouped = {};
  for (const record of records.filter((item) => !item.reversedAt)) { const name = record.enterpriseType || "Whole farm"; grouped[name] ||= { name, income: 0, expenses: 0 }; grouped[name][record.type === "income" ? "income" : "expenses"] += Number(record.amount); }
  return Object.values(grouped).map((item) => ({ ...item, profit: item.income - item.expenses })).sort((a, b) => b.profit - a.profit);
}
