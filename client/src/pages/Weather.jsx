import { CloudSun, DownloadCloud, Edit, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import CrudModal from "../components/CrudModal";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import api from "../services/api";
import { formatDate, inputDate } from "../utils";

const conditions = ["Sunny", "Cloudy", "Rainy", "Stormy", "Windy", "Cold", "Hot", "Foggy"];
const impacts = ["none", "low", "medium", "high"];
const emptyWeather = { recordDate: inputDate(new Date()), condition: "Sunny", temperature: "", rainfall: "", humidity: "", windSpeed: "", impact: "none", notes: "" };

export default function Weather() {
  const [records, setRecords] = useState([]);
  const [editing, setEditing] = useState(null);
  const [importing, setImporting] = useState(false);

  function load() {
    api.get("/weather").then(({ data }) => setRecords(data)).catch(() => toast.error("Could not load weather records"));
  }

  useEffect(load, []);

  async function remove(id) {
    if (!confirm("Delete this weather record?")) return;
    await api.delete(`/weather/${id}`);
    toast.success("Weather record deleted");
    load();
  }

  async function importCurrentWeather() {
    setImporting(true);
    try {
      const coords = await getBrowserLocation();
      await api.post("/weather/import-current", coords || {});
      toast.success("Weather imported");
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not import weather");
    } finally {
      setImporting(false);
    }
  }

  const latest = records[0];

  return (
    <div>
      <PageHeader
        title="Weather"
        eyebrow="Daily farm conditions"
        action={
          <div className="flex flex-wrap gap-2">
            <button className="btn-muted" onClick={importCurrentWeather} disabled={importing}>
              <DownloadCloud className="h-4 w-4" />
              {importing ? "Importing..." : "Import from internet"}
            </button>
            <button className="btn-primary" onClick={() => setEditing(emptyWeather)}>
              <Plus className="h-4 w-4" />
              Add weather
            </button>
          </div>
        }
      />

      <section className="card mb-5 p-5">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-field-sage text-farm-800">
            <CloudSun className="h-6 w-6" />
          </span>
          <div>
            <div className="label">Latest weather</div>
            <div className="mt-1 text-lg font-black text-farm-950">
              {latest ? `${latest.condition} ${latest.temperature || latest.temperature === 0 ? `- ${latest.temperature} C` : ""}` : "No weather recorded yet"}
            </div>
            {latest && <div className="text-sm text-slate-500">{formatDate(latest.recordDate)} - Rainfall {latest.rainfall || 0} mm - Impact {latest.impact}</div>}
          </div>
        </div>
      </section>

      <DataTable
        rows={records}
        emptyText="No weather records yet."
        columns={[
          { key: "recordDate", label: "Date", render: (row) => formatDate(row.recordDate) },
          { key: "condition", label: "Condition" },
          { key: "temperature", label: "Temp", render: (row) => (row.temperature || row.temperature === 0 ? `${row.temperature} C` : "Not set") },
          { key: "rainfall", label: "Rain", render: (row) => `${row.rainfall || 0} mm` },
          { key: "humidity", label: "Humidity", render: (row) => (row.humidity || row.humidity === 0 ? `${row.humidity}%` : "Not set") },
          { key: "impact", label: "Impact" }
        ]}
        actions={(row) => (
          <div className="flex justify-end gap-2">
            <button className="btn-muted px-2" onClick={() => setEditing({ ...row, recordDate: inputDate(row.recordDate) })} aria-label="Edit weather"><Edit className="h-4 w-4" /></button>
            <button className="btn-muted px-2 text-red-700" onClick={() => remove(row._id)} aria-label="Delete weather"><Trash2 className="h-4 w-4" /></button>
          </div>
        )}
      />

      {editing && <WeatherModal weather={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function WeatherModal({ weather, onClose, onSaved }) {
  const [form, setForm] = useState(weather);
  const isEdit = Boolean(weather._id);

  async function submit(event) {
    event.preventDefault();
    const payload = {
      ...form,
      temperature: form.temperature === "" ? undefined : Number(form.temperature),
      rainfall: Number(form.rainfall || 0),
      humidity: form.humidity === "" ? undefined : Number(form.humidity),
      windSpeed: form.windSpeed === "" ? undefined : Number(form.windSpeed)
    };
    if (isEdit) await api.put(`/weather/${weather._id}`, payload);
    else await api.post("/weather", payload);
    toast.success(isEdit ? "Weather updated" : "Weather recorded");
    onSaved();
  }

  return (
    <CrudModal title={isEdit ? "Edit Weather" : "Add Weather"} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Date" type="date" value={form.recordDate} onChange={(v) => setForm({ ...form, recordDate: v })} required />
        <label className="space-y-1">
          <span className="label">Condition</span>
          <select className="input" value={form.condition} onChange={(event) => setForm({ ...form, condition: event.target.value })}>
            {conditions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <Field label="Temperature (C)" type="number" value={form.temperature} onChange={(v) => setForm({ ...form, temperature: v })} />
        <Field label="Rainfall (mm)" type="number" value={form.rainfall} onChange={(v) => setForm({ ...form, rainfall: v })} />
        <Field label="Humidity (%)" type="number" value={form.humidity} onChange={(v) => setForm({ ...form, humidity: v })} />
        <Field label="Wind speed" type="number" value={form.windSpeed} onChange={(v) => setForm({ ...form, windSpeed: v })} />
        <label className="space-y-1">
          <span className="label">Farm impact</span>
          <select className="input" value={form.impact} onChange={(event) => setForm({ ...form, impact: event.target.value })}>
            {impacts.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="label">Notes</span>
          <textarea className="input min-h-24" value={form.notes || ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        </label>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" className="btn-muted" onClick={onClose}>Cancel</button>
          <button className="btn-primary">Save weather</button>
        </div>
      </form>
    </CrudModal>
  );
}

function Field({ label, value, onChange, type = "text", required }) {
  return <label className="space-y-1"><span className="label">{label}</span><input className="input" type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} required={required} /></label>;
}

function getBrowserLocation() {
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 60 * 60 * 1000 }
    );
  });
}
