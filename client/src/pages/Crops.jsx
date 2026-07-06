import { Download, Edit, Plus, ReceiptText, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import CrudModal from "../components/CrudModal";
import DataTable from "../components/DataTable";
import DocumentManager from "../components/DocumentManager";
import ExportButtons from "../components/ExportButtons";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import api from "../services/api";
import { currency, formatDate, inputDate } from "../utils";
import { downloadIndividual } from "../utils/downloads";

const emptyCrop = { name: "", field: "", plot: "", area: "", plantingDate: "", harvestDate: "", expectedYield: "", actualYield: "", cost: "", revenue: "", status: "Growing", notes: "" };
const cropExpenseCategories = ["Fertilizer", "Herbicide", "Pesticide", "Seeds", "Labour", "Irrigation", "Transport", "Equipment use", "Harvesting", "Storage", "Other"];
const paymentMethods = ["Mpesa", "Bank Transfer", "Cash", "Other"];

const emptyExpense = {
  transactionDate: inputDate(new Date()),
  crop: "",
  category: "Fertilizer",
  item: "",
  description: "",
  quantity: "",
  unit: "",
  unitCost: "",
  amount: "",
  paymentMethod: "Mpesa",
  supplierVendor: "",
  notes: ""
};

export default function Crops() {
  const [crops, setCrops] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [editing, setEditing] = useState(null);
  const [expenseEditing, setExpenseEditing] = useState(null);

  function load() {
    Promise.all([api.get("/crops"), api.get("/transactions?financeSection=CropExpense")])
      .then(([cropRes, expenseRes]) => {
        setCrops(cropRes.data);
        setExpenses(expenseRes.data);
      })
      .catch(() => toast.error("Could not load crops"));
  }
  useEffect(load, []);

  const cropSummaries = useMemo(() => {
    return crops.map((crop) => {
      const cropExpenses = expenses.filter((expense) => cropId(expense.crop) === crop._id);
      const total = cropExpenses.reduce((sum, expense) => sum + recordAmount(expense), 0);
      const byCategory = cropExpenses.reduce((out, expense) => {
        out[expense.category || "Other"] = (out[expense.category || "Other"] || 0) + recordAmount(expense);
        return out;
      }, {});
      return { crop, expenses: cropExpenses, total, byCategory, profitEstimate: Number(crop.revenue || 0) - total };
    });
  }, [crops, expenses]);

  async function remove(id) {
    if (!confirm("Delete this crop record?")) return;
    await api.delete(`/crops/${id}`);
    toast.success("Crop deleted");
    load();
  }

  async function removeExpense(id) {
    if (!confirm("Delete this crop expense?")) return;
    await api.delete(`/transactions/${id}`);
    toast.success("Crop expense deleted");
    load();
  }

  async function downloadCropRecord(crop, format = "pdf") {
    await downloadIndividual("crop", crop._id, format, `crop_${crop.name}_${crop.plot || crop.field}_report.${format}`.replace(/\s+/g, "_"));
  }

  function startCropExpense(crop) {
    setExpenseEditing({ ...emptyExpense, crop: crop._id, plot: crop.plot || crop.field || "" });
  }

  return (
    <div>
      <PageHeader title="Crops" eyebrow="Fields, harvests and crop costs" action={<div className="flex flex-wrap gap-2"><ExportButtons type="crops" basename="crops" /><ExportButtons type="crop-expenses" basename="crop_expenses" /><button className="btn-primary" onClick={() => setEditing(emptyCrop)}><Plus className="h-4 w-4" /> Add crop</button></div>} />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Crop expenses" value={currency.format(expenses.reduce((sum, expense) => sum + recordAmount(expense), 0))} tone="amber" />
        <StatCard label="Active crops" value={crops.length} />
        <StatCard label="Expected yield" value={crops.reduce((sum, crop) => sum + Number(crop.expectedYield || 0), 0).toLocaleString()} tone="slate" />
        <StatCard label="Crop revenue" value={currency.format(crops.reduce((sum, crop) => sum + Number(crop.revenue || 0), 0))} />
      </div>

      <DataTable
        rows={crops}
        emptyText="No crop records yet."
        columns={[
          { key: "name", label: "Crop" },
          { key: "field", label: "Field" },
          { key: "area", label: "Area", render: (row) => `${row.area || 0} acres` },
          { key: "harvestDate", label: "Harvest", render: (row) => formatDate(row.harvestDate) },
          { key: "status", label: "Status" },
          { key: "cost", label: "Old cost", render: (row) => currency.format(row.cost || 0) },
          { key: "revenue", label: "Revenue", render: (row) => currency.format(row.revenue || 0) }
        ]}
        actions={(row) => (
          <div className="flex justify-end gap-2">
            <button className="btn-muted px-2" onClick={() => startCropExpense(row)} aria-label="Add crop expense"><ReceiptText className="h-4 w-4" /></button>
            <button className="btn-muted px-2" onClick={() => downloadCropRecord(row)} aria-label="Download crop record"><Download className="h-4 w-4" /></button>
            <button className="btn-muted px-2" onClick={() => setEditing({ ...row, plantingDate: inputDate(row.plantingDate), harvestDate: inputDate(row.harvestDate) })} aria-label="Edit crop"><Edit className="h-4 w-4" /></button>
            <button className="btn-muted px-2 text-red-700" onClick={() => remove(row._id)} aria-label="Delete crop"><Trash2 className="h-4 w-4" /></button>
          </div>
        )}
      />

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {cropSummaries.map((summary) => (
          <CropCostCard key={summary.crop._id} summary={summary} onAdd={() => startCropExpense(summary.crop)} onEditExpense={setExpenseEditing} onDeleteExpense={removeExpense} />
        ))}
      </div>

      {editing && <CropModal crop={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {expenseEditing && <CropExpenseModal record={expenseEditing} crops={crops} onClose={() => setExpenseEditing(null)} onSaved={() => { setExpenseEditing(null); load(); }} />}
    </div>
  );
}

function CropCostCard({ summary, onAdd, onEditExpense, onDeleteExpense }) {
  const { crop, expenses, total, byCategory, profitEstimate } = summary;
  return (
    <section className="card p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="label">{crop.field}{crop.plot ? ` / ${crop.plot}` : ""}</div>
          <h2 className="mt-1 font-black text-farm-950">{crop.name}</h2>
          <p className="mt-1 text-sm text-slate-500">Expected yield: {crop.expectedYield || 0} | Actual yield: {crop.actualYield || 0}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={onAdd}><Plus className="h-4 w-4" /> Add Crop Expense</button>
          <button className="btn-muted" onClick={() => downloadIndividual("crop", crop._id, "pdf", `crop_${crop.name}_${crop.plot || crop.field}_report.pdf`.replace(/\s+/g, "_"))}>Download Crop Report</button>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MiniStat label="Total expenses" value={currency.format(total)} />
        <MiniStat label="Revenue" value={currency.format(crop.revenue || 0)} />
        <MiniStat label="Profit/loss estimate" value={currency.format(profitEstimate)} />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-black text-farm-950">Expenses by category</h3>
          <div className="space-y-2">
            {Object.entries(byCategory).map(([category, value]) => <MiniStat key={category} label={category} value={currency.format(value)} />)}
            {!Object.keys(byCategory).length && <p className="text-sm text-slate-500">No crop expenses yet.</p>}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-black text-farm-950">Recent crop expenses</h3>
          <div className="space-y-2">
            {expenses.slice(0, 4).map((expense) => (
              <div key={expense._id} className="rounded-lg border border-farm-100 bg-white p-3 text-sm">
                <div className="flex justify-between gap-2">
                  <div>
                    <div className="font-bold text-farm-950">{expense.item || expense.category}</div>
                    <div className="text-slate-500">{formatDate(expense.transactionDate)} - {expense.category}</div>
                  </div>
                  <div className="font-black text-red-700">{currency.format(recordAmount(expense))}</div>
                </div>
                <div className="mt-2 flex gap-2">
                  <button className="btn-muted py-1 text-xs" onClick={() => onEditExpense(recordForExpenseEdit(expense))}>Edit</button>
                  <button className="btn-muted py-1 text-xs text-red-700" onClick={() => onDeleteExpense(expense._id)}>Delete</button>
                </div>
              </div>
            ))}
            {!expenses.length && <p className="text-sm text-slate-500">No recent expenses.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

function CropExpenseModal({ record, crops, onClose, onSaved }) {
  const [form, setForm] = useState(recordForExpenseEdit(record));
  const isEdit = Boolean(record._id);
  const selectedCrop = crops.find((crop) => crop._id === form.crop);
  const totalCost = (Number(form.quantity || 0) * Number(form.unitCost || 0)) || Number(form.amount || 0);

  async function submit(event) {
    event.preventDefault();
    const crop = crops.find((item) => item._id === form.crop);
    if (!crop) return toast.error("Select a crop for this expense");
    const quantity = Number(form.quantity || 0);
    const unitCost = Number(form.unitCost || 0);
    const amount = quantity && unitCost ? quantity * unitCost : Number(form.amount || 0);
    const payload = {
      ...form,
      type: "expense",
      financeSection: "CropExpense",
      source: "crop",
      crop: crop._id,
      category: form.category,
      transactionDate: form.transactionDate,
      description: form.description || `${crop.name}: ${form.item || form.category}`,
      quantity,
      unitCost,
      amount,
      totalCost: amount,
      plot: crop.plot || crop.field || form.plot,
      remarks: form.notes
    };
    if (isEdit) await api.put(`/transactions/${record._id}`, payload);
    else await api.post("/transactions", payload);
    toast.success(isEdit ? "Crop expense updated" : "Crop expense added");
    onSaved();
  }

  return (
    <CrudModal title={isEdit ? "Edit Crop Expense" : "Add Crop Expense"} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1"><span className="label">Crop</span><select className="input" value={form.crop || ""} onChange={(event) => setForm({ ...form, crop: event.target.value })} required><option value="">Select crop</option>{crops.map((crop) => <option key={crop._id} value={crop._id}>{crop.name} - {crop.field}{crop.plot ? ` / ${crop.plot}` : ""}</option>)}</select></label>
        <Field label="Date" type="date" value={form.transactionDate} onChange={(value) => setForm({ ...form, transactionDate: value })} />
        <InfoBox label="Farm plot / location" value={selectedCrop ? `${selectedCrop.field}${selectedCrop.plot ? ` / ${selectedCrop.plot}` : ""}` : "Select crop"} />
        <label className="space-y-1"><span className="label">Expense category</span><select className="input" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{cropExpenseCategories.map((item) => <option key={item}>{item}</option>)}</select></label>
        <Field label="Item / service name" value={form.item} onChange={(value) => setForm({ ...form, item: value })} required />
        <Field label="Quantity" type="number" value={form.quantity} onChange={(value) => setForm({ ...form, quantity: value })} />
        <Field label="Unit" value={form.unit} onChange={(value) => setForm({ ...form, unit: value })} />
        <Field label="Unit cost" type="number" value={form.unitCost} onChange={(value) => setForm({ ...form, unitCost: value })} />
        <Field label="Total cost" type="number" value={totalCost || form.amount} onChange={(value) => setForm({ ...form, amount: value })} />
        <label className="space-y-1"><span className="label">Payment method</span><select className="input" value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}>{paymentMethods.map((item) => <option key={item}>{item}</option>)}</select></label>
        <Field label="Supplier / vendor" value={form.supplierVendor || ""} onChange={(value) => setForm({ ...form, supplierVendor: value })} />
        <TextArea label="Description" value={form.description || ""} onChange={(value) => setForm({ ...form, description: value })} />
        <TextArea label="Notes" value={form.notes || ""} onChange={(value) => setForm({ ...form, notes: value })} />
        <div className="rounded-lg bg-field-cream p-3 text-sm font-semibold text-slate-600 sm:col-span-2">Quantity x Unit Cost = {currency.format(totalCost || 0)}</div>
        <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="btn-muted" onClick={onClose}>Cancel</button><button className="btn-primary">Save crop expense</button></div>
      </form>
    </CrudModal>
  );
}

function CropModal({ crop, onClose, onSaved }) {
  const [form, setForm] = useState(crop);
  const isEdit = Boolean(crop._id);
  async function submit(event) {
    event.preventDefault();
    const payload = { ...form, area: Number(form.area || 0), expectedYield: Number(form.expectedYield || 0), actualYield: Number(form.actualYield || 0), cost: Number(form.cost || 0), revenue: Number(form.revenue || 0) };
    if (isEdit) await api.put(`/crops/${crop._id}`, payload);
    else await api.post("/crops", payload);
    toast.success(isEdit ? "Crop updated" : "Crop added");
    onSaved();
  }
  return (
    <CrudModal title={isEdit ? "Edit Crop" : "Add Crop"} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Crop name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
        <Field label="Field" value={form.field} onChange={(v) => setForm({ ...form, field: v })} required />
        <Field label="Plot" value={form.plot} onChange={(v) => setForm({ ...form, plot: v })} />
        <Field label="Area" type="number" value={form.area} onChange={(v) => setForm({ ...form, area: v })} />
        <Field label="Planting date" type="date" value={form.plantingDate} onChange={(v) => setForm({ ...form, plantingDate: v })} />
        <Field label="Harvest date" type="date" value={form.harvestDate} onChange={(v) => setForm({ ...form, harvestDate: v })} />
        <Field label="Expected yield" type="number" value={form.expectedYield} onChange={(v) => setForm({ ...form, expectedYield: v })} />
        <Field label="Actual yield" type="number" value={form.actualYield} onChange={(v) => setForm({ ...form, actualYield: v })} />
        <Field label="Old cost field" type="number" value={form.cost} onChange={(v) => setForm({ ...form, cost: v })} />
        <Field label="Revenue" type="number" value={form.revenue} onChange={(v) => setForm({ ...form, revenue: v })} />
        <label className="space-y-1"><span className="label">Status</span><select className="input" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{["Planned", "Growing", "Ready", "Harvested"].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="space-y-1 sm:col-span-2"><span className="label">Notes</span><textarea className="input min-h-24" value={form.notes || ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
        {isEdit && <div className="sm:col-span-2"><DocumentManager entityType="crop" entityId={crop._id} /></div>}
        <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="btn-muted" onClick={onClose}>Cancel</button><button className="btn-primary">Save crop</button></div>
      </form>
    </CrudModal>
  );
}

function recordForExpenseEdit(record) {
  return {
    ...emptyExpense,
    ...record,
    crop: cropId(record.crop),
    transactionDate: inputDate(record.transactionDate),
    amount: record.amount || record.totalCost || "",
    quantity: record.quantity || "",
    unitCost: record.unitCost || "",
    notes: record.notes || record.remarks || ""
  };
}

function cropId(crop) {
  return typeof crop === "object" && crop ? crop._id : crop;
}

function recordAmount(record) {
  return Number(record.totalCost || record.amount || 0);
}

function Field({ label, value, onChange, type = "text", required }) {
  return <label className="space-y-1"><span className="label">{label}</span><input className="input" type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} required={required} /></label>;
}

function TextArea({ label, value, onChange }) {
  return <label className="space-y-1 sm:col-span-2"><span className="label">{label}</span><textarea className="input min-h-20" value={value ?? ""} onChange={(event) => onChange(event.target.value)} /></label>;
}

function InfoBox({ label, value }) {
  return <div className="rounded-lg bg-field-cream p-3"><div className="label">{label}</div><div className="mt-1 text-sm font-bold text-slate-700">{value}</div></div>;
}

function MiniStat({ label, value }) {
  return <div className="rounded-lg border border-farm-100 bg-white p-3"><div className="label">{label}</div><div className="mt-1 font-black text-farm-950">{value}</div></div>;
}
