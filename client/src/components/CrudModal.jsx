import { X } from "lucide-react";

export default function CrudModal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/45 p-0 sm:items-center sm:justify-center sm:p-4">
      <div className="max-h-[92vh] w-full overflow-auto rounded-t-2xl bg-white shadow-lift sm:max-w-3xl sm:rounded-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-farm-100 bg-white/95 px-5 py-4 backdrop-blur">
          <h2 className="text-lg font-black text-farm-950">{title}</h2>
          <button className="btn-muted px-2" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
