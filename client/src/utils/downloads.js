import toast from "react-hot-toast";
import api from "../services/api";

export function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

export function saveBlob(data, filename) {
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function downloadReport(type, format, filename, params = {}) {
  try {
    const { data } = await api.get(`/reports/${type}/${format}`, { responseType: "blob", params });
    saveBlob(data, filename || `${type}_${todayStamp()}.${format}`);
  } catch {
    toast.error("Could not download export");
  }
}

export async function downloadIndividual(kind, id, format, filename) {
  try {
    const { data } = await api.get(`/reports/${kind}/${id}/${format}`, { responseType: "blob" });
    saveBlob(data, filename || `${kind}_${id}_report.${format}`);
  } catch {
    toast.error("Could not download report");
  }
}

export async function downloadBackup() {
  try {
    const { data } = await api.get("/reports/backup/json", { responseType: "blob" });
    saveBlob(data, `full_farm_backup_${todayStamp()}.json`);
  } catch {
    toast.error("Could not download backup");
  }
}

export async function importBackupFile(file) {
  const text = await file.text();
  const backup = JSON.parse(text);
  const { data } = await api.post("/reports/backup/import?confirm=true", backup);
  return data;
}
