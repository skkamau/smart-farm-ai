import { Edit, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import CrudModal from "../components/CrudModal";
import DataTable from "../components/DataTable";
import DocumentManager from "../components/DocumentManager";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import api from "../services/api";
import { currency, formatDate, inputDate } from "../utils";

const categories = ["Feed", "Medicine", "Labour", "Equipment", "Transport", "Sales", "Utilities", "Crop", "Other"];
const emptyTransaction = { type: "expense", category: "Feed", amount: "", description: "", transactionDate: inputDate(new Date()), notes: "" };

export default function Finance() {
  const [transactions, setTransactions] = useState([]);
  const [editing, setEditing] = useState(null);

  function load() {
    api.get("/transactions").then(({ data }) => setTransactions(data)).catch(() => toast.error("Could not load transactions"));
  }
  useEffect(load, []);

  const summary = useMemo(() => {
    const income = transactions.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
    const expenses = transactions.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
    return { income, expenses, profit: income - expenses };
  }, [transactions]);

  async function remove(id) {
    if (!confirm("Delete this transaction?")) return;
    await api.delete(`/transactions/${id}`);
    toast.success("Transaction deleted");
    load();
  }

  return (
    <div>
      <PageHeader title="Finance" eyebrow="Income and expenses" action={<button className="btn-primary" onClick={() => setEditing(emptyTransaction)}><Plus className="h-4 w-4" /> Add transaction</button>} />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Income" value={currency.format(summary.income)} />
        <StatCard label="Expenses" value={currency.format(summary.expenses)} tone="amber" />
        <StatCard label="Profit/Loss" value={currency.format(summary.profit)} tone={summary.profit >= 0 ? "green" : "red"} />
      </div>
      <DataTable
        rows={transactions}
        emptyText="No income or expense records yet."
        columns={[
          { key: "transactionDate", label: "Date", render: (row) => formatDate(row.transactionDate) },
          { key: "type", label: "Type", render: (row) => <span className={row.type === "income" ? "font-bold text-farm-700" : "font-bold text-red-700"}>{row.type}</span> },
          { key: "category", label: "Category" },
          { key: "description", label: "Description" },
          { key: "amount", label: "Amount", render: (row) => currency.format(row.amount) }
        ]}
        actions={(row) => (
          <div className="flex justify-end gap-2">
            <button className="btn-muted px-2" onClick={() => setEditing({ ...row, transactionDate: inputDate(row.transactionDate) })} aria-label="Edit transaction"><Edit className="h-4 w-4" /></button>
            <button className="btn-muted px-2 text-red-700" onClick={() => remove(row._id)} aria-label="Delete transaction"><Trash2 className="h-4 w-4" /></button>
          </div>
        )}
      />
      {editing && <TransactionModal transaction={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function TransactionModal({ transaction, onClose, onSaved }) {
  const [form, setForm] = useState(transaction);
  const isEdit = Boolean(transaction._id);
  async function submit(event) {
    event.preventDefault();
    const payload = { ...form, amount: Number(form.amount || 0) };
    if (isEdit) await api.put(`/transactions/${transaction._id}`, payload);
    else await api.post("/transactions", payload);
    toast.success(isEdit ? "Transaction updated" : "Transaction added");
    onSaved();
  }
  return (
    <CrudModal title={isEdit ? "Edit Transaction" : "Add Transaction"} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1"><span className="label">Type</span><select className="input" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option value="expense">Expense</option><option value="income">Income</option></select></label>
        <label className="space-y-1"><span className="label">Category</span><select className="input" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
        <Field label="Amount" type="number" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} required />
        <Field label="Date" type="date" value={form.transactionDate} onChange={(v) => setForm({ ...form, transactionDate: v })} />
        <Field label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} required />
        <Field label="Notes" value={form.notes || ""} onChange={(v) => setForm({ ...form, notes: v })} />
        {isEdit && <div className="sm:col-span-2"><DocumentManager entityType="transaction" entityId={transaction._id} /></div>}
        <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="btn-muted" onClick={onClose}>Cancel</button><button className="btn-primary">Save transaction</button></div>
      </form>
    </CrudModal>
  );
}

function Field({ label, value, onChange, type = "text", required }) {
  return <label className="space-y-1"><span className="label">{label}</span><input className="input" type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} required={required} /></label>;
}
