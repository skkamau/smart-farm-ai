import { AlertTriangle, ArrowUpCircle, Beef, Bell, Bot, CalendarClock, CloudSun, Sprout } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
  const reminders = useMemo(() => buildDailyReminders(data), [data]);

  return (
    <div>
      <PageHeader title="Dashboard" eyebrow="SmartFarm AI" />

      <section className="card border-farm-200 bg-field-cream p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="label">Daily reminders</div>
            <h2 className="mt-1 text-xl font-black text-farm-950">Notifications</h2>
          </div>
          <Link className="btn-muted py-1.5 text-xs" to="/alerts">
            View all
          </Link>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {reminders.map((item) => (
            <ReminderCard key={item.key} item={item} />
          ))}
        </div>
      </section>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active animals" value={totals.animals ?? "..."} detail={`${totals.deceasedAnimals || 0} deceased · ${totals.sickAnimals || 0} sick`} />
        <StatCard label="Crops" value={totals.crops ?? "..."} detail={`${totals.readyCrops || 0} ready for harvest`} tone="slate" />
        <StatCard label="Profit/Loss" value={currency.format(totals.profitLoss || 0)} detail="Income minus expenses" tone={(totals.profitLoss || 0) >= 0 ? "green" : "red"} />
        <StatCard label="Vaccines" value={(totals.upcomingVaccinations || 0) + (totals.overdueVaccinations || 0)} detail={`${totals.overdueVaccinations || 0} overdue`} tone={(totals.overdueVaccinations || 0) > 0 ? "red" : "amber"} />
      </div>

      {data?.mortality && (
        <section className="card mt-5 p-5">
          <div className="grid gap-4 lg:grid-cols-[180px_1fr]">
            <div><div className="label">12-month mortality</div><div className="mt-2 text-3xl font-black text-farm-950">{data.mortality.rate === null ? "Not available" : `${data.mortality.rate}%`}</div><div className="mt-1 text-sm text-slate-500">{data.mortality.deaths} recorded death{data.mortality.deaths === 1 ? "" : "s"}</div></div>
            <div><div className="label">Deaths by cause</div><div className="mt-2 flex flex-wrap gap-2">{Object.entries(data.mortality.deathsByCause || {}).map(([cause, count]) => <span key={cause} className="rounded-md bg-slate-100 px-2 py-1 text-sm font-semibold text-slate-700">{cause}: {count}</span>)}{!Object.keys(data.mortality.deathsByCause || {}).length && <span className="text-sm text-slate-500">No deaths recorded in this period.</span>}</div><p className="mt-3 text-xs text-slate-500">{data.mortality.formula}. {data.mortality.note}</p></div>
          </div>
        </section>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="label">Advisory</div>
              <h2 className="mt-1 font-black text-farm-950">Smart Recommendations</h2>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-field-sage text-farm-800">
              <Bot className="h-5 w-5" />
            </span>
          </div>
          <div className="space-y-3">
            {(data?.aiRecommendations || []).slice(0, 3).map((item, index) => (
              <RecommendationCard key={`${item.type}-${index}`} item={item} />
            ))}
            {!data?.aiRecommendations?.length && <div className="text-sm text-slate-500">No recommendations yet.</div>}
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
            {(data?.recentTransactions || []).slice(0, 4).map((item) => (
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
    </div>
  );
}

function buildDailyReminders(data) {
  const totals = data?.totals || {};
  const reminders = [];
  const overdueVaccine = data?.vaccinationAlerts?.find((record) => record.status === "overdue");
  const upcomingVaccine = data?.vaccinationAlerts?.find((record) => record.status === "upcoming");
  const vetCase = data?.recentVetCases?.[0];
  const expectedBirth = data?.expectedBirths?.[0];
  const latestWeather = data?.latestWeather;

  if (latestWeather) {
    reminders.push({
      key: "weather",
      icon: CloudSun,
      priority: latestWeather.impact === "high" ? "high" : latestWeather.impact === "medium" ? "medium" : "low",
      title: `Weather: ${latestWeather.condition}`,
      detail: `${latestWeather.temperature || latestWeather.temperature === 0 ? `${latestWeather.temperature}°C` : "Temp not set"} - Rainfall ${latestWeather.rainfall || 0} mm - Impact ${latestWeather.impact}`,
      to: "/weather"
    });
  } else {
    reminders.push({
      key: "weather",
      icon: CloudSun,
      priority: "low",
      title: "Record today's weather",
      detail: "Add rainfall, temperature, and farm impact for today.",
      to: "/weather"
    });
  }

  if (totals.overdueVaccinations > 0) {
    reminders.push({
      key: "overdue-vaccines",
      icon: AlertTriangle,
      priority: "urgent",
      title: `${totals.overdueVaccinations} overdue vaccination${totals.overdueVaccinations === 1 ? "" : "s"}`,
      detail: overdueVaccine ? `${overdueVaccine.animal?.animalId || overdueVaccine.targetSummary || "Animal"} - ${overdueVaccine.vaccineName}` : "Schedule overdue doses today.",
      to: "/vaccinations"
    });
  }

  if (totals.sickAnimals > 0) {
    reminders.push({
      key: "sick-animals",
      icon: Beef,
      priority: "high",
      title: `${totals.sickAnimals} sick animal${totals.sickAnimals === 1 ? "" : "s"}`,
      detail: vetCase ? `${vetCase.animal?.animalId || "Animal"} - ${statusLabel(vetCase.healthCondition)}${vetCase.diagnosis ? `: ${vetCase.diagnosis}` : ""}` : "Review health records and current animal health status.",
      to: "/health"
    });
  }

  if (totals.upcomingVaccinations > 0) {
    reminders.push({
      key: "upcoming-vaccines",
      icon: CalendarClock,
      priority: "medium",
      title: `${totals.upcomingVaccinations} vaccine${totals.upcomingVaccinations === 1 ? "" : "s"} coming up`,
      detail: upcomingVaccine ? `${upcomingVaccine.animal?.animalId || upcomingVaccine.targetSummary || "Animal"} - due ${formatDate(upcomingVaccine.nextDueDate)}` : "Check upcoming vaccine schedule.",
      to: "/vaccinations"
    });
  }

  if (expectedBirth) {
    reminders.push({
      key: "expected-birth",
      icon: Bell,
      priority: "medium",
      title: "Expected birth coming",
      detail: `${expectedBirth.femaleAnimal?.animalId || "Animal"} expected ${formatDate(expectedBirth.expectedBirthDate)}`,
      to: "/breeding"
    });
  }

  if (totals.readyCrops > 0) {
    reminders.push({
      key: "ready-crops",
      icon: Sprout,
      priority: "low",
      title: `${totals.readyCrops} crop${totals.readyCrops === 1 ? "" : "s"} ready`,
      detail: "Check crop harvest plans and expected revenue.",
      to: "/crops"
    });
  }

  if (reminders.length === 0) {
    reminders.push({
      key: "all-clear",
      icon: Bell,
      priority: "low",
      title: "No urgent reminders today",
      detail: "Your farm records look calm. Add today's updates when ready.",
      to: "/alerts"
    });
  }

  return reminders.slice(0, 4);
}

function ReminderCard({ item }) {
  const Icon = item.icon;
  const tones = {
    urgent: "border-red-100 bg-red-50 text-red-700",
    high: "border-red-100 bg-red-50 text-red-700",
    medium: "border-amber-100 bg-amber-50 text-amber-700",
    low: "border-farm-100 bg-white text-farm-700"
  };

  return (
    <Link to={item.to} className={`flex gap-3 rounded-lg border p-4 ${tones[item.priority] || tones.low}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/70">
        <Icon className="h-5 w-5" />
      </span>
      <span>
        <span className="block font-black text-farm-950">{item.title}</span>
        <span className="mt-1 block text-sm font-semibold text-slate-600">{item.detail}</span>
      </span>
    </Link>
  );
}

function RecommendationCard({ item }) {
  return (
    <div className="rounded-lg border border-farm-100 bg-field-cream p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-black capitalize text-farm-950">{item.type}</span>
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

function statusLabel(value) { return String(value || "unknown").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
