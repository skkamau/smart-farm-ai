import { Download, FileSpreadsheet, FileText } from "lucide-react";
import toast from "react-hot-toast";
import PageHeader from "../components/PageHeader";
import api from "../services/api";

const reports = [
  { type: "animals", title: "Animal Report", description: "Basic details, QR codes, family links, health, vaccines, breeding, births, production placeholder, and notes." },
  { type: "health", title: "Health Report", description: "Vet cases, symptoms, diagnoses, treatments, medication, dosage, recovery, and notes." },
  { type: "vaccinations", title: "Vaccination Report", description: "Vaccine history, next due dates, batch numbers, vets, statuses, and notes." },
  { type: "breeding", title: "Breeding Report", description: "Mating records, pregnancy status, due dates, results, and vet notes." },
  { type: "births", title: "Birth Report", description: "Mother, father, offspring, complications, vet notes, and birth notes." },
  { type: "crops", title: "Crop Report", description: "Planting, harvest, yields, costs, revenue, and profit/loss." },
  { type: "financial", title: "Financial Report", description: "Income, expenses, profit/loss, categories, and transaction summary." },
  { type: "ai", title: "AI Recommendation Report", description: "Rule-based recommendations, priorities, related items, and suggested actions." }
];

export default function Reports() {
  async function download(type, format) {
    try {
      const { data } = await api.get(`/reports/${type}/${format}`, { responseType: "blob" });
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `smart-farm-${type}-report.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Could not export report");
    }
  }

  return (
    <div>
      <PageHeader title="Reports & Exports" eyebrow="Farm documents" />
      <div className="grid gap-4 lg:grid-cols-2">
        {reports.map((report) => (
          <article key={report.type} className="card p-5">
            <div className="mb-3 flex items-center gap-2 text-farm-950">
              <FileText className="h-5 w-5 text-farm-700" />
              <h2 className="font-bold">{report.title}</h2>
            </div>
            <p className="min-h-12 text-sm text-slate-600">{report.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn-primary" onClick={() => download(report.type, "pdf")}>
                <Download className="h-4 w-4" />
                PDF
              </button>
              <button className="btn-muted" onClick={() => download(report.type, "csv")}>
                <FileText className="h-4 w-4" />
                CSV
              </button>
              <button className="btn-muted" onClick={() => download(report.type, "xlsx")}>
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
