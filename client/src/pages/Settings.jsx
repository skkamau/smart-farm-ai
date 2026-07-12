import { Bell, Check, Mail, Moon, Phone, Save, Sun, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import BrandLogo from "../components/BrandLogo";

const themes = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Check }
];

const farmTypes = [
  { value: "mixed", label: "Mixed farm" },
  { value: "livestock", label: "Livestock" },
  { value: "crops", label: "Crops" },
  { value: "other", label: "Other" }
];

const currencies = ["KES", "USD", "EUR", "GBP", "UGX", "TZS"];

function initialForm(user) {
  return {
    name: user?.name || "",
    farmName: user?.farmName || "",
    farmLocation: user?.farmLocation || "",
    farmType: user?.farmType || "mixed",
    mainActivities: user?.mainActivities || "",
    email: user?.email || "",
    phone: user?.phone || "",
    preferences: {
      theme: user?.preferences?.theme || "system",
      currency: user?.preferences?.currency || "KES",
      units: user?.preferences?.units || "metric",
      notifications: {
        inventoryAlerts: user?.preferences?.notifications?.inventoryAlerts ?? true,
        animalHealthReminders: user?.preferences?.notifications?.animalHealthReminders ?? true,
        cropReminders: user?.preferences?.notifications?.cropReminders ?? true
      }
    }
  };
}

function Toggle({ checked, label, description, onChange }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-lg border border-farm-100 bg-white/70 p-3 dark:border-farm-800 dark:bg-farm-900/70">
      <span>
        <span className="block text-sm font-black text-farm-950 dark:text-white">{label}</span>
        <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-300">{description}</span>
      </span>
      <input className="h-5 w-5 accent-farm-800" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

export default function Settings() {
  const { user, updateProfile, applyTheme } = useAuth();
  const [form, setForm] = useState(() => initialForm(user));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const previewName = useMemo(() => form.farmName || "Your farm", [form.farmName]);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  }

  function setPreference(field, value) {
    setForm((current) => ({
      ...current,
      preferences: { ...current.preferences, [field]: value }
    }));
    if (field === "theme") applyTheme(value);
  }

  function setNotification(field, value) {
    setForm((current) => ({
      ...current,
      preferences: {
        ...current.preferences,
        notifications: { ...current.preferences.notifications, [field]: value }
      }
    }));
  }

  function validate() {
    const next = {};
    if (!form.farmName.trim()) next.farmName = "Farm name is required";
    if (!form.name.trim()) next.name = "Owner name is required";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Enter a valid email address";
    setErrors(next);
    return !Object.keys(next).length;
  }

  async function save(event) {
    event.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await updateProfile(form);
      toast.success("Profile and settings saved");
    } catch (error) {
      const message = error.response?.data?.message || "Could not save settings";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <PageHeader
        eyebrow="Profile & Settings"
        title={previewName}
        action={
          <div className="flex items-center gap-3"><BrandLogo size="small" iconOnly /><button className="btn-primary" disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save"}
          </button></div>
        }
      />

      <section className="card p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-field-sage text-farm-800 dark:bg-farm-800 dark:text-field-sage">
            <UserRound className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-black text-farm-950 dark:text-white">Farm Profile</h2>
            <p className="text-sm text-slate-500 dark:text-slate-300">Keep the basic farm details accurate for reports and reminders.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label>
            <span className="label">Farm name</span>
            <input className="input mt-1" value={form.farmName} onChange={(event) => setField("farmName", event.target.value)} />
            {errors.farmName && <span className="mt-1 block text-xs font-bold text-field-danger">{errors.farmName}</span>}
          </label>
          <label>
            <span className="label">Farm location</span>
            <input className="input mt-1" value={form.farmLocation} onChange={(event) => setField("farmLocation", event.target.value)} placeholder="Subukia, Nakuru" />
          </label>
          <label>
            <span className="label">Farm type</span>
            <select className="input mt-1" value={form.farmType} onChange={(event) => setField("farmType", event.target.value)}>
              {farmTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label>
            <span className="label">Main animals/crops</span>
            <input className="input mt-1" value={form.mainActivities} onChange={(event) => setField("mainActivities", event.target.value)} placeholder="Goats, sheep, maize, napier" />
          </label>
          <label>
            <span className="label">Owner name</span>
            <input className="input mt-1" value={form.name} onChange={(event) => setField("name", event.target.value)} />
            {errors.name && <span className="mt-1 block text-xs font-bold text-field-danger">{errors.name}</span>}
          </label>
          <label>
            <span className="label">Contact email</span>
            <div className="relative mt-1">
              <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input className="input pl-9" value={form.email} onChange={(event) => setField("email", event.target.value)} />
            </div>
            {errors.email && <span className="mt-1 block text-xs font-bold text-field-danger">{errors.email}</span>}
          </label>
          <label className="md:col-span-2">
            <span className="label">Phone number</span>
            <div className="relative mt-1">
              <Phone className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input className="input pl-9" value={form.phone} onChange={(event) => setField("phone", event.target.value)} placeholder="+254..." />
            </div>
          </label>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="card p-4 sm:p-5">
          <h2 className="font-black text-farm-950 dark:text-white">Appearance</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Choose the display mode that feels comfortable in the field or office.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {themes.map((item) => {
              const active = form.preferences.theme === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setPreference("theme", item.value)}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-black transition ${active ? "border-farm-800 bg-field-sage text-farm-950 dark:bg-farm-800 dark:text-white" : "border-farm-100 bg-white text-slate-500 hover:bg-field-mist dark:border-farm-800 dark:bg-farm-900 dark:text-slate-200"}`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="card p-4 sm:p-5">
          <h2 className="font-black text-farm-950 dark:text-white">Preferences</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Defaults used across reports, finance, inventory, and reminders.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label>
              <span className="label">Default currency</span>
              <select className="input mt-1" value={form.preferences.currency} onChange={(event) => setPreference("currency", event.target.value)}>
                {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
              </select>
            </label>
            <label>
              <span className="label">Measurement units</span>
              <select className="input mt-1" value={form.preferences.units} onChange={(event) => setPreference("units", event.target.value)}>
                <option value="metric">Metric: kg, litres, bags</option>
                <option value="imperial">Imperial</option>
                <option value="mixed">Mixed</option>
              </select>
            </label>
          </div>
        </div>
      </section>

      <section className="card p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-field-sage text-farm-800 dark:bg-farm-800 dark:text-field-sage">
            <Bell className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-black text-farm-950 dark:text-white">Notification Preferences</h2>
            <p className="text-sm text-slate-500 dark:text-slate-300">Pick which daily reminders should stay visible in the app.</p>
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <Toggle checked={form.preferences.notifications.inventoryAlerts} label="Inventory alerts" description="Low stock feed, medicine, fuel and supplies" onChange={(value) => setNotification("inventoryAlerts", value)} />
          <Toggle checked={form.preferences.notifications.animalHealthReminders} label="Animal health reminders" description="Vaccines, vet follow-ups and sick animals" onChange={(value) => setNotification("animalHealthReminders", value)} />
          <Toggle checked={form.preferences.notifications.cropReminders} label="Crop reminders" description="Harvest, spraying, irrigation and crop tasks" onChange={(value) => setNotification("cropReminders", value)} />
        </div>
      </section>
    </form>
  );
}
