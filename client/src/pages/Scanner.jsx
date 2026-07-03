import { Camera, Keyboard, Search } from "lucide-react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import api from "../services/api";

function extractQrCodeId(rawValue = "") {
  const value = String(rawValue).trim();
  const match = value.match(/\/scan\/([^/?#]+)/i);
  return match?.[1] ? decodeURIComponent(match[1]) : value;
}

export default function Scanner() {
  const { qrCodeId } = useParams();
  const navigate = useNavigate();
  const scannerRef = useRef(null);
  const [manualCode, setManualCode] = useState("");
  const [status, setStatus] = useState("Point the camera at an animal QR code.");

  async function openAnimal(rawValue) {
    const code = extractQrCodeId(rawValue);
    if (!code) return;
    setStatus("Looking up animal...");
    try {
      const { data } = await api.get(`/animals/qr/${encodeURIComponent(code)}`);
      toast.success(`Opened ${data.animalId}`);
      navigate(`/animals/${data._id}`);
    } catch (error) {
      setStatus("No animal matched that QR code.");
      toast.error(error.response?.data?.message || "QR code not found");
    }
  }

  useEffect(() => {
    if (qrCodeId) openAnimal(qrCodeId);
  }, [qrCodeId]);

  useEffect(() => {
    if (qrCodeId) return undefined;

    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 260, height: 260 }, rememberLastUsedCamera: true },
      false
    );
    scannerRef.current = scanner;
    scanner.render(
      (decodedText) => {
        scanner.clear().catch(() => {});
        openAnimal(decodedText);
      },
      () => {}
    );

    return () => {
      scannerRef.current?.clear().catch(() => {});
    };
  }, [qrCodeId]);

  function submitManual(event) {
    event.preventDefault();
    openAnimal(manualCode);
  }

  return (
    <div>
      <PageHeader title="QR Scanner" eyebrow="Animal identification" />
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="card p-5">
          <div className="mb-4 flex items-center gap-2 text-farm-950">
            <Camera className="h-5 w-5" />
            <h2 className="font-bold">Camera Scanner</h2>
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-3">
            {qrCodeId ? <div className="p-8 text-center text-slate-600">Opening scanned animal...</div> : <div id="qr-reader" className="min-h-[320px]" />}
          </div>
          <p className="mt-3 text-sm text-slate-500">{status}</p>
        </section>

        <aside className="card p-5">
          <div className="mb-4 flex items-center gap-2 text-farm-950">
            <Keyboard className="h-5 w-5" />
            <h2 className="font-bold">Manual Lookup</h2>
          </div>
          <form onSubmit={submitManual} className="space-y-3">
            <label className="space-y-1">
              <span className="label">QR ID or scanned link</span>
              <input className="input" value={manualCode} onChange={(event) => setManualCode(event.target.value)} placeholder="QR-... or /scan/..." />
            </label>
            <button className="btn-primary w-full">
              <Search className="h-4 w-4" />
              Open animal
            </button>
          </form>
          <div className="mt-5 rounded-lg bg-farm-50 p-3 text-sm text-slate-600">
            Camera scanning works on localhost or HTTPS. Browser permission is required.
          </div>
        </aside>
      </div>
    </div>
  );
}
