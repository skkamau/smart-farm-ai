import { ArrowLeft, Download, Plus, Printer } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import DocumentManager from "../components/DocumentManager";
import api from "../services/api";
import { currency, formatDate } from "../utils";
import { downloadIndividual } from "../utils/downloads";
import { healthMedicationSummary } from "../utils/healthRecords";

export default function AnimalProfile() {
  const { id } = useParams();
  const [animal, setAnimal] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    api
      .get(`/animals/${id}`)
      .then(({ data }) => setAnimal(data))
      .catch(() => toast.error("Could not load animal profile"));
  }, [id]);

  useEffect(() => {
    if (!animal?.qrCodeValue) return;
    QRCode.toDataURL(animal.qrCodeValue, { width: 360, margin: 2, color: { dark: "#112617", light: "#ffffff" } })
      .then(setQrDataUrl)
      .catch(() => toast.error("Could not generate QR code"));
  }, [animal]);

  function downloadPng() {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `${animal.animalId}-qr-code.png`;
    link.click();
  }

  async function downloadAnimalRecord() {
    await downloadIndividual("animal", animal._id, "pdf", `animal_${animal.animalId}_report.pdf`);
  }

  function printQr() {
    if (!qrDataUrl) return;
    const printWindow = window.open("", "_blank", "width=520,height=680");
    printWindow.document.write(`
      <html>
        <head>
          <title>${animal.animalId} QR Code</title>
          <style>
            body { font-family: Arial, sans-serif; display: flex; min-height: 100vh; align-items: center; justify-content: center; margin: 0; }
            .label { text-align: center; border: 1px solid #d8e2d5; border-radius: 8px; padding: 24px; }
            img { width: 280px; height: 280px; }
            h1 { margin: 12px 0 4px; font-size: 24px; }
            p { margin: 4px 0; color: #475569; }
          </style>
        </head>
        <body>
          <div class="label">
            <img src="${qrDataUrl}" alt="QR code" />
            <h1>${animal.animalId}</h1>
            <p>${animal.name || "Unnamed"} - ${animal.species}</p>
            <p>${animal.qrCodeId}</p>
          </div>
          <script>window.onload = () => { window.print(); window.close(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  if (!animal) {
    return <div className="text-slate-600">Loading animal profile...</div>;
  }

  const healthCost = (animal.healthRecords || []).reduce((sum, record) => sum + Number(record.totalCost || 0), 0);
  const vaccinationCost = (animal.vaccinationRecords || []).reduce((sum, record) => sum + Number(record.totalCost || 0), 0);
  const followUps = (animal.healthRecords || []).filter((record) => record.followUpDate);

  return (
    <div>
      <PageHeader
        title={animal.name || animal.animalId}
        eyebrow="Animal profile"
        action={
          <Link className="btn-muted" to="/animals">
            <ArrowLeft className="h-4 w-4" />
            Back to animals
          </Link>
        }
      />

      {animal.lifecycleStatus === "deceased" && (
        <section className="mb-5 rounded-lg border border-slate-300 bg-slate-900 p-5 text-white">
          <div className="inline-flex rounded-md bg-white/15 px-2 py-1 text-xs font-black uppercase">Deceased</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DeathInfo label="Date of death" value={formatDate(animal.dateOfDeath)} />
            <DeathInfo label="Cause" value={animal.causeOfDeath === "Other" ? animal.customCauseOfDeath : animal.causeOfDeath || "Not recorded"} />
            <DeathInfo label="Recorded by" value={animal.deathRecordedBy?.name || "Farm owner"} />
            <DeathInfo label="Veterinary confirmation" value={animal.veterinaryConfirmation || "Not recorded"} />
          </div>
          {animal.deathNotes && <p className="mt-4 text-sm text-slate-200">{animal.deathNotes}</p>}
        </section>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="card p-5">
          <h2 className="mb-4 font-bold text-farm-950">Basic Information</h2>
          <div className="mb-4">
            <button className="btn-primary" onClick={downloadAnimalRecord}>
              <Download className="h-4 w-4" />
              Download Animal Report
            </button>
            <button className="btn-muted ml-2" onClick={() => downloadIndividual("animal", animal._id, "xlsx", `animal_${animal.animalId}_report.xlsx`)}>Excel</button>
            <button className="btn-muted ml-2" onClick={() => downloadIndividual("animal", animal._id, "csv", `animal_${animal.animalId}_report.csv`)}>CSV</button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Info label="Animal ID" value={animal.animalId} />
            <Info label="Species" value={animal.species} />
            <Info label="Breed" value={animal.breed || "Not set"} />
            <Info label="Gender" value={animal.gender} />
            <Info label="Date of birth" value={formatDate(animal.dateOfBirth)} />
            <Info label="Weight" value={`${animal.weight || 0} kg`} />
            <Info label="Location" value={animal.location || "Not set"} />
            <Info label="Lifecycle status" value={statusLabel(animal.lifecycleStatus)} />
            <Info label="Health status" value={animal.lifecycleStatus === "deceased" ? "Not applicable" : statusLabel(animal.healthStatus)} />
            <Info label="Reproductive status" value={statusLabel(animal.reproductiveStatus)} />
            <Info label="Estimated value" value={currency.format(animal.estimatedValue || 0)} />
          </div>
          <div className="mt-5 rounded-lg border border-slate-100 bg-slate-50 p-4">
            <div className="label">Notes</div>
            <p className="mt-2 text-sm text-slate-700">{animal.notes || "No notes yet."}</p>
          </div>
          <div className="mt-5">
            <DocumentManager entityType="animal" entityId={animal._id} />
          </div>
        </section>

        <aside className="card p-5">
          <h2 className="font-bold text-farm-950">QR Identification</h2>
          <p className="mt-1 text-sm text-slate-500">Permanent scan link for this animal profile.</p>
          {animal.lifecycleStatus === "deceased" && <div className="mt-3 rounded-md bg-slate-900 px-3 py-2 text-center text-sm font-bold text-white">This animal is deceased</div>}
          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
            {qrDataUrl ? <img className="mx-auto h-64 w-64" src={qrDataUrl} alt={`${animal.animalId} QR code`} /> : <div className="h-64 rounded-md bg-slate-100" />}
          </div>
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <div><span className="font-semibold">QR ID:</span> {animal.qrCodeId}</div>
            <div className="break-all"><span className="font-semibold">Link:</span> {animal.qrCodeValue}</div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button className="btn-primary" onClick={downloadPng} disabled={!qrDataUrl}>
              <Download className="h-4 w-4" />
              PNG
            </button>
            <button className="btn-muted" onClick={printQr} disabled={!qrDataUrl}>
              <Printer className="h-4 w-4" />
              Print
            </button>
          </div>
        </aside>
      </div>

      <section className="card mt-5 p-5">
        <h2 className="mb-4 font-bold text-farm-950">Animal Health Costs</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Info label="Total health cost" value={currency.format(healthCost)} />
          <Info label="Vaccination cost" value={currency.format(vaccinationCost)} />
          <Info label="Combined animal care cost" value={currency.format(healthCost + vaccinationCost)} />
        </div>
        <div className="mt-4 rounded-lg bg-field-cream p-4">
          <div className="label">Follow-up reminders</div>
          <div className="mt-2 text-sm text-slate-700">
            {followUps.length ? followUps.map((record) => `${statusLabel(record.healthCondition)}: ${formatDate(record.followUpDate)}`).join(", ") : "No follow-up dates set."}
          </div>
        </div>
      </section>

      <section className="card mt-5 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-bold text-farm-950">Family Tree</h2>
          <Link className="btn-muted" to="/births"><Plus className="h-4 w-4" /> Add birth</Link>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr_1fr]">
          <ParentBox mother={animal.family?.mother} father={animal.family?.father} />
          <div className="rounded-lg border border-farm-100 bg-farm-50 p-4 text-center">
            <div className="label">Current animal</div>
            <div className="mt-2 text-lg font-bold text-farm-950">{animal.animalId}</div>
            <div className="text-sm text-slate-600">{animal.name || animal.species}</div>
            <div className="mt-3 text-sm font-semibold text-farm-700">Offspring count: {animal.family?.offspringCount || 0}</div>
          </div>
          <FamilyBox title="Children" items={animal.family?.children || []} empty="No children linked" />
        </div>
        <div className="mt-4">
          <FamilyBox title="Siblings" items={animal.family?.siblings || []} empty="No siblings linked" />
        </div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-bold text-farm-950">Health History & Vet Cases</h2>
            <Link className="btn-muted" to="/health"><Plus className="h-4 w-4" /> Add</Link>
          </div>
          <div className="space-y-3">
            {(animal.healthRecords || []).map((record) => (
              <div key={record._id} className="rounded-lg border border-slate-100 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-slate-800">{statusLabel(record.healthCondition)}</div>
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{animal.lifecycleStatus === "deceased" ? "Not applicable" : statusLabel(animal.healthStatus)}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">{formatDate(record.recordDate)} - {record.vetName || "Vet not set"}</div>
                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <HistoryLine label="Symptoms" value={record.symptoms} />
                  <HistoryLine label="Diagnosis" value={record.diagnosis} />
                  <HistoryLine label="Medication" value={healthMedicationSummary(record)} />
                  <HistoryLine label="Cost" value={currency.format(record.totalCost || 0)} />
                  <HistoryLine label="Follow-up" value={formatDate(record.followUpDate)} />
                </div>
                {record.notes && <p className="mt-3 text-sm text-slate-600">{record.notes}</p>}
              </div>
            ))}
            {!animal.healthRecords?.length && <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">No health records yet.</div>}
          </div>
        </section>

        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-bold text-farm-950">Vaccination History</h2>
            <Link className="btn-muted" to="/vaccinations"><Plus className="h-4 w-4" /> Add</Link>
          </div>
          {(animal.overdueVaccinations || []).length > 0 && (
            <Alert title="Overdue vaccines" records={animal.overdueVaccinations} tone="red" />
          )}
          {(animal.upcomingVaccinations || []).length > 0 && (
            <Alert title="Upcoming vaccines" records={animal.upcomingVaccinations} tone="amber" />
          )}
          <div className="mt-4 space-y-3">
            {(animal.vaccinationRecords || []).map((record) => (
              <div key={record._id} className="rounded-lg border border-slate-100 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-slate-800">{record.vaccineName}</div>
                  <VaccineStatus value={record.status} />
                </div>
                <div className="mt-2 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                  <HistoryLine label="Date given" value={formatDate(record.dateGiven)} />
                  <HistoryLine label="Next due" value={formatDate(record.nextDueDate)} />
                  <HistoryLine label="Vet" value={record.vetName || "Not set"} />
                  <HistoryLine label="Batch" value={record.batchNumber || "Not set"} />
                  <HistoryLine label="Cost" value={currency.format(record.totalCost || 0)} />
                </div>
                {record.notes && <p className="mt-3 text-sm text-slate-600">{record.notes}</p>}
              </div>
            ))}
            {!animal.vaccinationRecords?.length && <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">No vaccination records yet.</div>}
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 font-bold text-farm-950">Breeding Records</h2>
          <div className="space-y-3">
            {(animal.breedingRecords || []).map((record) => (
              <div key={record._id} className="rounded-lg border border-slate-100 p-4">
                <div className="font-bold text-slate-800">{animalLabel(record.femaleAnimal)} x {animalLabel(record.maleAnimal)}</div>
                <div className="mt-2 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                  <HistoryLine label="Mating" value={formatDate(record.matingDate)} />
                  <HistoryLine label="Pregnancy" value={record.pregnancyStatus} />
                  <HistoryLine label="Expected birth" value={formatDate(record.expectedBirthDate)} />
                  <HistoryLine label="Result" value={record.breedingResult} />
                </div>
              </div>
            ))}
            {!animal.breedingRecords?.length && <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">No breeding records yet.</div>}
          </div>
        </section>
        <section className="card p-5">
          <h2 className="mb-4 font-bold text-farm-950">Birth Records</h2>
          <div className="space-y-3">
            {(animal.birthRecords || []).map((record) => (
              <div key={record._id} className="rounded-lg border border-slate-100 p-4">
                <div className="font-bold text-slate-800">{formatDate(record.birthDate)} - {record.numberOfOffspring} offspring</div>
                <div className="mt-2 text-sm text-slate-600">Mother: {animalLabel(record.mother)} | Father: {record.father ? animalLabel(record.father) : "Unknown"}</div>
                <div className="mt-2 text-sm text-slate-600">Offspring: {(record.offspring || []).map(animalLabel).join(", ") || "Not linked"}</div>
                {record.birthComplications && <div className="mt-2 text-sm text-slate-600"><span className="font-semibold">Complications:</span> {record.birthComplications}</div>}
                {record.vetNotes && <div className="mt-1 text-sm text-slate-600"><span className="font-semibold">Vet notes:</span> {record.vetNotes}</div>}
              </div>
            ))}
            {!animal.birthRecords?.length && <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">No birth records yet.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-100 p-4">
      <div className="label">{label}</div>
      <div className="mt-2 font-semibold text-slate-800">{value}</div>
    </div>
  );
}

function DeathInfo({ label, value }) { return <div><div className="text-xs font-bold uppercase text-slate-400">{label}</div><div className="mt-1 font-semibold">{value}</div></div>; }

function HistoryLine({ label, value }) {
  return <div><span className="font-semibold text-slate-500">{label}:</span> <span className="text-slate-700">{value || "Not recorded"}</span></div>;
}

function animalLabel(animal) {
  return animal ? `${animal.animalId} - ${animal.name || animal.species}` : "Not set";
}

function statusLabel(value) { return String(value || "unknown").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }

function FamilyBox({ title, items, empty }) {
  const visible = (items || []).filter(Boolean);
  return (
    <div className="rounded-lg border border-slate-100 p-4">
      <div className="label">{title}</div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {visible.map((animal) => (
          <Link key={animal._id} to={`/animals/${animal._id}`} className="rounded-md bg-white p-3 text-sm font-semibold text-slate-700 hover:bg-farm-50">
            {animalLabel(animal)}
          </Link>
        ))}
        {!visible.length && <div className="text-sm text-slate-500">{empty}</div>}
      </div>
    </div>
  );
}

function ParentBox({ mother, father }) {
  return (
    <div className="rounded-lg border border-slate-100 p-4">
      <div className="label">Parents</div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {mother ? <Link to={`/animals/${mother._id}`} className="rounded-md bg-white p-3 text-sm font-semibold text-slate-700 hover:bg-farm-50">Mother: {animalLabel(mother)}</Link> : <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">Mother: Not linked</div>}
        {father ? <Link to={`/animals/${father._id}`} className="rounded-md bg-white p-3 text-sm font-semibold text-slate-700 hover:bg-farm-50">Father: {animalLabel(father)}</Link> : <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">Father: Unknown</div>}
      </div>
    </div>
  );
}

function VaccineStatus({ value }) {
  const tone = value === "overdue" ? "bg-red-50 text-red-700" : value === "upcoming" ? "bg-amber-50 text-amber-700" : "bg-farm-50 text-farm-700";
  return <span className={`rounded-md px-2 py-1 text-xs font-bold ${tone}`}>{value}</span>;
}

function Alert({ title, records, tone }) {
  const classes = tone === "red" ? "border-red-100 bg-red-50 text-red-800" : "border-amber-100 bg-amber-50 text-amber-800";
  return (
    <div className={`mb-3 rounded-lg border p-3 ${classes}`}>
      <div className="text-sm font-bold">{title}</div>
      <div className="mt-1 text-sm">{records.map((record) => `${record.vaccineName} (${formatDate(record.nextDueDate)})`).join(", ")}</div>
    </div>
  );
}

