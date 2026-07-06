import { Download, FileJson, FileSpreadsheet, FileText, Upload } from "lucide-react";
import { useRef, useState } from "react";
import toast from "react-hot-toast";
import PageHeader from "../components/PageHeader";
import { downloadBackup, downloadReport, importBackupFile, todayStamp } from "../utils/downloads";

const reports = [
  { type: "animals", title: "Animal Report", description: "Basic details, QR codes, family links, health, vaccines, breeding, births, production placeholder, and notes." },
  { type: "health", title: "Health / Vet Report", description: "Vet cases, symptoms, diagnoses, treatments, medication, costs, follow-ups, and notes." },
  { type: "vaccinations", title: "Vaccination Report", description: "Vaccine history, next due dates, batch numbers, vets, costs, statuses, and notes." },
  { type: "breeding", title: "Breeding Report", description: "Mating records, pregnancy status, due dates, results, and vet notes." },
  { type: "births", title: "Birth Report", description: "Mother, father, offspring, complications, vet notes, and birth notes." },
  { type: "family", title: "Parent / Children Report", description: "Mother, father, children, and offspring counts." },
  { type: "crops", title: "Crop Report", description: "Planting, harvest, yields, costs, revenue, and profit/loss." },
  { type: "crop-expenses", title: "Crop Expenses Report", description: "Crop expenses by crop, plot, category, payment method, and supplier." },
  { type: "financial", title: "Financial Report", description: "Income, expenses, profit/loss, categories, and transaction summary." },
  { type: "monthly-expenses", title: "Monthly Expense Report", description: "Farm total expenses grouped by month." },
  { type: "expense-by-category", title: "Expense By Category", description: "Expenses grouped by category." },
  { type: "animal-health", title: "Vet Costs Report", description: "Animal health, vet, vaccination, and medicine charges." },
  { type: "health-costs", title: "Health Cost Per Animal", description: "Health cost history per animal." },
  { type: "construction", title: "Construction Cost Report", description: "Shed, fence, labour, materials, and build costs." },
  { type: "feed", title: "Feed Usage Report", description: "Feed purchases, stock in/out, and balances." },
  { type: "fuel", title: "Fuel Usage Report", description: "Fuel records, usage, and balances." },
  { type: "equipment", title: "Equipment Inventory Report", description: "Equipment inventory and value." },
  { type: "consumables", title: "Consumables Stock Report", description: "Eartags, syringes, needles, and stock movements." },
  { type: "cash-savings", title: "Cash & Savings Report", description: "Cash and savings records." },
  { type: "weather", title: "Weather Logs", description: "Saved farm weather observations." },
  { type: "alerts", title: "Alerts & Reminders", description: "Generated farm alerts and reminders." },
  { type: "full-summary", title: "Full Farm Summary", description: "High-level totals for animals, crops, costs, income, and profit." },
  { type: "ai", title: "AI Recommendation Report", description: "Rule-based recommendations, priorities, related items, and suggested actions." }
];

export default function Reports() {
  const inputRef = useRef(null);
  const [importing, setImporting] = useState(false);

  async function download(type, format) {
    await downloadReport(type, format, `${type}_${todayStamp()}.${format}`);
  }

  async function onImport(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const confirmed = confirm("Importing a backup will add records from the JSON file to this logged-in farm account. Continue?");
    if (!confirmed) return;
    setImporting(true);
    try {
      const result = await importBackupFile(file);
      toast.success(result.message || "Backup imported");
    } catch {
      toast.error("Could not import backup");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Reports & Exports"
        eyebrow="Farm documents"
        action={
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={downloadBackup}><FileJson className="h-4 w-4" /> Download Full Farm Backup</button>
            <button className="btn-muted" onClick={() => inputRef.current?.click()} disabled={importing}><Upload className="h-4 w-4" /> {importing ? "Importing..." : "Import Farm Backup"}</button>
            <input ref={inputRef} className="hidden" type="file" accept="application/json,.json" onChange={onImport} />
          </div>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {reports.map((report) => (
          <article key={report.type} className="card p-5">
            <div className="mb-3 flex items-center gap-2 text-farm-950">
              <FileText className="h-5 w-5 text-farm-700" />
              <h2 className="font-bold">{report.title}</h2>
            </div>
            <p className="min-h-12 text-sm text-slate-600">{report.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn-primary" onClick={() => download(report.type, "pdf")}><Download className="h-4 w-4" /> PDF</button>
              <button className="btn-muted" onClick={() => download(report.type, "csv")}><FileText className="h-4 w-4" /> CSV</button>
              <button className="btn-muted" onClick={() => download(report.type, "xlsx")}><FileSpreadsheet className="h-4 w-4" /> Excel</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
