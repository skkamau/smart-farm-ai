import { ArrowLeft, Download, Printer } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import api from "../services/api";
import { currency, formatDate } from "../utils";

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
            <p>${animal.name || "Unnamed"} · ${animal.species}</p>
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

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="card p-5">
          <h2 className="mb-4 font-bold text-farm-950">Basic Information</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Info label="Animal ID" value={animal.animalId} />
            <Info label="Species" value={animal.species} />
            <Info label="Breed" value={animal.breed || "Not set"} />
            <Info label="Gender" value={animal.gender} />
            <Info label="Date of birth" value={formatDate(animal.dateOfBirth)} />
            <Info label="Weight" value={`${animal.weight || 0} kg`} />
            <Info label="Location" value={animal.location || "Not set"} />
            <Info label="Status" value={animal.status} />
            <Info label="Estimated value" value={currency.format(animal.estimatedValue || 0)} />
          </div>
          <div className="mt-5 rounded-lg border border-slate-100 bg-slate-50 p-4">
            <div className="label">Notes</div>
            <p className="mt-2 text-sm text-slate-700">{animal.notes || "No notes yet."}</p>
          </div>
        </section>

        <aside className="card p-5">
          <h2 className="font-bold text-farm-950">QR Identification</h2>
          <p className="mt-1 text-sm text-slate-500">Permanent scan link for this animal profile.</p>
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
