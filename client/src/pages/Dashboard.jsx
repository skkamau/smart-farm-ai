import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Beef, Bot, CalendarClock, HeartPulse, Plus, QrCode, Sprout, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import api from "../services/api";
import { currency, formatDate } from "../utils";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    api
      .get("/dashboard")
      .then(({ data }) => setData(data))
      .catch(() => toast.error("Could not load dashboard"));
  }, []);

  const totals = data?.totals || {};
  const firstName = user?.name?.split(" ")[0] || "Farmer";
  const overdue = totals.overdueVaccinations || 0;
  const firstOverdue = data?.vaccinationAlerts?.find((record) => record.status === "overdue");

  return (
    <div className="space-y-7">
      <header className="pt-1">
        <p className="text-base font-bold text-field-soil">Good morning,</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-farm-950">{firstName}</h1>
      </header>

      {(overdue > 0 || firstOverdue) && (
        <section className="rounded-[1.7rem] border border-red-100 bg-red-50/90 p-5 shadow-soft">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
              <AlertTriangle className="h-7 w-7" />
            </span>
            <div>
              <h2 className="text-lg font-black text-red-800">{overdue || 1} vaccine overdue!</h2>
              <p className="mt-1 text-sm font-bold text-red-600">
                {firstOverdue?.animal?.name || firstOverdue?.animal?.animalId || "Animal"} - {firstOverdue?.vaccineName || "Vaccination"} needs attention
              </p>
            </div>
          </div>
        </section>
      )}

      <section>
        <SectionTitle>Farm Overview</SectionTitle>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <OverviewCard icon={Beef} label="Total Animals" value={totals.animals ?? "..."} tone="mint" />
          <OverviewCard icon={Sprout} label="Total Crops" value={totals.crops ?? "..."} tone="mint" />
          <OverviewCard icon={HeartPulse} label="Sick Animals" value={totals.sickAnimals || 0} detail="Needs attention" tone="rose" />
          <OverviewCard icon={CalendarClock} label="Due Vaccines" value={(totals.upcomingVaccinations || 0) + overdue} detail={`${overdue} overdue`} tone="lavender" />
          <OverviewCard icon={Beef} label="Pregnant" value={totals.pregnantAnimals || 0} detail="animals" tone="amber" />
          <OverviewCard icon={ArrowUpCircle} label="Monthly Income" value={compactMoney(totals.income || 0)} detail="Current records" tone="mint" />
          <OverviewCard icon={ArrowDownCircle} label="Monthly Expenses" value={compactMoney(totals.expenses || 0)} detail="Current records" tone="rose" />
          <OverviewCard icon={WalletCards} label="Profit" value={compactMoney(totals.profitLoss || 0)} detail={(totals.profitLoss || 0) >= 0 ? "Positive" : "Loss"} tone="gold" />
        </div>
      </section>

      <section>
        <SectionTitle>Quick Actions</SectionTitle>
        <div className="mt-4 grid grid-cols-4 gap-3">
          <QuickAction to="/animals" icon={Beef} label="Add Animal" />
          <QuickAction to="/scan" icon={QrCode} label="Scan QR" />
          <QuickAction to="/crops" icon={Sprout} label="Add Crop" />
          <QuickAction to="/finance" icon={Plus} label="Expense" />
        </div>
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between">
          <SectionTitle flush>AI Recommendations</SectionTitle>
          <Link className="rounded-full bg-farm-100 px-3 py-1.5 text-xs font-black text-farm-700" to="/assistant">
            Chat AI
          </Link>
        </div>
        <div className="mt-4 space-y-3">
          {(data?.aiRecommendations || []).slice(0, 4).map((item, index) => (
            <RecommendationCard key={`${item.type}-${index}`} item={item} />
          ))}
          {!data?.aiRecommendations?.length && <div className="text-sm font-semibold text-field-soil">No recommendations yet.</div>}
        </div>
      </section>

      <section className="card p-5">
        <SectionTitle flush>Recent Activity</SectionTitle>
        <div className="mt-4 space-y-3">
          {(data?.recentVetCases || []).slice(0, 2).map((record) => (
            <ActivityItem key={record._id} icon={HeartPulse} title="Health record added" detail={`${record.animal?.animalId || "Animal"} - ${record.condition}`} meta={formatDate(record.recordDate)} />
          ))}
          {(data?.recentTransactions || []).slice(0, 3).map((item) => (
            <ActivityItem key={item._id} icon={item.type === "income" ? ArrowUpCircle : ArrowDownCircle} title={`${item.type === "income" ? "Income" : "Expense"} recorded`} detail={`${item.description} - ${currency.format(item.amount)}`} meta={formatDate(item.transactionDate)} />
          ))}
          {!data?.recentTransactions?.length && !data?.recentVetCases?.length && <div className="text-sm font-semibold text-field-soil">No recent activity yet.</div>}
        </div>
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between">
          <SectionTitle flush>Income vs Expenses</SectionTitle>
          <Link className="text-xs font-black text-farm-700" to="/reports">
            Full Report
          </Link>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <FinanceChip label="Income" value={compactMoney(totals.income || 0)} />
          <FinanceChip label="Expenses" value={compactMoney(totals.expenses || 0)} />
          <FinanceChip label="Profit" value={compactMoney(totals.profitLoss || 0)} />
        </div>
        <MiniChart income={totals.income || 0} expenses={totals.expenses || 0} />
      </section>
    </div>
  );
}

function SectionTitle({ children, flush = false }) {
  return <h2 className={`${flush ? "" : ""} text-sm font-black uppercase tracking-[0.22em] text-field-soil`}>{children}</h2>;
}

function OverviewCard({ icon: Icon, label, value, detail, tone }) {
  const tones = {
    mint: "bg-emerald-50 text-farm-700",
    rose: "bg-red-50 text-red-600",
    lavender: "bg-violet-50 text-violet-600",
    amber: "bg-amber-50 text-amber-600",
    gold: "bg-yellow-50 text-yellow-700"
  };

  return (
    <div className="card min-h-[150px] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-black uppercase leading-5 tracking-wide text-field-soil">{label}</div>
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${tones[tone] || tones.mint}`}>
          <Icon className="h-6 w-6" />
        </span>
      </div>
      <div className="mt-8 text-4xl font-black leading-none text-farm-950">{value}</div>
      {detail && <div className="mt-3 text-sm font-semibold text-field-soil">{detail}</div>}
    </div>
  );
}

function QuickAction({ to, icon: Icon, label }) {
  return (
    <Link to={to} className="flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-[1.4rem] bg-white p-3 text-center text-xs font-black text-farm-700 shadow-soft">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-farm-100">
        <Icon className="h-5 w-5" />
      </span>
      {label}
    </Link>
  );
}

function RecommendationCard({ item }) {
  const colors = {
    urgent: "bg-red-50 text-red-700",
    high: "bg-orange-50 text-orange-700",
    medium: "bg-yellow-50 text-yellow-700",
    low: "bg-blue-50 text-blue-700"
  };

  return (
    <div className="flex gap-3 rounded-2xl bg-farm-50 p-3">
      <span className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${colors[item.priority] || colors.low}`}>
        <Bot className="h-4 w-4" />
      </span>
      <div>
        <div className="text-sm font-black text-farm-950">{item.message}</div>
        <div className="mt-1 text-xs font-semibold text-field-soil">{item.suggestedAction}</div>
      </div>
    </div>
  );
}

function ActivityItem({ icon: Icon, title, detail, meta }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-farm-100 text-farm-700">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-black text-farm-950">{title}</div>
        <div className="truncate text-sm font-semibold text-field-soil">{detail}</div>
      </div>
      <div className="text-xs font-bold text-field-soil">{meta}</div>
    </div>
  );
}

function FinanceChip({ label, value }) {
  return (
    <div className="rounded-2xl bg-farm-50 p-3">
      <div className="text-[11px] font-black uppercase tracking-wide text-field-soil">{label}</div>
      <div className="mt-1 text-sm font-black text-farm-950">{value}</div>
    </div>
  );
}

function MiniChart({ income, expenses }) {
  const max = Math.max(income, expenses, 1);
  const incomeHeight = Math.max(18, (income / max) * 88);
  const expenseHeight = Math.max(18, (expenses / max) * 88);

  return (
    <div className="mt-6 flex h-28 items-end justify-around rounded-2xl bg-farm-50 px-5 pb-4">
      {["Feb", "Mar", "Apr", "May", "Jun", "Jul"].map((month, index) => (
        <div key={month} className="flex flex-col items-center gap-2">
          <div className="flex h-24 items-end gap-1">
            <span className="w-2 rounded-full bg-farm-700" style={{ height: `${Math.max(16, incomeHeight - index * 6)}px` }} />
            <span className="w-2 rounded-full bg-field-soil/40" style={{ height: `${Math.max(14, expenseHeight - index * 4)}px` }} />
          </div>
          <span className="text-[10px] font-bold text-field-soil">{month}</span>
        </div>
      ))}
    </div>
  );
}

function compactMoney(value) {
  if (Math.abs(value) >= 1000) return `KES ${Math.round(value / 1000)}K`;
  return `KES ${value}`;
}
