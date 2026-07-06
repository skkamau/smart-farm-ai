import { Download, FileJson, FileSpreadsheet, FileText } from "lucide-react";
import { downloadReport, todayStamp } from "../utils/downloads";

export default function ExportButtons({ type, basename, params, pdf = true, csv = true, xlsx = true }) {
  const base = basename || type;
  return (
    <div className="flex flex-wrap gap-2">
      {pdf && <button className="btn-primary" onClick={() => downloadReport(type, "pdf", `${base}_${todayStamp()}.pdf`, params)}><Download className="h-4 w-4" /> PDF</button>}
      {csv && <button className="btn-muted" onClick={() => downloadReport(type, "csv", `${base}_${todayStamp()}.csv`, params)}><FileText className="h-4 w-4" /> CSV</button>}
      {xlsx && <button className="btn-muted" onClick={() => downloadReport(type, "xlsx", `${base}_${todayStamp()}.xlsx`, params)}><FileSpreadsheet className="h-4 w-4" /> Excel</button>}
    </div>
  );
}

export function JsonButton({ onClick, children = "JSON" }) {
  return <button className="btn-muted" onClick={onClick}><FileJson className="h-4 w-4" /> {children}</button>;
}
