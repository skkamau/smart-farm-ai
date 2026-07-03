import { Download, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../services/api";

const API_ORIGIN = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "");

export default function DocumentManager({ entityType, entityId }) {
  const [documents, setDocuments] = useState([]);
  const [file, setFile] = useState(null);
  const [notes, setNotes] = useState("");

  function load() {
    if (!entityId) return;
    api
      .get("/documents", { params: { entityType, entityId } })
      .then(({ data }) => setDocuments(data))
      .catch(() => toast.error("Could not load documents"));
  }

  useEffect(load, [entityType, entityId]);

  async function upload(event) {
    event.preventDefault();
    if (!file) return toast.error("Choose a file first");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("entityType", entityType);
    formData.append("entityId", entityId);
    formData.append("notes", notes);
    await api.post("/documents", formData, { headers: { "Content-Type": "multipart/form-data" } });
    toast.success("Document uploaded");
    setFile(null);
    setNotes("");
    load();
  }

  async function remove(id) {
    if (!confirm("Delete this document?")) return;
    await api.delete(`/documents/${id}`);
    toast.success("Document deleted");
    load();
  }

  if (!entityId) return null;

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
      <div className="mb-3 font-bold text-farm-950">Documents & Images</div>
      <form onSubmit={upload} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <input className="input" type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        <input className="input" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional notes" />
        <button className="btn-primary">
          <Upload className="h-4 w-4" />
          Upload
        </button>
      </form>
      <div className="mt-4 space-y-2">
        {documents.map((doc) => (
          <div key={doc._id} className="flex flex-col justify-between gap-2 rounded-md bg-white p-3 text-sm sm:flex-row sm:items-center">
            <div>
              <div className="font-semibold text-slate-800">{doc.originalName}</div>
              <div className="text-xs text-slate-500">{Math.ceil(doc.size / 1024)} KB {doc.notes ? `- ${doc.notes}` : ""}</div>
            </div>
            <div className="flex gap-2">
              <a className="btn-muted" href={`${API_ORIGIN}${doc.url}`} target="_blank" rel="noreferrer">
                <Download className="h-4 w-4" />
                Open
              </a>
              <button className="btn-muted px-2 text-red-700" onClick={() => remove(doc._id)} type="button" aria-label="Delete document">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {!documents.length && <div className="text-sm text-slate-500">No documents uploaded yet.</div>}
      </div>
    </div>
  );
}
