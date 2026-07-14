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
  const schedule = canonicalSpecies(scheduleSpecies === "other" ? customSpecies : scheduleSpecies);
  return Boolean(schedule) && schedule === canonicalSpecies(targetSpecies, targetCategory);
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
  if (assignments.length && assignments.every((item) => item.completionStatus === "missed")) return "missed";
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

export const systemVaccinationTemplates = [
  { _id: "system-sheep-enterotoxaemia", system: true, scheduleName: "Sheep Enterotoxaemia", species: "sheep", vaccineName: "Enterotoxaemia", diseasePrevented: "Enterotoxaemia", recommendedStage: "Lambs from vaccinated mothers: 7 weeks, booster at 11 weeks. Confirm locally with a vet.", boosterInterval: "Annual", recurrence: "Annual", notes: "Ewes may be vaccinated 4-6 weeks before lambing on veterinary advice." },
  { _id: "system-sheep-bluetongue", system: true, scheduleName: "Sheep Blue Tongue", species: "sheep", vaccineName: "Blue Tongue", diseasePrevented: "Blue tongue", recommendedStage: "Before rains where locally recommended", recurrence: "Risk based" },
  { _id: "system-ruminant-rvf", system: true, scheduleName: "Sheep and Goat Rift Valley Fever", species: "sheep", appliesToMultipleSpecies: true, vaccineName: "Rift Valley Fever", diseasePrevented: "Rift Valley fever", recommendedStage: "Before rains where officially advised", recurrence: "Risk based" },
  { _id: "system-ruminant-orf", system: true, scheduleName: "Sheep and Goat ORF", species: "sheep", appliesToMultipleSpecies: true, vaccineName: "ORF / Contagious Ecthyma", diseasePrevented: "Contagious ecthyma", recommendedStage: "Dry season where locally indicated", recurrence: "Risk based" },
  { _id: "system-ruminant-ppr", system: true, scheduleName: "Sheep and Goat PPR", species: "goat", appliesToMultipleSpecies: true, vaccineName: "PPR", diseasePrevented: "Peste des Petits Ruminants", recommendedStage: "Follow local veterinary programme", recurrence: "Per veterinary guidance" },
  { _id: "system-ruminant-pox", system: true, scheduleName: "Sheep and Goat Pox", species: "sheep", appliesToMultipleSpecies: true, vaccineName: "Sheep and Goat Pox", diseasePrevented: "Sheep and goat pox", recommendedStage: "Follow local veterinary programme" },
  { _id: "system-ruminant-fmd", system: true, scheduleName: "Sheep and Goat Foot and Mouth", species: "goat", appliesToMultipleSpecies: true, vaccineName: "Foot and Mouth Disease", diseasePrevented: "Foot and mouth disease", recommendedStage: "Follow national control programme" },
  { _id: "system-goat-ccpp", system: true, scheduleName: "Goat CCPP", species: "goat", vaccineName: "CCPP", diseasePrevented: "Contagious caprine pleuropneumonia", recommendedStage: "Follow local veterinary programme" },
  { _id: "system-ruminant-pasteurella", system: true, scheduleName: "Sheep and Goat Pasteurella", species: "sheep", appliesToMultipleSpecies: true, vaccineName: "Pasteurella", diseasePrevented: "Pasteurellosis", recommendedStage: "Before rains where locally recommended" },
  { _id: "system-ruminant-anthrax", system: true, scheduleName: "Sheep and Goat Anthrax", species: "sheep", appliesToMultipleSpecies: true, vaccineName: "Anthrax", diseasePrevented: "Anthrax", recommendedStage: "Follow local veterinary authority advice" }
];
