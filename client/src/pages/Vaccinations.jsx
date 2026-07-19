import { AlertTriangle, BookOpen, Check, ChevronRight, Copy, Edit, Plus, Search, ShieldPlus, Trash2, UsersRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import CrudModal from "../components/CrudModal";
import DocumentManager from "../components/DocumentManager";
import ExportButtons from "../components/ExportButtons";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { formatDate, inputDate } from "../utils";

const speciesOptions = ["sheep", "goat", "cattle", "poultry", "pig", "rabbit", "fish", "dog", "other"];
const paymentMethods = ["Mpesa", "Bank Transfer", "Cash", "Other"];
const campaignTabs = [
  ["upcoming", "Upcoming"], ["overdue", "Overdue"], ["completed", "Completed"], ["templates", "Templates"], ["create", "Create Schedule"]
];

function blankCampaign() {
  return {
    scheduleName: "", species: "goat", supportedSpecies: ["goat"], customSpecies: "", appliesToMultipleSpecies: false,
    breedOrStrain: "", productionType: "", treatmentType: "vaccination", vaccineName: "", diseasePrevented: "",
    recommendedStage: "", firstVaccinationDate: "", dateIssued: inputDate(new Date()), scheduledDate: inputDate(new Date()), nextVaccinationDate: "", boosterDate: "",
    boosterInterval: "", recurrence: "", dose: "", doseUnit: "ml", administrationRoute: "", vetName: "", provider: "",
    batchNumber: "", expiryDate: "", vaccineCost: "", serviceCharge: "", transportCost: "", otherCost: "",
    costMode: "total", paymentMethod: "Mpesa", reminderSettings: { enabled: true, daysBefore: 7, onDueDate: true, afterDueIfIncomplete: true, boosterReminder: true, expiryReminder: true },
    assignments: [], inventorySourceTransaction: "", inventoryQuantityUsed: "", notes: "", saveAsTemplate: false
  };
}

function nextDoseCampaign(campaign) {
  return {
    ...blankCampaign(), ...campaign, _id: undefined, template: campaign.template?._id || campaign.template || "",
    previousCampaign: campaign._id, scheduleName: `${campaign.scheduleName} - next dose`, dateIssued: inputDate(new Date()), scheduledDate: "", status: "scheduled",
    assignments: campaign.assignments.map((item) => ({ targetType: item.targetType, animal: item.animal?._id || item.animal, group: item.group?._id || item.group, quantityTreated: item.quantityTreated, completionStatus: "scheduled" })),
    financeTransaction: undefined, inventoryDeductionTransaction: undefined, inventoryDeductedAt: undefined,
    vaccineCost: "", serviceCharge: "", transportCost: "", otherCost: ""
  };
}

const emptyLegacyRecord = {
  animal: "", vaccineName: "", dateGiven: inputDate(new Date()), nextDueDate: "", vetName: "", batchNumber: "",
  serviceCharge: "", vaccineCost: "", transportCost: "", otherCost: "", paymentMethod: "Mpesa", status: "completed", notes: ""
};

export default function Vaccinations() {
  const { user } = useAuth();
  const currency = useMemo(() => new Intl.NumberFormat("en", { style: "currency", currency: user?.preferences?.currency || "KES", maximumFractionDigits: 2 }), [user?.preferences?.currency]);
  const [campaigns, setCampaigns] = useState([]);
  const [legacyRecords, setLegacyRecords] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [animals, setAnimals] = useState([]);
  const [groups, setGroups] = useState([]);
  const [tab, setTab] = useState("upcoming");
  const [editing, setEditing] = useState(null);
  const [legacyEditing, setLegacyEditing] = useState(null);
  const [managing, setManaging] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [templateEditing, setTemplateEditing] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [campaignRes, legacyRes, templateRes, animalRes, groupRes] = await Promise.all([
        api.get("/vaccinations/campaigns"), api.get("/vaccinations"), api.get("/vaccinations/templates"), api.get("/animals"), api.get("/animal-groups")
      ]);
      setCampaigns(campaignRes.data);
      setLegacyRecords(legacyRes.data);
      setTemplates(templateRes.data);
      setAnimals(animalRes.data.filter((animal) => animal.lifecycleStatus === "active"));
      setGroups(groupRes.data.filter((group) => group.lifecycleStatus === "active"));
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not load vaccination schedules");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const visibleCampaigns = useMemo(() => campaigns.filter((campaign) => {
    if (tab === "upcoming") return ["scheduled", "due_soon"].includes(campaign.status);
    if (tab === "overdue") return ["overdue", "missed"].includes(campaign.status);
    if (tab === "completed") return ["completed", "partially_completed", "cancelled"].includes(campaign.status);
    return false;
  }), [campaigns, tab]);

  const visibleLegacy = useMemo(() => legacyRecords.filter((record) => {
    if (tab === "upcoming") return record.status === "upcoming";
    if (tab === "overdue") return record.status === "overdue";
    if (tab === "completed") return record.status === "completed";
    return false;
  }), [legacyRecords, tab]);
  const analytics = useMemo(() => {
    const assignments = campaigns.flatMap((campaign) => campaign.assignments || []);
    const completed = assignments.filter((assignment) => assignment.completionStatus === "completed").length;
    return {
      active: campaigns.filter((campaign) => !["completed", "cancelled"].includes(campaign.status)).length,
      overdue: campaigns.filter((campaign) => ["overdue", "missed"].includes(campaign.status)).length,
      completion: assignments.length ? Math.round((completed / assignments.length) * 100) : 0,
      cost: campaigns.reduce((sum, campaign) => sum + Number(campaign.totalCost || 0), 0)
    };
  }, [campaigns]);

  function useTemplate(template) {
    const supportedSpecies = template.supportedSpecies?.length ? template.supportedSpecies : [template.species];
    const form = { ...blankCampaign(), ...template, species: supportedSpecies[0], supportedSpecies, template: template.system ? "" : template._id, assignments: [], scheduledDate: "", saveAsTemplate: false };
    delete form._id; delete form.user; delete form.system; delete form.createdAt; delete form.updatedAt;
    setEditing(form); setTab("create");
  }

  function editCampaign(campaign) {
    setEditing({
      ...campaign,
      supportedSpecies: campaign.supportedSpecies?.length ? campaign.supportedSpecies : [campaign.species],
      firstVaccinationDate: inputDate(campaign.firstVaccinationDate), dateIssued: inputDate(campaign.dateIssued), scheduledDate: inputDate(campaign.scheduledDate),
      nextVaccinationDate: inputDate(campaign.nextVaccinationDate), boosterDate: inputDate(campaign.boosterDate), expiryDate: inputDate(campaign.expiryDate),
      inventorySourceTransaction: campaign.inventorySourceTransaction?._id || campaign.inventorySourceTransaction || "",
      assignments: campaign.assignments.map((item) => ({
        ...item, animal: item.animal?._id || item.animal || null, group: item.group?._id || item.group || null,
        completedDate: inputDate(item.completedDate)
      })), saveAsTemplate: false
    });
    setTab("create");
  }

  async function removeCampaign(campaign) {
    if (!confirm(`Delete ${campaign.scheduleName}?`)) return;
    try { await api.delete(`/vaccinations/campaigns/${campaign._id}`); toast.success("Schedule deleted"); load(); }
    catch (error) { toast.error(error.response?.data?.message || "Could not delete schedule"); }
  }

  async function cancelCampaign(campaign) {
    if (!confirm(`Cancel ${campaign.scheduleName}? Its history will remain available.`)) return;
    await api.patch(`/vaccinations/campaigns/${campaign._id}/cancel`); toast.success("Schedule cancelled"); load();
  }

  async function removeLegacy(id) {
    if (!confirm("Delete this vaccination record?")) return;
    await api.delete(`/vaccinations/${id}`); toast.success("Vaccination deleted"); load();
  }

  async function copyTemplate(template) {
    try {
      const data = templatePayload({ ...template, scheduleName: `${template.scheduleName} Copy` });
      await api.post("/vaccinations/templates", data); toast.success("Editable template copy created"); load();
    } catch (error) { toast.error(error.response?.data?.message || "Could not copy template"); }
  }

  async function removeTemplate(template) {
    if (!confirm(`Delete ${template.scheduleName}?`)) return;
    try { await api.delete(`/vaccinations/templates/${template._id}`); toast.success("Template deleted"); load(); }
    catch (error) { toast.error(error.response?.data?.message || "Could not delete template"); }
  }

  return <div className="vaccination-page">
    <PageHeader title="Vaccination & Prevention" eyebrow="Schedules, campaigns and treatment history" action={<div className="flex flex-wrap gap-2"><ExportButtons type="vaccinations" basename="vaccinations" /><button className="btn-primary" onClick={() => { setEditing(blankCampaign()); setTab("create"); }}><Plus className="h-4 w-4" /> Create schedule</button></div>} />

    <section className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
      Vaccination schedules are editable and should be confirmed with a qualified veterinarian. Recommendations vary by region, disease risk, age and vaccine manufacturer.
    </section>

    <section className="mb-5 grid gap-3 grid-cols-2 xl:grid-cols-4">
      <AnalyticsCard label="Active campaigns" value={analytics.active} />
      <AnalyticsCard label="Overdue" value={analytics.overdue} warning={analytics.overdue > 0} />
      <AnalyticsCard label="Assignment completion" value={`${analytics.completion}%`} />
      <AnalyticsCard label="Campaign cost" value={currency.format(analytics.cost)} />
    </section>

    <div className="mb-5 flex gap-1 overflow-x-auto rounded-lg border border-farm-100 bg-white p-1">
      {campaignTabs.map(([key, label]) => <button key={key} className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold ${tab === key ? "bg-farm-900 text-white" : "text-slate-600 hover:bg-farm-50"}`} onClick={() => { setTab(key); if (key === "create" && !editing) setEditing(blankCampaign()); }}>{label}{key === "overdue" && campaigns.filter((item) => ["overdue", "missed"].includes(item.status)).length > 0 ? ` (${campaigns.filter((item) => ["overdue", "missed"].includes(item.status)).length})` : ""}</button>)}
    </div>

    {loading && <div className="card p-8 text-center text-slate-500">Loading vaccination schedules...</div>}

    {!loading && ["upcoming", "overdue", "completed"].includes(tab) && <div className="space-y-4">
      {visibleCampaigns.map((campaign) => <CampaignCard key={campaign._id} campaign={campaign} currency={currency} onView={() => setViewing(campaign)} onEdit={() => editCampaign(campaign)} onManage={() => setManaging(campaign)} onNextDose={() => { const next = { ...blankCampaign(), ...campaign, _id: undefined, template: campaign.template?._id || campaign.template || "", previousCampaign: campaign._id, scheduleName: `${campaign.scheduleName} - next dose`, assignments: campaign.assignments.map((item) => ({ targetType: item.targetType, animal: item.animal?._id || item.animal, group: item.group?._id || item.group, quantityTreated: item.quantityTreated, completionStatus: "scheduled" })), status: "scheduled", financeTransaction: undefined, inventoryDeductionTransaction: undefined, inventoryDeductedAt: undefined, scheduledDate: "", vaccineCost: "", serviceCharge: "", transportCost: "", otherCost: "" }; editCampaign(next); }} onDuplicate={() => { const copy = { ...campaign, _id: undefined, scheduleName: `${campaign.scheduleName} Copy`, assignments: campaign.assignments.map((item) => ({ targetType: item.targetType, animal: item.animal?._id || item.animal, group: item.group?._id || item.group, quantityTreated: item.quantityTreated, completionStatus: "scheduled" })), status: "scheduled", financeTransaction: undefined, inventoryDeductionTransaction: undefined, inventoryDeductedAt: undefined, scheduledDate: inputDate(new Date()) }; editCampaign(copy); }} onCancel={() => cancelCampaign(campaign)} onDelete={() => removeCampaign(campaign)} />)}
      {visibleLegacy.map((record) => <LegacyCard key={record._id} record={record} onEdit={() => setLegacyEditing({ ...record, animal: record.animal?._id, dateGiven: inputDate(record.dateGiven), nextDueDate: inputDate(record.nextDueDate) })} onDelete={() => removeLegacy(record._id)} />)}
      {!visibleCampaigns.length && !visibleLegacy.length && <div className="card p-8 text-center text-sm font-semibold text-slate-500">No vaccination schedules in this view.</div>}
    </div>}

    {!loading && tab === "templates" && <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black text-farm-950">Schedule templates</h2><p className="text-sm text-slate-500">System templates are protected. Copy one to create an editable farm version.</p></div><button className="btn-primary" onClick={() => setTemplateEditing({ scheduleName: "", species: "goat", vaccineName: "", treatmentType: "vaccination" })}><Plus className="h-4 w-4" /> New template</button></div>
      <div className="grid gap-4 lg:grid-cols-2">{templates.map((template) => <TemplateCard key={template._id} template={template} onUse={() => useTemplate(template)} onCopy={() => copyTemplate(template)} onEdit={() => setTemplateEditing(template)} onDelete={() => removeTemplate(template)} />)}</div>
    </section>}

    {!loading && tab === "create" && editing && <CampaignForm record={editing} templates={templates} animals={animals} groups={groups} currency={currency} onUseTemplate={useTemplate} onCancel={() => { setEditing(null); setTab("upcoming"); }} onSaved={() => { setEditing(null); setTab("upcoming"); load(); }} />}

    {legacyEditing && <LegacyModal record={legacyEditing} animals={animals} onClose={() => setLegacyEditing(null)} onSaved={() => { setLegacyEditing(null); load(); }} />}
    {managing && <AssignmentManager campaign={managing} onClose={() => setManaging(null)} onSaved={(scheduleNext) => { const completedCampaign = managing; setManaging(null); if (scheduleNext) { setEditing(nextDoseCampaign(completedCampaign)); setTab("create"); } load(); }} />}
    {viewing && <CampaignDetails campaign={viewing} currency={currency} onClose={() => setViewing(null)} />}
    {templateEditing && <TemplateModal template={templateEditing} onClose={() => setTemplateEditing(null)} onSaved={() => { setTemplateEditing(null); load(); }} />}
  </div>;
}

function CampaignForm({ record, templates, animals, groups, currency, onCancel, onSaved }) {
  const [form, setForm] = useState(record);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(record._id);
  const totalTargets = form.assignments.length;
  const treatedQuantity = form.assignments.reduce((sum, item) => sum + (item.targetType === "group" ? Number(item.quantityTreated || 0) : 1), 0);
  const totalCost = [form.vaccineCost, form.serviceCharge, form.transportCost, form.otherCost].reduce((sum, value) => sum + Number(value || 0), 0);
  const supportedSpecies = form.supportedSpecies?.length ? form.supportedSpecies : [form.species].filter(Boolean);

  function changeSpecies(species) {
    const nextSpecies = supportedSpecies.includes(species) ? supportedSpecies.filter((item) => item !== species) : [...supportedSpecies, species];
    if (!nextSpecies.length) return toast.error("Choose at least one supported species");
    const incompatible = form.assignments.filter((assignment) => {
      const target = assignment.targetType === "individual" ? animals.find((item) => item._id === assignment.animal) : groups.find((item) => item._id === assignment.group);
      return target && !compatibleSpecies(nextSpecies, form.customSpecies, target);
    });
    if (incompatible.length) {
      if (!confirm(`${incompatible.length} selected target(s) are no longer compatible. Remove them and continue?`)) return;
      setForm({ ...form, species: nextSpecies[0], supportedSpecies: nextSpecies, appliesToMultipleSpecies: nextSpecies.length > 1, assignments: form.assignments.filter((item) => !incompatible.includes(item)) });
      return;
    }
    setForm({ ...form, species: nextSpecies[0], supportedSpecies: nextSpecies, appliesToMultipleSpecies: nextSpecies.length > 1 });
  }

  function applyTemplate(template) {
    const species = template.supportedSpecies?.length ? template.supportedSpecies : [template.species];
    setForm({ ...form, template: template.system ? "" : template._id, scheduleName: template.scheduleName, species: species[0], supportedSpecies: species, appliesToMultipleSpecies: species.length > 1, customSpecies: template.customSpecies || "", treatmentType: template.treatmentType || "vaccination", vaccineName: template.vaccineName, diseasePrevented: template.diseasePrevented || "", recommendedStage: template.recommendedStage || "", recommendedTiming: template.recommendedTiming || template.recommendedStage || "", explanation: template.explanation || "", majorSigns: template.majorSigns || "", safetyNotice: template.safetyNotice || "", dose: template.dose || "", doseUnit: template.doseUnit || "ml", administrationRoute: template.administrationRoute || "", scheduledDate: "", assignments: [] });
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.assignments.length) return toast.error("Select at least one animal or group");
    setSaving(true);
    try {
      const payload = { ...form, species: supportedSpecies[0], supportedSpecies, appliesToMultipleSpecies: supportedSpecies.length > 1, confirmMultipleSpecies: Boolean(form.confirmIncompatibleSpecies), costMode: "total", totalCost };
      delete payload.saveAsTemplate; delete payload.createdAt; delete payload.updatedAt; delete payload.__v;
      delete payload.financeTransaction; delete payload.inventoryDeductionTransaction; delete payload.inventoryDeductedAt;
      if (isEdit) await api.put(`/vaccinations/campaigns/${record._id}`, payload);
      else {
        await api.post("/vaccinations/campaigns", payload);
        if (form.saveAsTemplate) await api.post("/vaccinations/templates", templatePayload(form));
      }
      toast.success(isEdit ? "Vaccination schedule updated" : "Vaccination schedule created"); onSaved();
    } catch (error) { toast.error(error.response?.data?.message || "Could not save vaccination schedule"); }
    finally { setSaving(false); }
  }

  return <form onSubmit={submit} className="space-y-5">
    <Section title={isEdit ? "Edit vaccination schedule" : "1. Vaccination details"} description="Choose guidance or start with a blank schedule.">
      {!isEdit && <TemplatePicker templates={templates} selectedId={form.template} onSelect={applyTemplate} onBlank={() => setForm(blankCampaign())} />}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Schedule name" value={form.scheduleName} onChange={(value) => setForm({ ...form, scheduleName: value })} required />
        <Field label="Vaccine / treatment name" value={form.vaccineName} onChange={(value) => setForm({ ...form, vaccineName: value })} required />
        <Field label="Disease prevented" value={form.diseasePrevented} onChange={(value) => setForm({ ...form, diseasePrevented: value })} required />
        <fieldset className="space-y-2 sm:col-span-2"><legend className="label">Supported species</legend><div className="flex flex-wrap gap-2">{speciesOptions.map((species) => <label key={species} className={`inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-bold ${supportedSpecies.includes(species) ? "border-farm-500 bg-farm-50 text-farm-900" : "border-farm-100 text-slate-600"}`}><input type="checkbox" checked={supportedSpecies.includes(species)} onChange={() => changeSpecies(species)} />{speciesLabel(species)}</label>)}</div></fieldset>
        {supportedSpecies.includes("other") && <Field label="Custom species" value={form.customSpecies} onChange={(value) => setForm({ ...form, customSpecies: value })} required />}
      </div>
      {(form.recommendedTiming || form.explanation || form.majorSigns || form.safetyNotice) && <GuidanceCard form={form} />}
    </Section>

    <Section title="2. Animals and groups" description={`${totalTargets} selected target${totalTargets === 1 ? "" : "s"}; ${treatedQuantity.toLocaleString()} animals represented.`} action={<button type="button" className="btn-primary" onClick={() => setSelectorOpen(true)}><UsersRound className="h-4 w-4" /> Select targets</button>}>
      <SelectedTargets assignments={form.assignments} animals={animals} groups={groups} onRemove={(target) => setForm({ ...form, assignments: form.assignments.filter((item) => assignmentKey(item) !== assignmentKey(target)) })} />
    </Section>

    <Section title="3. Date and dosage" description="The scheduled date drives due-soon and overdue reminders.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date issued" type="date" value={form.dateIssued} onChange={(value) => setForm({ ...form, dateIssued: value })} />
        <Field label="Scheduled date" type="date" value={form.scheduledDate} onChange={(value) => setForm({ ...form, scheduledDate: value })} required />
        <Field label="Dose" type="number" min="0" step="any" value={form.dose} onChange={(value) => setForm({ ...form, dose: value })} />
        <Field label="Dose unit" value={form.doseUnit} onChange={(value) => setForm({ ...form, doseUnit: value })} />
        <Field label="Administration route" value={form.administrationRoute} onChange={(value) => setForm({ ...form, administrationRoute: value })} />
        <Field label="Vet name (optional)" value={form.vetName} onChange={(value) => setForm({ ...form, vetName: value })} />
      </div>
    </Section>

    <Section title="4. Costs and reminder" description="One campaign total is linked to Finance; editing updates the same transaction.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Vaccine cost" type="number" min="0" step="any" value={form.vaccineCost} onChange={(value) => setForm({ ...form, vaccineCost: value })} />
        <Field label="Service charge" type="number" min="0" step="any" value={form.serviceCharge} onChange={(value) => setForm({ ...form, serviceCharge: value })} />
        <Field label="Transport cost" type="number" min="0" step="any" value={form.transportCost} onChange={(value) => setForm({ ...form, transportCost: value })} />
        <Field label="Other cost" type="number" min="0" step="any" value={form.otherCost} onChange={(value) => setForm({ ...form, otherCost: value })} />
        <Select label="Payment method" value={form.paymentMethod} onChange={(value) => setForm({ ...form, paymentMethod: value })} options={paymentMethods} />
        <Field label="Remind days before" type="number" min="0" value={form.reminderSettings?.daysBefore ?? 7} onChange={(value) => setForm({ ...form, reminderSettings: { ...form.reminderSettings, daysBefore: Number(value) } })} />
      </div>
      <div className="mt-4 rounded-md bg-field-cream p-4 text-sm font-bold text-farm-900">Campaign total: {currency.format(totalCost)}</div>
    </Section>

    <Section title="5. Notes" description="Optional context for this campaign.">
      <label className="mt-4 block space-y-1"><span className="label">Notes</span><textarea className="input min-h-24" value={form.notes || ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
      {!isEdit && <label className="mt-4 flex items-center gap-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.saveAsTemplate} onChange={(event) => setForm({ ...form, saveAsTemplate: event.target.checked })} /> Save this as a reusable custom template</label>}
      {isEdit && hasLegacyDetails(form) && <LegacyDetails form={form} setForm={setForm} />}
    </Section>

    <div className="sticky bottom-20 flex justify-end gap-2 rounded-lg border border-farm-100 bg-white/95 p-3 shadow-soft backdrop-blur sm:bottom-2"><button type="button" className="btn-muted" onClick={onCancel}>Cancel</button><button className="btn-primary" disabled={saving}>{saving ? "Saving..." : isEdit ? "Save changes" : "Create schedule"}</button></div>
    {selectorOpen && <TargetSelector supportedSpecies={supportedSpecies} customSpecies={form.customSpecies} animals={animals} groups={groups} selected={form.assignments} onClose={() => setSelectorOpen(false)} onApply={(assignments, hasIncompatible) => { setForm({ ...form, assignments, confirmIncompatibleSpecies: hasIncompatible }); setSelectorOpen(false); }} />}
  </form>;
}

function TemplatePicker({ templates, selectedId, onSelect, onBlank }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [species, setSpecies] = useState("all");
  const selected = templates.find((template) => String(template._id) === String(selectedId));
  const visible = templates.filter((template) => {
    const supported = template.supportedSpecies?.length ? template.supportedSpecies : [template.species];
    const term = search.trim().toLowerCase();
    return (species === "all" || supported.includes(species)) && (!term || `${template.scheduleName} ${template.vaccineName} ${template.diseasePrevented}`.toLowerCase().includes(term));
  });
  return <div className="rounded-md border border-farm-100 bg-field-cream p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="label">Choose a template</div><div className="mt-1 font-bold text-farm-950">{selected?.scheduleName || "Blank schedule"}</div></div><div className="flex gap-2"><button type="button" className="btn-muted" onClick={() => { onBlank(); setOpen(false); }}>Start blank</button><button type="button" className="btn-primary" onClick={() => setOpen(!open)}><BookOpen className="h-4 w-4" /> Browse templates</button></div></div>
    {open && <div className="mt-4 space-y-3 border-t border-farm-100 pt-4"><div className="grid gap-3 sm:grid-cols-[1fr_180px]"><label className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input className="input pl-9" placeholder="Search templates" value={search} onChange={(event) => setSearch(event.target.value)} /></label><select className="input" value={species} onChange={(event) => setSpecies(event.target.value)}><option value="all">All species</option>{speciesOptions.map((item) => <option key={item} value={item}>{speciesLabel(item)}</option>)}</select></div><div className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">{visible.map((template) => <button type="button" key={template._id} onClick={() => { onSelect(template); setOpen(false); }} className="rounded-md border border-farm-100 bg-white p-3 text-left hover:border-farm-500"><div className="font-black text-farm-950">{template.scheduleName}</div><div className="mt-1 text-xs font-semibold text-slate-500">{(template.supportedSpecies?.length ? template.supportedSpecies : [template.species]).map(speciesLabel).join(", ")} · {template.diseasePrevented || "General prevention"}</div><div className="mt-2 text-sm text-slate-600">{template.recommendedTiming || template.recommendedStage || "Timing is set when scheduling."}</div></button>)}{!visible.length && <div className="p-5 text-center text-sm text-slate-500 sm:col-span-2">No templates match this search.</div>}</div></div>}
  </div>;
}

function GuidanceCard({ form }) {
  return <div className="mt-4 rounded-md border border-sky-200 bg-sky-50 p-4"><div className="flex items-center gap-2 font-black text-sky-900"><BookOpen className="h-4 w-4" /> Template guidance</div><div className="mt-3 grid gap-3 text-sm text-slate-700 sm:grid-cols-3">{(form.recommendedTiming || form.recommendedStage) && <div><div className="label">Recommended timing</div><p className="mt-1 whitespace-pre-line">{form.recommendedTiming || form.recommendedStage}</p></div>}{form.explanation && <div><div className="label">Why it matters</div><p className="mt-1">{form.explanation}</p></div>}{form.majorSigns && <div><div className="label">Major signs</div><p className="mt-1">{form.majorSigns}</p></div>}</div>{form.safetyNotice && <p className="mt-3 border-t border-sky-200 pt-3 text-xs font-semibold text-sky-900">{form.safetyNotice}</p>}</div>;
}

const legacyFields = [
  ["firstVaccinationDate", "First vaccination date", "date"], ["nextVaccinationDate", "Next vaccination date", "date"], ["boosterDate", "Booster date", "date"],
  ["boosterInterval", "Booster interval"], ["recurrence", "Recurrence"], ["provider", "Provider"], ["batchNumber", "Batch / lot number"], ["expiryDate", "Vaccine expiry date", "date"]
];
function hasLegacyDetails(form) { return legacyFields.some(([key]) => Boolean(form[key])) || Boolean(form.inventorySourceTransaction || form.inventoryQuantityUsed); }
function LegacyDetails({ form, setForm }) {
  return <details className="mt-4 rounded-md border border-farm-100 p-4"><summary className="cursor-pointer font-black text-farm-900">Additional details</summary><p className="mt-2 text-sm text-slate-500">Legacy information is retained for this older campaign.</p><div className="mt-4 grid gap-4 sm:grid-cols-2">{legacyFields.filter(([key]) => Boolean(form[key])).map(([key, label, type]) => <Field key={key} label={label} type={type} value={form[key]} onChange={(value) => setForm({ ...form, [key]: value })} />)}{form.inventorySourceTransaction && <Info label="Legacy inventory link" value="Linked to an existing inventory record" />}{form.inventoryQuantityUsed ? <Info label="Legacy inventory quantity" value={form.inventoryQuantityUsed} /> : null}</div></details>;
}

function TargetSelector({ supportedSpecies, customSpecies, animals, groups, selected, onClose, onApply }) {
  const [draft, setDraft] = useState(selected);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [speciesFilter, setSpeciesFilter] = useState("all");
  const [showIncompatible, setShowIncompatible] = useState(false);
  const targets = useMemo(() => [
    ...animals.map((item) => ({ ...item, targetType: "individual" })),
    ...groups.map((item) => ({ ...item, targetType: "group" }))
  ].filter((item) => {
    if (type !== "all" && item.targetType !== type) return false;
    if (speciesFilter !== "all" && canonical(item.species, item.category) !== speciesFilter) return false;
    if (!showIncompatible && !compatibleSpecies(supportedSpecies, customSpecies, item)) return false;
    const term = search.trim().toLowerCase();
    return !term || targetLabel(item).toLowerCase().includes(term);
  }), [animals, groups, search, type, speciesFilter, supportedSpecies, customSpecies, showIncompatible]);
  const represented = draft.reduce((sum, item) => sum + (item.targetType === "group" ? Number(item.quantityTreated || 0) : 1), 0);
  const hasIncompatible = draft.some((assignment) => {
    const target = assignment.targetType === "individual" ? animals.find((item) => item._id === assignment.animal) : groups.find((item) => item._id === assignment.group);
    return target && !compatibleSpecies(supportedSpecies, customSpecies, target);
  });

  function toggle(target) {
    const key = targetKey(target);
    if (draft.some((item) => assignmentKey(item) === key)) setDraft(draft.filter((item) => assignmentKey(item) !== key));
    else setDraft([...draft, target.targetType === "individual" ? { targetType: "individual", animal: target._id, completionStatus: "scheduled" } : { targetType: "group", group: target._id, quantityTreated: target.currentQuantity, completionStatus: "scheduled" }]);
  }
  function selectAll() {
    const existing = new Map(draft.map((item) => [assignmentKey(item), item]));
    for (const target of targets) if (!existing.has(targetKey(target))) existing.set(targetKey(target), target.targetType === "individual" ? { targetType: "individual", animal: target._id, completionStatus: "scheduled" } : { targetType: "group", group: target._id, quantityTreated: target.currentQuantity, completionStatus: "scheduled" });
    setDraft([...existing.values()]);
  }

  return <CrudModal title={`Select animals and groups (${draft.length})`} onClose={onClose}>
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3"><label className="relative sm:col-span-3 lg:col-span-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input className="input pl-9" placeholder="Search ID, name, breed or species" value={search} onChange={(event) => setSearch(event.target.value)} /></label><select className="input" value={type} onChange={(event) => setType(event.target.value)}><option value="all">Individuals & groups</option><option value="individual">Individuals only</option><option value="group">Groups only</option></select><select className="input" value={speciesFilter} onChange={(event) => setSpeciesFilter(event.target.value)}><option value="all">All supported species</option>{supportedSpecies.map((species) => <option key={species} value={canonical(species)}>{speciesLabel(species)}</option>)}</select></div>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-600"><input type="checkbox" checked={showIncompatible} onChange={(event) => setShowIncompatible(event.target.checked)} /> Show incompatible species for deliberate selection</label>
      {hasIncompatible && <div className="flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900"><AlertTriangle className="h-5 w-5 shrink-0" /><span>Your selection contains incompatible species. You will be asked to confirm before it is applied.</span></div>}
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-bold text-farm-900">{targets.length} compatible target{targets.length === 1 ? "" : "s"} shown</span><div className="flex gap-2"><button type="button" className="btn-muted" onClick={() => setDraft([])}>Clear</button><button type="button" className="btn-muted" onClick={selectAll}>Select all visible</button></div></div>
      <div className="max-h-[48vh] space-y-2 overflow-y-auto pr-1">{targets.map((target) => {
        const checked = draft.some((item) => assignmentKey(item) === targetKey(target));
        const assignment = draft.find((item) => assignmentKey(item) === targetKey(target));
        return <div key={targetKey(target)} className={`rounded-md border p-3 ${checked ? "border-farm-500 bg-farm-50" : "border-farm-100"}`}><label className="flex cursor-pointer items-start gap-3"><input type="checkbox" className="mt-1" checked={checked} onChange={() => toggle(target)} /><span className="min-w-0 flex-1"><span className="block font-black text-farm-950">{targetLabel(target)}</span><span className="mt-1 block text-xs text-slate-500">{target.targetType === "group" ? `${target.currentQuantity.toLocaleString()} animals - ${target.healthStatus}` : `${target.gender} - ${target.breed || "Breed not set"} - ${target.healthStatus}`}</span></span></label>{checked && target.targetType === "group" && <label className="mt-3 block space-y-1 pl-7"><span className="label">Quantity treated (max {target.currentQuantity})</span><input className="input" type="number" min="1" max={target.currentQuantity} value={assignment.quantityTreated} onChange={(event) => setDraft(draft.map((item) => assignmentKey(item) === targetKey(target) ? { ...item, quantityTreated: Number(event.target.value) } : item))} /></label>}</div>;
      })}{!targets.length && <div className="rounded-md border border-dashed border-farm-100 p-8 text-center text-sm text-slate-500">No compatible animals or groups match this filter.</div>}</div>
       <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-farm-100 bg-white pt-4"><span className="font-black text-farm-900">{draft.length} selected · {represented.toLocaleString()} animals</span><div className="flex gap-2"><button type="button" className="btn-muted" onClick={onClose}>Cancel</button><button type="button" className="btn-primary" onClick={() => { if (hasIncompatible && !confirm("Apply targets containing species outside this schedule?")) return; onApply(draft, hasIncompatible); }}>Apply selection</button></div></div>
    </div>
  </CrudModal>;
}

function SelectedTargets({ assignments, animals, groups, onRemove }) {
  if (!assignments.length) return <button type="button" className="w-full rounded-md border border-dashed border-farm-200 p-6 text-center text-sm font-bold text-slate-500">No animals or groups selected yet.</button>;
  return <div className="flex flex-wrap gap-2">{assignments.map((assignment) => {
    const target = assignment.targetType === "individual" ? animals.find((item) => item._id === assignment.animal) : groups.find((item) => item._id === assignment.group);
    return <span key={assignmentKey(assignment)} className="inline-flex max-w-full items-center gap-2 rounded-md bg-farm-50 px-3 py-2 text-sm font-bold text-farm-900"><span className="truncate">{target ? targetLabel({ ...target, targetType: assignment.targetType }) : "Selected target"}{assignment.targetType === "group" ? ` (${assignment.quantityTreated})` : ""}</span><button type="button" onClick={() => onRemove(assignment)} aria-label="Remove selected target"><X className="h-4 w-4" /></button></span>;
  })}</div>;
}

function CampaignCard({ campaign, currency, onView, onEdit, onManage, onNextDose, onDuplicate, onCancel, onDelete }) {
  const completed = campaign.assignments.filter((item) => item.completionStatus === "completed").length;
  const total = campaign.assignments.length;
  const progress = total ? Math.round((completed / total) * 100) : 0;
  return <article className="card p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Status value={campaign.status} /><span className="badge bg-field-sage text-farm-900">{speciesLabel(campaign.species)}</span>{campaign.treatmentType === "preventive_treatment" && <span className="badge bg-sky-50 text-sky-700">Preventive treatment</span>}</div><h2 className="mt-3 text-lg font-black text-farm-950">{campaign.scheduleName}</h2><p className="mt-1 text-sm font-semibold text-slate-600">{campaign.vaccineName}{campaign.diseasePrevented ? ` - ${campaign.diseasePrevented}` : ""}</p><div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-3"><div><span className="font-bold">Targets:</span> {total}</div><div><span className="font-bold">Due:</span> {formatDate(campaign.scheduledDate)}</div><div><span className="font-bold">Cost:</span> {currency.format(campaign.totalCost || 0)}</div></div><div className="mt-4"><div className="mb-1 flex justify-between text-xs font-bold text-slate-500"><span>{completed}/{total} completed</span><span>{progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-farm-100"><div className="h-full bg-farm-700" style={{ width: `${progress}%` }} /></div></div></div><div className="flex flex-wrap gap-2 lg:max-w-sm lg:justify-end"><button className="btn-muted" onClick={onView}>View</button><button className="btn-muted" onClick={onEdit}><Edit className="h-4 w-4" /> Edit</button><button className="btn-primary" onClick={onManage}><Check className="h-4 w-4" /> Mark administered</button><button className="btn-muted px-2" onClick={onDuplicate} aria-label="Duplicate schedule"><Copy className="h-4 w-4" /></button>{campaign.status !== "cancelled" && <button className="btn-muted" onClick={onCancel}>Cancel</button>}<button className="btn-muted px-2 text-red-700" onClick={onDelete} aria-label="Delete schedule"><Trash2 className="h-4 w-4" /></button></div></div></article>;
}

function LegacyCard({ record, onEdit, onDelete }) {
  return <article className="card border-l-4 border-l-field-soil p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Status value={record.status} /><span className="badge bg-slate-100 text-slate-600">Existing record</span></div><h2 className="mt-3 font-black text-farm-950">{record.vaccineName}</h2><p className="mt-1 text-sm text-slate-500">{record.animal?.animalId || "Unknown animal"} {record.animal?.name ? `- ${record.animal.name}` : ""}</p><p className="mt-2 text-sm text-slate-600">Given: {formatDate(record.dateGiven)} - Next due: {formatDate(record.nextDueDate)}</p></div><div className="flex gap-2"><button className="btn-muted px-2" onClick={onEdit} aria-label="Edit existing vaccination"><Edit className="h-4 w-4" /></button><button className="btn-muted px-2 text-red-700" onClick={onDelete} aria-label="Delete existing vaccination"><Trash2 className="h-4 w-4" /></button></div></div></article>;
}

function AssignmentManager({ campaign, onClose, onSaved }) {
  const [rows, setRows] = useState(campaign.assignments.map((item) => ({ assignmentId: item._id, completionStatus: item.completionStatus, completedDate: inputDate(item.completedDate), notes: item.notes || "", label: item.animal ? `${item.animal.animalId} ${item.animal.name || ""}` : `${item.group?.groupId} ${item.group?.groupName || ""}` })));
  const [saving, setSaving] = useState(false);
  function setAll(status) { setRows(rows.map((item) => ({ ...item, completionStatus: status, completedDate: status === "completed" ? inputDate(new Date()) : "" }))); }
  async function save() { setSaving(true); try { await api.patch(`/vaccinations/campaigns/${campaign._id}/assignments`, { assignments: rows }); toast.success("Completion updated"); const scheduleNext = rows.some((row) => row.completionStatus === "completed") && confirm("Schedule the next dose or booster now?"); onSaved(scheduleNext); } catch (error) { toast.error(error.response?.data?.message || "Could not update assignments"); } finally { setSaving(false); } }
  return <CrudModal title={`Manage ${campaign.scheduleName}`} onClose={onClose}><div className="space-y-4"><div className="flex flex-wrap gap-2"><button className="btn-primary" onClick={() => setAll("completed")}>All completed</button><button className="btn-muted" onClick={() => setAll("postponed")}>All postponed</button><button className="btn-muted" onClick={() => setAll("missed")}>All missed</button></div><div className="space-y-3">{rows.map((row) => <div key={row.assignmentId} className="rounded-md border border-farm-100 p-3"><div className="font-bold text-farm-950">{row.label}</div><div className="mt-3 grid gap-3 sm:grid-cols-2"><Select label="Completion" value={row.completionStatus} options={["scheduled", "completed", "postponed", "missed"]} onChange={(value) => setRows(rows.map((item) => item.assignmentId === row.assignmentId ? { ...item, completionStatus: value, completedDate: value === "completed" ? item.completedDate || inputDate(new Date()) : "" } : item))} /><Field label="Completed date" type="date" value={row.completedDate} onChange={(value) => setRows(rows.map((item) => item.assignmentId === row.assignmentId ? { ...item, completedDate: value } : item))} /></div></div>)}</div><div className="flex justify-end gap-2"><button className="btn-muted" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save completion"}</button></div></div></CrudModal>;
}

function CampaignDetails({ campaign, currency, onClose }) {
  return <CrudModal title={campaign.scheduleName} onClose={onClose}>
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Info label="Species" value={(campaign.supportedSpecies?.length ? campaign.supportedSpecies : [campaign.species]).map(speciesLabel).join(", ")} />
        <Info label="Vaccine / treatment" value={campaign.vaccineName} />
        <Info label="Disease prevented" value={campaign.diseasePrevented || "Not set"} />
        <Info label="Date issued" value={formatDate(campaign.dateIssued)} />
        <Info label="Scheduled date" value={formatDate(campaign.scheduledDate)} />
        <Info label="Dose" value={`${campaign.dose || 0} ${campaign.doseUnit || ""}`} />
        <Info label="Route" value={campaign.administrationRoute || "Not set"} />
        <Info label="Vet / provider" value={campaign.vetName || campaign.provider || "Not set"} />
        <Info label="Batch" value={campaign.batchNumber || "Not set"} />
        <Info label="Campaign cost" value={currency.format(campaign.totalCost || 0)} />
        <Info label="Inventory" value={campaign.inventoryDeductedAt ? `Deducted ${campaign.inventoryQuantityUsed}` : campaign.inventorySourceTransaction ? "Linked; deducts after completion" : "Not linked"} />
      </div>
      <div><div className="label">Assignments</div><div className="mt-2 space-y-2">{campaign.assignments.map((item) => <div key={item._id} className="flex items-center justify-between gap-3 rounded-md bg-field-cream p-3 text-sm"><span className="font-bold text-farm-950">{item.animal ? `${item.animal.animalId} ${item.animal.name || ""}` : `${item.group?.groupId} ${item.group?.groupName || ""} (${item.quantityTreated})`}</span><Status value={item.completionStatus} /></div>)}</div></div>
      {campaign.notes && <p className="rounded-md bg-farm-50 p-4 text-sm text-slate-700">{campaign.notes}</p>}
    </div>
  </CrudModal>;
}

function TemplateCard({ template, onUse, onCopy, onEdit, onDelete }) {
  return <article className="card p-5"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap gap-2"><span className="badge bg-field-sage text-farm-900">{speciesLabel(template.species)}</span><span className={`badge ${template.system ? "bg-slate-100 text-slate-600" : "bg-farm-50 text-farm-700"}`}>{template.system ? "System" : "Custom"}</span></div><h3 className="mt-3 font-black text-farm-950">{template.scheduleName}</h3><p className="mt-1 text-sm text-slate-600">{template.vaccineName}</p>{template.recommendedStage && <p className="mt-3 text-sm text-slate-500">{template.recommendedStage}</p>}</div><ShieldPlus className="h-5 w-5 text-farm-700" /></div><div className="mt-4 flex flex-wrap gap-2"><button className="btn-primary" onClick={onUse}>Use template <ChevronRight className="h-4 w-4" /></button><button className="btn-muted" onClick={onCopy}><Copy className="h-4 w-4" /> Copy</button>{!template.system && <><button className="btn-muted px-2" onClick={onEdit} aria-label="Edit template"><Edit className="h-4 w-4" /></button><button className="btn-muted px-2 text-red-700" onClick={onDelete} aria-label="Delete template"><Trash2 className="h-4 w-4" /></button></>}</div></article>;
}

function TemplateModal({ template, onClose, onSaved }) {
  const [form, setForm] = useState(template);
  const editing = Boolean(template._id);
  async function submit(event) { event.preventDefault(); try { const data = templatePayload(form); if (editing) await api.put(`/vaccinations/templates/${template._id}`, data); else await api.post("/vaccinations/templates", data); toast.success(editing ? "Template updated" : "Template created"); onSaved(); } catch (error) { toast.error(error.response?.data?.message || "Could not save template"); } }
  return <CrudModal title={editing ? "Edit custom template" : "Create custom template"} onClose={onClose}><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2"><Field label="Schedule name" value={form.scheduleName} onChange={(value) => setForm({ ...form, scheduleName: value })} required /><Select label="Species" value={form.species} onChange={(value) => setForm({ ...form, species: value })} options={speciesOptions} />{form.species === "other" && <Field label="Custom species" value={form.customSpecies || ""} onChange={(value) => setForm({ ...form, customSpecies: value })} required />}<Field label="Vaccine / treatment" value={form.vaccineName} onChange={(value) => setForm({ ...form, vaccineName: value })} required /><Select label="Type" value={form.treatmentType || "vaccination"} onChange={(value) => setForm({ ...form, treatmentType: value })} options={["vaccination", "preventive_treatment"]} /><Field label="Disease prevented" value={form.diseasePrevented || ""} onChange={(value) => setForm({ ...form, diseasePrevented: value })} /><Field label="Recommended stage" value={form.recommendedStage || ""} onChange={(value) => setForm({ ...form, recommendedStage: value })} /><Field label="Dose" type="number" min="0" value={form.dose || ""} onChange={(value) => setForm({ ...form, dose: value })} /><Field label="Dose unit" value={form.doseUnit || "ml"} onChange={(value) => setForm({ ...form, doseUnit: value })} /><label className="space-y-1 sm:col-span-2"><span className="label">Notes</span><textarea className="input min-h-20" value={form.notes || ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="btn-muted" onClick={onClose}>Cancel</button><button className="btn-primary">Save template</button></div></form></CrudModal>;
}

function LegacyModal({ record, animals, onClose, onSaved }) {
  const [form, setForm] = useState(record);
  const totalCost = Number(form.serviceCharge || 0) + Number(form.vaccineCost || 0) + Number(form.transportCost || 0) + Number(form.otherCost || 0);
  async function submit(event) { event.preventDefault(); try { const payload = { ...form, totalCost }; if (record._id) await api.put(`/vaccinations/${record._id}`, payload); else await api.post("/vaccinations", payload); toast.success("Existing vaccination saved"); onSaved(); } catch (error) { toast.error(error.response?.data?.message || "Could not save vaccination"); } }
  return <CrudModal title={record._id ? "Edit existing vaccination" : "Add existing vaccination"} onClose={onClose}><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2"><label className="space-y-1"><span className="label">Animal</span><select className="input" value={form.animal || ""} onChange={(event) => setForm({ ...form, animal: event.target.value })} required><option value="">Select animal</option>{animals.map((animal) => <option value={animal._id} key={animal._id}>{animal.animalId} - {animal.name || animal.species}</option>)}</select></label><Field label="Vaccine name" value={form.vaccineName} onChange={(value) => setForm({ ...form, vaccineName: value })} required /><Field label="Date given" type="date" value={form.dateGiven} onChange={(value) => setForm({ ...form, dateGiven: value })} /><Field label="Next due date" type="date" value={form.nextDueDate} onChange={(value) => setForm({ ...form, nextDueDate: value })} /><Field label="Vet name" value={form.vetName || ""} onChange={(value) => setForm({ ...form, vetName: value })} /><Field label="Batch number" value={form.batchNumber || ""} onChange={(value) => setForm({ ...form, batchNumber: value })} /><Field label="Service charge" type="number" min="0" value={form.serviceCharge || ""} onChange={(value) => setForm({ ...form, serviceCharge: value })} /><Field label="Vaccine cost" type="number" min="0" value={form.vaccineCost || ""} onChange={(value) => setForm({ ...form, vaccineCost: value })} /><Field label="Transport cost" type="number" min="0" value={form.transportCost || ""} onChange={(value) => setForm({ ...form, transportCost: value })} /><Field label="Other cost" type="number" min="0" value={form.otherCost || ""} onChange={(value) => setForm({ ...form, otherCost: value })} /><Select label="Payment method" value={form.paymentMethod || "Mpesa"} onChange={(value) => setForm({ ...form, paymentMethod: value })} options={paymentMethods} /><Select label="Status" value={form.status} onChange={(value) => setForm({ ...form, status: value })} options={["completed", "upcoming", "overdue"]} /><div className="rounded-md bg-field-cream p-3 text-sm font-bold text-farm-900 sm:col-span-2">Total: {currency.format(totalCost)}</div><label className="space-y-1 sm:col-span-2"><span className="label">Notes</span><textarea className="input min-h-20" value={form.notes || ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>{record._id && <div className="sm:col-span-2"><DocumentManager entityType="vaccination" entityId={record._id} /></div>}<div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="btn-muted" onClick={onClose}>Cancel</button><button className="btn-primary">Save vaccination</button></div></form></CrudModal>;
}

export function VaccineStatus({ value }) { return <Status value={value} />; }
function Status({ value }) { const tone = value === "overdue" || value === "missed" ? "bg-red-50 text-red-700" : value === "upcoming" || value === "scheduled" || value === "due_soon" || value === "postponed" ? "bg-amber-50 text-amber-700" : value === "cancelled" ? "bg-slate-100 text-slate-600" : "bg-farm-50 text-farm-700"; return <span className={`badge ${tone}`}>{speciesLabel(value)}</span>; }
function AnalyticsCard({ label, value, warning }) { return <div className={`card p-4 ${warning ? "border-red-200" : ""}`}><div className="label">{label}</div><div className={`mt-2 text-xl font-black ${warning ? "text-red-700" : "text-farm-950"}`}>{value}</div></div>; }
function Section({ title, description, action, children }) { return <section className="card p-5"><div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-black text-farm-950">{title}</h2>{description && <p className="mt-1 text-sm text-slate-500">{description}</p>}</div>{action}</div>{children}</section>; }
function Info({ label, value }) { return <div className="rounded-md border border-farm-100 p-3"><div className="label">{label}</div><div className="mt-1 font-semibold text-slate-700">{value}</div></div>; }
function Field({ label, value, onChange, type = "text", required, min, max, step }) { return <label className="space-y-1"><span className="label">{label}</span><input className="input" type={type} min={min} max={max} step={step} value={value ?? ""} required={required} onChange={(event) => onChange(event.target.value)} /></label>; }
function Select({ label, value, onChange, options }) { return <label className="space-y-1"><span className="label">{label}</span><select className="input" value={value ?? ""} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option value={option} key={option}>{speciesLabel(option)}</option>)}</select></label>; }
function speciesLabel(value) { return String(value || "unknown").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function canonical(value, category = "") { const aliases = { chicken: "poultry", broiler: "poultry", layer: "poultry", rabbits: "rabbit", tilapia: "fish", catfish: "fish", cow: "cattle", bull: "cattle", goats: "goat", pigs: "pig" }; if (["poultry", "fish", "rabbits"].includes(String(category).toLowerCase())) return category === "rabbits" ? "rabbit" : category; const normalized = String(value || "").trim().toLowerCase(); return aliases[normalized] || normalized; }
function compatibleSpecies(species, customSpecies, target) { const supported = Array.isArray(species) ? species : [species]; return supported.some((item) => canonical(item === "other" ? customSpecies : item) === canonical(target.species, target.category)); }
function targetLabel(target) { return target.targetType === "group" ? `${target.groupId} - ${target.groupName || target.species}` : `${target.animalId} - ${target.name || target.species} - ${target.species}`; }
function targetKey(target) { return `${target.targetType}:${target._id}`; }
function assignmentKey(item) { return `${item.targetType}:${item.targetType === "individual" ? item.animal?._id || item.animal : item.group?._id || item.group}`; }
function templatePayload(source) { const supportedSpecies = source.supportedSpecies?.length ? source.supportedSpecies : [source.species]; return { scheduleName: source.scheduleName, species: supportedSpecies[0], supportedSpecies, customSpecies: source.customSpecies || "", breedOrStrain: source.breedOrStrain || "", productionType: source.productionType || "", treatmentType: source.treatmentType || "vaccination", vaccineName: source.vaccineName, diseasePrevented: source.diseasePrevented || "", recommendedStage: source.recommendedStage || "", recommendedTiming: source.recommendedTiming || source.recommendedStage || "", explanation: source.explanation || "", majorSigns: source.majorSigns || "", safetyNotice: source.safetyNotice || "", boosterInterval: source.boosterInterval || "", recurrence: source.recurrence || "", dose: Number(source.dose || 0), doseUnit: source.doseUnit || "ml", administrationRoute: source.administrationRoute || "", notes: source.notes || "" }; }
function latestInventory(records) { const seen = new Set(); return records.filter((record) => ["Feed", "Fuel", "Consumables"].includes(record.financeSection) && record.item).sort((a, b) => new Date(b.transactionDate || b.createdAt) - new Date(a.transactionDate || a.createdAt)).filter((record) => { const key = `${record.financeSection}:${record.item.toLowerCase()}`; if (seen.has(key)) return false; seen.add(key); return Number(record.balance || 0) > 0; }); }
