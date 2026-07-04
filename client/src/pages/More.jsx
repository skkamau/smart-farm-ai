import { Bell, Bot, CloudSun, QrCode, ReceiptText } from "lucide-react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";

const moreItems = [
  { to: "/assistant", label: "Assistant", description: "Ask farm questions", icon: Bot },
  { to: "/alerts", label: "Alerts", description: "Notifications and priorities", icon: Bell },
  { to: "/scan", label: "Scan QR", description: "Open animal profiles by QR", icon: QrCode },
  { to: "/weather", label: "Weather", description: "Daily farm conditions", icon: CloudSun },
  { to: "/finance", label: "Finance", description: "Income, expenses, profit", icon: ReceiptText }
];

export default function More() {
  return (
    <div>
      <PageHeader title="More" eyebrow="Farm tools" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {moreItems.map((item) => (
          <Link key={item.to} to={item.to} className="card flex items-center gap-4 p-5 transition hover:-translate-y-0.5 hover:shadow-lift">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-field-sage text-farm-800">
              <item.icon className="h-6 w-6" />
            </span>
            <span>
              <span className="block font-black text-farm-950">{item.label}</span>
              <span className="mt-1 block text-sm text-slate-500">{item.description}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
