export default function StatCard({ label, value, detail, tone = "green" }) {
  const tones = {
    green: "bg-farm-800 text-white",
    amber: "bg-field-sage text-farm-950",
    red: "bg-red-50 text-red-700",
    slate: "bg-farm-50 text-farm-900"
  };

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="label">{label}</div>
          <div className="mt-2 text-2xl font-black tracking-tight text-farm-950">{value}</div>
        </div>
        <div className={`h-3 w-9 rounded-full ${tones[tone]}`} />
      </div>
      {detail && <div className="mt-3 border-t border-farm-100 pt-3 text-xs font-semibold text-slate-500">{detail}</div>}
    </div>
  );
}
