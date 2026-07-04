import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Beef, Bot, CalendarClock, Leaf, Sprout } from "lucide-react";
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
      <PageHeader title="Dashboard" eyebrow="SmartFarm AI" />
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
            <div>
              <div className="label">Live farm signals</div>
              <h2 className="mt-1 font-black text-farm-950">Operational Signals</h2>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-field-sage text-farm-800">
              <AlertTriangle className="h-5 w-5" />
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Signal icon={Beef} label="Sick animals" value={totals.sickAnimals || 0} tone="danger" />
            <Signal icon={Sprout} label="Ready crops" value={totals.readyCrops || 0} tone="green" />
            <Signal icon={ArrowDownCircle} label="Expenses" value={currency.format(totals.expenses || 0)} tone="amber" />
            <Signal icon={CalendarClock} label="Upcoming vaccines" value={totals.upcomingVaccinations || 0} tone="amber" />
            <Signal icon={AlertTriangle} label="Overdue vaccines" value={totals.overdueVaccinations || 0} tone="danger" />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <MiniBars title="Animal Status" items={data?.animalStatus || []} labelKey="status" />
            <MiniBars title="Crop Status" items={data?.cropStatus || []} labelKey="status" />
          </div>
        </section>

        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="label">Finance</div>
              <h2 className="mt-1 font-black text-farm-950">Recent Transactions</h2>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-farm-800 text-white">
              <ArrowUpCircle className="h-5 w-5" />
            </span>
          </div>
          <div className="space-y-3">
            {(data?.recentTransactions || []).map((item) => (
              <div key={item._id} className="flex items-center justify-between rounded-lg border border-farm-100 bg-field-cream p-3">
                <div>
                  <div className="font-bold text-farm-950">{item.description}</div>
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
          <div>
            <div className="label">Advisory</div>
            <h2 className="mt-1 font-black text-farm-950">Smart Recommendations</h2>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-field-sage text-farm-800">
            <Bot className="h-5 w-5" />
          </span>
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
          <h2 className="mb-4 font-black text-farm-950">Vaccination Alerts</h2>
          <div className="space-y-3">
            {(data?.vaccinationAlerts || []).map((record) => (
              <div key={record._id} className="flex items-center justify-between rounded-lg border border-farm-100 bg-white p-3">
                <div>
                  <div className="font-bold text-farm-950">{record.vaccineName}</div>
                  <div className="text-xs text-slate-500">{record.animal?.animalId} - due {formatDate(record.nextDueDate)}</div>
                </div>
                <span className={record.status === "overdue" ? "badge bg-red-50 text-red-700" : "badge bg-field-sage text-farm-900"}>{record.status}</span>
              </div>
            ))}
            {!data?.vaccinationAlerts?.length && <div className="text-sm text-slate-500">No vaccination alerts.</div>}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 font-black text-farm-950">Recent Vet Cases</h2>
          <div className="space-y-3">
            {(data?.recentVetCases || []).map((record) => (
              <div key={record._id} className="rounded-lg border border-farm-100 bg-field-cream p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-bold text-farm-950">{record.condition}</div>
                  <span className="badge bg-white text-slate-600">{record.recoveryStatus}</span>
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
          <h2 className="mb-4 font-black text-farm-950">Expected Births</h2>
          <div className="space-y-3">
            {(data?.expectedBirths || []).map((record) => (
              <div key={record._id} className="rounded-lg border border-farm-100 bg-field-cream p-3">
                <div className="font-bold text-farm-950">{record.femaleAnimal?.animalId} expected {formatDate(record.expectedBirthDate)}</div>
                <div className="mt-1 text-xs text-slate-500">Male: {record.maleAnimal?.animalId} - {record.breedingResult}</div>
              </div>
            ))}
            {!data?.expectedBirths?.length && <div className="text-sm text-slate-500">No expected births in the next 45 days.</div>}
          </div>
        </section>
        <section className="card p-5">
          <h2 className="mb-4 font-black text-farm-950">Recent Births</h2>
          <div className="space-y-3">
            {(data?.recentBirths || []).map((record) => (
              <div key={record._id} className="rounded-lg border border-farm-100 bg-field-cream p-3">
                <div className="font-bold text-farm-950">{formatDate(record.birthDate)} - {record.numberOfOffspring} offspring</div>
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
    <div className="rounded-lg border border-farm-100 bg-field-cream p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-black capitalize text-farm-950">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-field-sage text-farm-800">
            <Leaf className="h-4 w-4" />
          </span>
          {item.type}
        </span>
        <PriorityBadge value={item.priority} />
      </div>
      <div className="font-bold text-slate-800">{item.message}</div>
      <div className="mt-2 text-sm text-slate-500">{item.suggestedAction}</div>
    </div>
  );
}

function PriorityBadge({ value }) {
  const tones = {
    urgent: "bg-red-100 text-red-800",
    high: "bg-red-50 text-red-700",
    medium: "bg-field-sage text-farm-900",
    low: "bg-white text-slate-700"
  };
  return <span className={`badge ${tones[value] || tones.low}`}>{value}</span>;
}

function Signal({ icon: Icon, label, value, tone }) {
  const tones = {
    green: "bg-field-sage text-farm-800",
    amber: "bg-amber-50 text-amber-700",
    danger: "bg-red-50 text-red-700"
  };

  return (
    <div className="rounded-lg border border-farm-100 bg-white p-3">
      <div className={`mb-3 inline-flex rounded-lg p-2 ${tones[tone] || tones.green}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-xl font-black text-farm-950">{value}</div>
      <div className="text-xs font-semibold text-slate-500">{label}</div>
    </div>
  );
}

function MiniBars({ title, items, labelKey }) {
  const max = Math.max(...items.map((item) => item.count), 1);
  return (
    <div className="rounded-lg border border-farm-100 bg-field-cream p-4">
      <div className="mb-3 text-sm font-black text-farm-950">{title}</div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item[labelKey]}>
            <div className="mb-1 flex justify-between text-xs font-semibold text-slate-500">
              <span>{item[labelKey]}</span>
              <span>{item.count}</span>
            </div>
            <div className="h-2 rounded-full bg-white">
              <div className="h-2 rounded-full bg-farm-800" style={{ width: `${(item.count / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

