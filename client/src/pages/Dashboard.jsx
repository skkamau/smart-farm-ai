import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Beef, Bot, Sprout } from "lucide-react";
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
        <StatCard label="Pregnant" value={totals.pregnantAnimals || 0} detail={`${totals.expectedBirths || 0} births expected`} tone="amber" />
        <StatCard label="Due for breeding" value={totals.dueForBreeding || 0} detail="Healthy female animals" tone="slate" />
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
            <Signal icon={AlertTriangle} label="Upcoming vaccines" value={totals.upcomingVaccinations || 0} tone="text-amber-700 bg-amber-50" />
            <Signal icon={AlertTriangle} label="Overdue vaccines" value={totals.overdueVaccinations || 0} tone="text-red-700 bg-red-50" />
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
                  <div className="text-xs text-slate-500">{formatDate(item.transactionDate)} - {item.category}</div>
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

      <section className="card mt-5 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold text-farm-950">Smart AI Recommendations</h2>
          <Bot className="h-5 w-5 text-farm-700" />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {(data?.aiRecommendations || []).map((item, index) => (
            <RecommendationCard key={`${item.type}-${index}`} item={item} />
          ))}
          {!data?.aiRecommendations?.length && <div className="text-sm text-slate-500">No recommendations yet.</div>}
        </div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 font-bold text-farm-950">Vaccination Alerts</h2>
          <div className="space-y-3">
            {(data?.vaccinationAlerts || []).map((record) => (
              <div key={record._id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                <div>
                  <div className="font-semibold text-slate-800">{record.vaccineName}</div>
                  <div className="text-xs text-slate-500">{record.animal?.animalId} - due {formatDate(record.nextDueDate)}</div>
                </div>
                <span className={record.status === "overdue" ? "rounded-md bg-red-50 px-2 py-1 text-xs font-bold text-red-700" : "rounded-md bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700"}>{record.status}</span>
              </div>
            ))}
            {!data?.vaccinationAlerts?.length && <div className="text-sm text-slate-500">No vaccination alerts.</div>}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 font-bold text-farm-950">Recent Vet Cases</h2>
          <div className="space-y-3">
            {(data?.recentVetCases || []).map((record) => (
              <div key={record._id} className="rounded-lg border border-slate-100 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-slate-800">{record.condition}</div>
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{record.recoveryStatus}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">{record.animal?.animalId} - {formatDate(record.recordDate)} - {record.vetName || "Vet not set"}</div>
              </div>
            ))}
            {!data?.recentVetCases?.length && <div className="text-sm text-slate-500">No vet cases recorded.</div>}
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 font-bold text-farm-950">Expected Births</h2>
          <div className="space-y-3">
            {(data?.expectedBirths || []).map((record) => (
              <div key={record._id} className="rounded-lg border border-slate-100 p-3">
                <div className="font-semibold text-slate-800">{record.femaleAnimal?.animalId} expected {formatDate(record.expectedBirthDate)}</div>
                <div className="mt-1 text-xs text-slate-500">Male: {record.maleAnimal?.animalId} - {record.breedingResult}</div>
              </div>
            ))}
            {!data?.expectedBirths?.length && <div className="text-sm text-slate-500">No expected births in the next 45 days.</div>}
          </div>
        </section>
        <section className="card p-5">
          <h2 className="mb-4 font-bold text-farm-950">Recent Births</h2>
          <div className="space-y-3">
            {(data?.recentBirths || []).map((record) => (
              <div key={record._id} className="rounded-lg border border-slate-100 p-3">
                <div className="font-semibold text-slate-800">{formatDate(record.birthDate)} - {record.numberOfOffspring} offspring</div>
                <div className="mt-1 text-xs text-slate-500">Mother: {record.mother?.animalId} - Offspring: {(record.offspring || []).map((animal) => animal.animalId).join(", ")}</div>
              </div>
            ))}
            {!data?.recentBirths?.length && <div className="text-sm text-slate-500">No birth records yet.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}

function RecommendationCard({ item }) {
  return (
    <div className="rounded-lg border border-slate-100 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-bold capitalize text-farm-950">{item.type}</span>
        <PriorityBadge value={item.priority} />
      </div>
      <div className="font-semibold text-slate-800">{item.message}</div>
      <div className="mt-2 text-sm text-slate-500">{item.suggestedAction}</div>
    </div>
  );
}

function PriorityBadge({ value }) {
  const tones = {
    urgent: "bg-red-100 text-red-800",
    high: "bg-red-50 text-red-700",
    medium: "bg-amber-50 text-amber-700",
    low: "bg-slate-100 text-slate-700"
  };
  return <span className={`rounded-md px-2 py-1 text-xs font-bold ${tones[value] || tones.low}`}>{value}</span>;
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

