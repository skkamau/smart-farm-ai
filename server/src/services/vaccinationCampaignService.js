const speciesAliases = new Map([
  ["sheep", "sheep"], ["goat", "goat"], ["goats", "goat"],
  ["cattle", "cattle"], ["cow", "cattle"], ["bull", "cattle"], ["bovine", "cattle"],
  ["poultry", "poultry"], ["chicken", "poultry"], ["broiler", "poultry"], ["layer", "poultry"],
  ["pig", "pig"], ["pigs", "pig"], ["swine", "pig"],
  ["rabbit", "rabbit"], ["rabbits", "rabbit"],
  ["fish", "fish"], ["tilapia", "fish"], ["catfish", "fish"],
  ["dog", "dog"], ["dogs", "dog"]
]);

export function canonicalSpecies(value, category = "") {
  const normalizedCategory = String(category || "").trim().toLowerCase();
  if (normalizedCategory === "poultry") return "poultry";
  if (normalizedCategory === "fish") return "fish";
  if (normalizedCategory === "rabbits") return "rabbit";
  const normalized = String(value || "").trim().toLowerCase();
  return speciesAliases.get(normalized) || normalized;
}

export function isSpeciesCompatible(scheduleSpecies, targetSpecies, targetCategory = "", customSpecies = "") {
  const supported = Array.isArray(scheduleSpecies) ? scheduleSpecies : [scheduleSpecies === "other" ? customSpecies : scheduleSpecies];
  const target = canonicalSpecies(targetSpecies, targetCategory);
  return supported.some((value) => canonicalSpecies(value === "other" ? customSpecies : value) === target);
}

export function calculateCampaignCost(input, assignments = []) {
  const base = Number(input.vaccineCost || 0) + Number(input.serviceCharge || 0) + Number(input.transportCost || 0) + Number(input.otherCost || 0);
  if (input.costMode === "per_group") return base * assignments.filter((item) => item.targetType === "group").length;
  if (input.costMode === "per_animal") {
    const units = assignments.reduce((sum, item) => sum + (item.targetType === "group" ? Number(item.quantityTreated || 0) : 1), 0);
    return base * units;
  }
  return base;
}

export function resolveCampaignStatus(campaign, now = new Date()) {
  if (campaign.status === "cancelled") return "cancelled";
  const assignments = campaign.assignments || [];
  const completed = assignments.filter((item) => item.completionStatus === "completed").length;
  if (assignments.length && completed === assignments.length) return "completed";
  if (completed > 0) return "partially_completed";
  if (assignments.length && assignments.every((item) => item.completionStatus === "missed")) return "overdue";
  const due = new Date(campaign.scheduledDate);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  if (due < today) return "overdue";
  const daysBefore = Number(campaign.reminderSettings?.daysBefore ?? 7);
  const soon = new Date(today);
  soon.setDate(soon.getDate() + daysBefore);
  return due <= soon ? "due_soon" : "scheduled";
}

// Global templates belong here. The supplied sheep/goat programme is private and
// is installed for its owner by the account-specific seed script.
export const systemVaccinationTemplates = [];
