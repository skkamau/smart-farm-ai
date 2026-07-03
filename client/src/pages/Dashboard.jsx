import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Beef, Sprout } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import api from "../services/api";
import { currency, formatDate } from "../utils";

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api
      .get("/dashboard")
      .then(({ data }) => setData(data))
      .catch(() => toast.error("Could not load dashboard"));
  }, []);

  const totals = data?.totals || {};

  return (
    <div>
      <PageHeader title="Farm Dashboard" eyebrow="Today overview" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Animals" value={totals.animals ?? "..."} detail="Active livestock records" />
        <StatCard label="Crops" value={totals.crops ?? "..."} detail={`${totals.readyCrops || 0} ready for harvest`} tone="slate" />
        <StatCard label="Income" value={currency.format(totals.income || 0)} detail="Recorded farm income" />
        <StatCard label="Profit/Loss" value={currency.format(totals.profitLoss || 0)} detail="Income minus expenses" tone={(totals.profitLoss || 0) >= 0 ? "green" : "red"} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-farm-950">Operational Signals</h2>
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Signal icon={Beef} label="Sick animals" value={totals.sickAnimals || 0} tone="text-red-700 bg-red-50" />
            <Signal icon={Sprout} label="Ready crops" value={totals.readyCrops || 0} tone="text-farm-700 bg-farm-50" />
            <Signal icon={ArrowDownCircle} label="Expenses" value={currency.format(totals.expenses || 0)} tone="text-amber-700 bg-amber-50" />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <MiniBars title="Animal Status" items={data?.animalStatus || []} labelKey="status" />
            <MiniBars title="Crop Status" items={data?.cropStatus || []} labelKey="status" />
          </div>
        </section>

        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-farm-950">Recent Transactions</h2>
            <ArrowUpCircle className="h-5 w-5 text-farm-700" />
          </div>
          <div className="space-y-3">
            {(data?.recentTransactions || []).map((item) => (
              <div key={item._id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                <div>
                  <div className="font-semibold text-slate-800">{item.description}</div>
                  <div className="text-xs text-slate-500">{formatDate(item.transactionDate)} · {item.category}</div>
                </div>
                <div className={item.type === "income" ? "font-bold text-farm-700" : "font-bold text-red-700"}>
                  {item.type === "income" ? "+" : "-"}{currency.format(item.amount)}
                </div>
              </div>
            ))}
            {!data?.recentTransactions?.length && <div className="text-sm text-slate-500">No transactions yet.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}

function Signal({ icon: Icon, label, value, tone }) {
  return (
    <div className="rounded-lg border border-slate-100 p-3">
      <div className={`mb-3 inline-flex rounded-md p-2 ${tone}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-xl font-bold text-farm-950">{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
    </div>
  );
}

function MiniBars({ title, items, labelKey }) {
  const max = Math.max(...items.map((item) => item.count), 1);
  return (
    <div className="rounded-lg border border-slate-100 p-4">
      <div className="mb-3 text-sm font-bold text-slate-700">{title}</div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item[labelKey]}>
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>{item[labelKey]}</span>
              <span>{item.count}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-farm-700" style={{ width: `${(item.count / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
