import { Archive, ArrowLeft, Download, Edit, MinusCircle, Plus, Printer, QrCode, Scale, UsersRound } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Link, useNavigate, useParams } from "react-router-dom";
import CrudModal from "../components/CrudModal";
import api from "../services/api";
import { currency, formatDate, inputDate } from "../utils";

const eventTypes = ["added", "purchased", "hatched", "born", "stocked", "death", "culled", "sold", "harvested", "transferred_in", "transferred_out", "missing", "stock_correction"];

export default function AnimalGroupProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [tab, setTab] = useState("overview");
  const [eventType, setEventType] = useState(null);
  const [editing, setEditing] = useState(false);
  const [qrImage, setQrImage] = useState("");

  function load() {
    api.get(`/animal-groups/${id}`).then(({ data }) => setGroup(data)).catch(() => { toast.error("Animal group not found"); navigate("/animals"); });
  }
  useEffect(load, [id]);
  useEffect(() => {
    if (!group?.qrCodeValue) return;
    QRCode.toDataURL(group.qrCodeValue, { width: 360, margin: 2, color: { dark: "#073d29", light: "#ffffff" } }).then(setQrImage);
  }, [group?.qrCodeValue]);

  const summary = useMemo(() => {
    const events = group?.quantityEvents || [];
    const total = (types) => events.filter((event) => types.includes(event.eventType)).reduce((sum, event) => sum + event.quantity, 0);
    return { losses: total(["death", "culled", "missing"]), sold: total(["sold"]), harvested: total(["harvested"]) };
  }, [group]);

  if (!group) return <div className="card p-8 text-center text-slate-500">Loading animal group...</div>;

  function downloadQr() {
    const anchor = document.createElement("a"); anchor.href = qrImage; anchor.download = `${group.groupId}_qr.png`; anchor.click();
  }
  function printQr() {
    const popup = window.open("", "_blank", "width=520,height=680");
    popup.document.write(`<html><head><title>${group.groupId} QR</title><style>body{font-family:Arial;text-align:center;padding:36px}img{width:360px;max-width:100%}</style></head><body><h1>${group.groupId}</h1><h2>${group.groupName}</h2><img src="${qrImage}"/><p>${group.qrCodeValue}</p><script>onload=()=>print()</script></body></html>`); popup.document.close();
  }
  async function archive() {
    if (!confirm(`Archive ${group.groupId}? Its history and QR code will remain available.`)) return;
    await api.patch(`/animal-groups/${group._id}/archive`); toast.success("Group archived"); load();
  }

  return <div>
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div><Link to="/animals" className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-farm-700"><ArrowLeft className="h-4 w-4" /> Animals</Link><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-lg bg-field-sage text-farm-800"><UsersRound className="h-6 w-6" /></div><div><div className="text-xs font-black uppercase text-farm-700">{group.groupId}</div><h1 className="text-2xl font-black text-farm-950">{group.groupName}</h1><p className="text-sm text-slate-500">{group.species}{group.breedOrStrain ? ` - ${group.breedOrStrain}` : ""}</p></div></div></div>
      <div className="flex flex-wrap gap-2"><button className="btn-muted" onClick={() => setEditing(true)}><Edit className="h-4 w-4" /> Edit</button><button className="btn-muted text-red-700" onClick={archive} disabled={group.lifecycleStatus === "archived"}><Archive className="h-4 w-4" /> Archive</button></div>
    </div>

    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Starting quantity" value={Number(group.startingQuantity).toLocaleString()} />
      <Metric label="Current quantity" value={Number(group.currentQuantity).toLocaleString()} detail={`${label(group.quantityType)}${group.quantityType === "estimated" ? ` - ${label(group.quantityConfidence)} confidence` : ""}`} accent />
      <Metric label="Losses recorded" value={summary.losses.toLocaleString()} detail="Deaths, culls, and missing" />
      <Metric label={group.category === "fish" ? "Estimated biomass" : "Average weight"} value={group.category === "fish" ? `${group.estimatedBiomass || 0} kg` : `${group.averageWeight || 0} ${group.averageWeightUnit}`} />
    </div>

    <div className="mb-5 flex gap-1 overflow-x-auto rounded-lg border border-farm-100 bg-white p-1">
      {[['overview', 'Overview'], ['quantity', 'Quantity History'], ['qr', 'QR Code']].map(([key, text]) => <button key={key} className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold ${tab === key ? "bg-farm-900 text-white" : "text-slate-600 hover:bg-farm-50"}`} onClick={() => setTab(key)}>{text}</button>)}
    </div>

    {tab === "overview" && <div className="grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
      <section className="card p-5"><h2 className="font-black text-farm-950">Group details</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Info label="Category" value={label(group.category)} /><Info label="Purpose" value={group.productionPurpose || "Not set"} /><Info label="Location" value={`${group.locationName || "Not named"} (${label(group.locationType)})`} />
        <Info label="Arrival / stocking" value={formatDate(group.hatchStockingOrArrivalDate)} /><Info label="Age" value={age(group.hatchStockingOrArrivalDate)} /><Info label="Health" value={label(group.healthStatus)} />
        <Info label="Supplier / source" value={group.supplierOrSource || "Not set"} /><Info label="Opening cost" value={currency.format(group.purchaseCost || 0)} /><Info label="Estimated value" value={currency.format(group.estimatedValue || 0)} />
      </div>{group.notes && <div className="mt-4 rounded-md bg-farm-50 p-4 text-sm text-slate-700"><div className="label">Notes</div><p className="mt-2">{group.notes}</p></div>}</section>
      <section className="card p-5"><h2 className="font-black text-farm-950">Record an activity</h2><p className="mt-1 text-sm text-slate-500">Every quantity change creates a permanent history entry.</p><div className="mt-4 grid grid-cols-2 gap-2">
        <Action label="Add animals" type="added" onClick={setEventType} positive /><Action label="Mortality" type="death" onClick={setEventType} /><Action label="Sale" type="sold" onClick={setEventType} /><Action label="Harvest" type="harvested" onClick={setEventType} /><Action label="Transfer" type="transferred_out" onClick={setEventType} /><Action label="Correct count" type="stock_correction" onClick={setEventType} positive />
      </div></section>
    </div>}

    {tab === "quantity" && <section className="card overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-farm-100 p-5"><div><h2 className="font-black text-farm-950">Quantity calculation</h2><p className="text-sm text-slate-500">Starting stock plus additions minus losses, sales, harvests, and transfers.</p></div><button className="btn-primary" onClick={() => setEventType("added")}><Plus className="h-4 w-4" /> Record event</button></div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-field-mist"><tr>{["Date", "Event", "Quantity", "Change", "Balance", "Reason"].map((heading) => <th key={heading} className="px-4 py-3 text-left text-xs font-black uppercase text-farm-800">{heading}</th>)}</tr></thead><tbody className="divide-y divide-farm-100 bg-white">{group.quantityEvents.map((event) => <tr key={event._id}><td className="px-4 py-3">{formatDate(event.eventDate)}</td><td className="px-4 py-3 font-bold">{label(event.eventType)}</td><td className="px-4 py-3">{event.quantity.toLocaleString()}</td><td className={`px-4 py-3 font-black ${event.quantityDelta < 0 ? "text-red-700" : "text-farm-700"}`}>{event.quantityDelta > 0 ? "+" : ""}{event.quantityDelta.toLocaleString()}</td><td className="px-4 py-3 font-black">{event.balanceAfter.toLocaleString()}</td><td className="px-4 py-3 text-slate-500">{event.reason || "-"}</td></tr>)}</tbody></table></div></section>}

    {tab === "qr" && <section className="card mx-auto max-w-2xl p-6 text-center"><QrCode className="mx-auto h-6 w-6 text-farm-700" /><h2 className="mt-2 text-xl font-black text-farm-950">Group QR code</h2><p className="mt-1 text-sm text-slate-500">One QR code identifies this whole group. It opens this profile when scanned.</p>{qrImage && <img className="mx-auto mt-5 w-72 max-w-full rounded-md border border-farm-100" src={qrImage} alt={`QR code for ${group.groupId}`} />}<div className="mt-4 break-all text-xs text-slate-500">{group.qrCodeValue}</div><div className="mt-5 flex justify-center gap-2"><button className="btn-muted" onClick={downloadQr}><Download className="h-4 w-4" /> PNG</button><button className="btn-primary" onClick={printQr}><Printer className="h-4 w-4" /> Print</button></div></section>}

    {eventType && <QuantityEventModal group={group} initialType={eventType} onClose={() => setEventType(null)} onSaved={() => { setEventType(null); load(); setTab("quantity"); }} />}
    {editing && <EditGroupModal group={group} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />}
  </div>;
}

function QuantityEventModal({ group, initialType, onClose, onSaved }) {
  const [form, setForm] = useState({ eventType: initialType, quantity: "", eventDate: inputDate(new Date()), reason: "", destinationOrSource: "", financialAmount: "", notes: "", idempotencyKey: crypto.randomUUID() });
  const [saving, setSaving] = useState(false);
  async function submit(event) { event.preventDefault(); setSaving(true); try { await api.post(`/animal-groups/${group._id}/events`, { ...form, quantity: Number(form.quantity), financialAmount: Number(form.financialAmount || 0) }); toast.success("Quantity event recorded"); onSaved(); } catch (error) { toast.error(error.response?.data?.message || "Could not record event"); } finally { setSaving(false); } }
  return <CrudModal title="Record quantity event" onClose={onClose}><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2"><Select label="Event type" value={form.eventType} onChange={(v) => setForm({ ...form, eventType: v })} options={eventTypes} /><Field label={form.eventType === "stock_correction" ? "Correct current quantity" : "Quantity"} type="number" min="0" value={form.quantity} onChange={(v) => setForm({ ...form, quantity: v })} required /><Field label="Event date" type="date" value={form.eventDate} onChange={(v) => setForm({ ...form, eventDate: v })} required /><Field label="Financial amount" type="number" min="0" value={form.financialAmount} onChange={(v) => setForm({ ...form, financialAmount: v })} /><Field label="Reason" value={form.reason} onChange={(v) => setForm({ ...form, reason: v })} /><Field label="Destination or source" value={form.destinationOrSource} onChange={(v) => setForm({ ...form, destinationOrSource: v })} /><label className="space-y-1 sm:col-span-2"><span className="label">Notes</span><textarea className="input min-h-20" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label><div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="btn-muted" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Record event"}</button></div></form></CrudModal>;
}

function EditGroupModal({ group, onClose, onSaved }) {
  const [form, setForm] = useState({ ...group, hatchStockingOrArrivalDate: inputDate(group.hatchStockingOrArrivalDate) });
  async function submit(event) { event.preventDefault(); try { await api.put(`/animal-groups/${group._id}`, { ...form, averageWeight: Number(form.averageWeight || 0), estimatedValue: Number(form.estimatedValue || 0) }); toast.success("Group updated"); onSaved(); } catch (error) { toast.error(error.response?.data?.message || "Could not update group"); } }
  return <CrudModal title="Edit animal group" onClose={onClose}><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2"><Field label="Group name" value={form.groupName} onChange={(v) => setForm({ ...form, groupName: v })} required /><Field label="Species" value={form.species} onChange={(v) => setForm({ ...form, species: v })} required /><Field label="Breed or strain" value={form.breedOrStrain} onChange={(v) => setForm({ ...form, breedOrStrain: v })} /><Field label="Location name" value={form.locationName} onChange={(v) => setForm({ ...form, locationName: v })} /><Field label={`Average weight (${form.averageWeightUnit})`} type="number" min="0" value={form.averageWeight} onChange={(v) => setForm({ ...form, averageWeight: v })} /><Select label="Weight unit" value={form.averageWeightUnit} onChange={(v) => setForm({ ...form, averageWeightUnit: v })} options={["g", "kg"]} /><Select label="Health status" value={form.healthStatus} onChange={(v) => setForm({ ...form, healthStatus: v })} options={["healthy", "mild", "moderate", "serious", "critical", "recovering", "chronic", "stable", "unknown"]} /><Field label="Estimated value" type="number" min="0" value={form.estimatedValue} onChange={(v) => setForm({ ...form, estimatedValue: v })} /><label className="space-y-1 sm:col-span-2"><span className="label">Notes</span><textarea className="input min-h-20" value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label><div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="btn-muted" onClick={onClose}>Cancel</button><button className="btn-primary">Save changes</button></div></form></CrudModal>;
}

function Metric({ label: title, value, detail, accent }) { return <div className={`card p-4 ${accent ? "border-farm-600 bg-farm-950 text-white" : ""}`}><div className={`text-xs font-black uppercase ${accent ? "text-farm-100" : "text-slate-500"}`}>{title}</div><div className="mt-2 text-2xl font-black">{value}</div>{detail && <div className={`mt-1 text-xs ${accent ? "text-farm-100" : "text-slate-500"}`}>{detail}</div>}</div>; }
function Info({ label: title, value }) { return <div className="rounded-md border border-farm-100 p-3"><div className="label">{title}</div><div className="mt-1 font-semibold text-slate-700">{value}</div></div>; }
function Action({ label: text, type, onClick, positive }) { return <button className="rounded-md border border-farm-100 p-3 text-left text-sm font-bold text-farm-900 hover:bg-farm-50" onClick={() => onClick(type)}>{positive ? <Plus className="mb-2 h-4 w-4" /> : <MinusCircle className="mb-2 h-4 w-4" />}{text}</button>; }
function Field({ label: title, value, onChange, type = "text", required, min }) { return <label className="space-y-1"><span className="label">{title}</span><input className="input" type={type} min={min} value={value ?? ""} required={required} onChange={(e) => onChange(e.target.value)} /></label>; }
function Select({ label: title, value, onChange, options }) { return <label className="space-y-1"><span className="label">{title}</span><select className="input" value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option value={option} key={option}>{label(option)}</option>)}</select></label>; }
function label(value) { return String(value || "unknown").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function age(value) { if (!value) return "Not set"; const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000)); return days < 14 ? `${days} days` : `${Math.floor(days / 7)} weeks`; }
