export default function StatCard({ label, value, detail, tone = "green" }) {
  const tones = {
    green: "bg-farm-50 text-farm-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    slate: "bg-slate-100 text-slate-700"
  };

  return (
    <div className="card p-4">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className={`mt-3 inline-flex rounded-md px-2.5 py-1 text-2xl font-bold ${tones[tone]}`}>{value}</div>
      {detail && <div className="mt-3 text-sm text-slate-500">{detail}</div>}
    </div>
  );
}
