import Animal from "../models/Animal.js";
import BreedingRecord from "../models/BreedingRecord.js";
import Crop from "../models/Crop.js";
import HealthRecord from "../models/HealthRecord.js";
import Transaction from "../models/Transaction.js";
import VaccinationRecord from "../models/VaccinationRecord.js";
import { normalizeVaccination } from "../utils/vaccinations.js";

const DAY = 24 * 60 * 60 * 1000;

function daysUntil(date) {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / DAY);
}

function makeItem({ type, priority = "medium", related = null, message, suggestedAction }) {
  return {
    type,
    priority,
    related,
    message,
    suggestedAction,
    dateCreated: new Date().toISOString()
  };
}

async function farmSnapshot(user) {
  const [animals, crops, healthRecords, vaccinations, breedingRecords, transactions] = await Promise.all([
    Animal.find({ user }).lean(),
    Crop.find({ user }).lean(),
    HealthRecord.find({ user }).populate("animal", "animalId name species status").sort({ recordDate: -1 }).lean(),
    VaccinationRecord.find({ user }).populate("animal", "animalId name species status").sort({ nextDueDate: 1 }),
    BreedingRecord.find({ user }).populate("femaleAnimal", "animalId name species status").populate("maleAnimal", "animalId name species status").sort({ expectedBirthDate: 1 }).lean(),
    Transaction.find({ user }).sort({ transactionDate: -1 }).lean()
  ]);
  const normalizedVaccinations = await Promise.all(vaccinations.map((record) => normalizeVaccination(record)));
  return { animals, crops, healthRecords, vaccinations: normalizedVaccinations.map((record) => record.toObject()), breedingRecords, transactions };
}

function financialSummary(transactions) {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const currentMonth = transactions.filter((item) => {
    const date = new Date(item.transactionDate);
    return date.getMonth() === month && date.getFullYear() === year;
  });
  const income = currentMonth.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const expenses = currentMonth.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  const byCategory = currentMonth
    .filter((item) => item.type === "expense")
    .reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + item.amount;
      return acc;
    }, {});
  return { income, expenses, profit: income - expenses, byCategory };
}

export async function generateFarmIntelligence(user) {
  const snapshot = await farmSnapshot(user);
  const items = [];
  const { animals, crops, healthRecords, vaccinations, breedingRecords, transactions } = snapshot;
  const finance = financialSummary(transactions);

  const overdueVaccines = vaccinations.filter((record) => record.status === "overdue");
  if (overdueVaccines.length) {
    items.push(makeItem({
      type: "vaccination",
      priority: "urgent",
      related: { kind: "vaccination", count: overdueVaccines.length },
      message: `${overdueVaccines.length} animal${overdueVaccines.length === 1 ? " has" : "s have"} overdue vaccinations`,
      suggestedAction: "Open Vaccinations and schedule the overdue doses today."
    }));
  }

  const upcomingVaccines = vaccinations.filter((record) => record.status === "upcoming" && daysUntil(record.nextDueDate) <= 14);
  if (upcomingVaccines.length) {
    items.push(makeItem({
      type: "vaccination",
      priority: "medium",
      related: { kind: "vaccination", count: upcomingVaccines.length },
      message: `${upcomingVaccines.length} vaccination${upcomingVaccines.length === 1 ? " is" : "s are"} due within 14 days`,
      suggestedAction: "Group upcoming vaccine work into one vet visit where possible."
    }));
  }

  animals.filter((animal) => animal.status === "Sick").forEach((animal) => {
    items.push(makeItem({
      type: "health",
      priority: "high",
      related: { kind: "animal", id: animal._id, label: animal.animalId },
      message: `${animal.animalId} is marked sick`,
      suggestedAction: "Review the latest health record and confirm recovery status."
    }));
  });

  const casesByAnimal = healthRecords.reduce((acc, record) => {
    const id = String(record.animal?._id || record.animal);
    acc[id] = acc[id] || [];
    acc[id].push(record);
    return acc;
  }, {});
  Object.values(casesByAnimal).filter((cases) => cases.length >= 2).forEach((cases) => {
    const animal = cases[0].animal;
    items.push(makeItem({
      type: "health",
      priority: "medium",
      related: { kind: "animal", id: animal?._id, label: animal?.animalId },
      message: `${animal?.animalId || "An animal"} has repeated health cases`,
      suggestedAction: "Look for recurring causes in housing, feed, parasites, or breeding stress."
    }));
  });

  breedingRecords
    .filter((record) => record.pregnancyStatus === "pregnant" && daysUntil(record.expectedBirthDate) !== null && daysUntil(record.expectedBirthDate) <= 21)
    .forEach((record) => {
      items.push(makeItem({
        type: "breeding",
        priority: daysUntil(record.expectedBirthDate) <= 7 ? "urgent" : "high",
        related: { kind: "animal", id: record.femaleAnimal?._id, label: record.femaleAnimal?.animalId },
        message: `${record.femaleAnimal?.animalId} is close to expected birth date`,
        suggestedAction: "Prepare birthing space and schedule a pregnancy check."
      }));
    });

  const dueForBreeding = animals.filter((animal) => animal.gender === "Female" && animal.status === "Healthy");
  if (dueForBreeding.length) {
    items.push(makeItem({
      type: "breeding",
      priority: "low",
      related: { kind: "animal", count: dueForBreeding.length },
      message: `${dueForBreeding.length} healthy female animal${dueForBreeding.length === 1 ? " is" : "s are"} potential breeding candidates`,
      suggestedAction: "Review age, body condition, and recent health history before mating."
    }));
  }

  animals.filter((animal) => animal.weight <= 0).forEach((animal) => {
    items.push(makeItem({
      type: "production",
      priority: "medium",
      related: { kind: "animal", id: animal._id, label: animal.animalId },
      message: `${animal.animalId} has no usable weight recorded`,
      suggestedAction: "Update weight now; future weight history can flag abnormal changes more precisely."
    }));
  });

  crops
    .filter((crop) => crop.status === "Ready" || (crop.harvestDate && daysUntil(crop.harvestDate) <= 14 && daysUntil(crop.harvestDate) >= 0))
    .forEach((crop) => {
      items.push(makeItem({
        type: "crop",
        priority: crop.status === "Ready" ? "high" : "medium",
        related: { kind: "crop", id: crop._id, label: crop.name },
        message: `${crop.name} crop is close to harvest`,
        suggestedAction: "Confirm labor, storage, transport, and buyer plans."
      }));
    });

  const highExpenseCategories = Object.entries(finance.byCategory).filter(([, amount]) => amount >= Math.max(25000, finance.income * 0.35));
  highExpenseCategories.forEach(([category, amount]) => {
    items.push(makeItem({
      type: "finance",
      priority: "high",
      related: { kind: "expense", label: category, amount },
      message: `${category} expenses are high this month`,
      suggestedAction: "Review supplier prices, usage logs, and waste before the next purchase."
    }));
  });

  if (finance.profit < 0) {
    items.push(makeItem({
      type: "finance",
      priority: "urgent",
      related: { kind: "finance", amount: finance.profit },
      message: "Farm profit is negative this month",
      suggestedAction: "Compare the largest expenses with current income sources and pause non-essential spend."
    }));
  } else if (finance.income > 0 && finance.profit / finance.income < 0.15) {
    items.push(makeItem({
      type: "finance",
      priority: "medium",
      related: { kind: "finance", amount: finance.profit },
      message: "Profit margin is low this month",
      suggestedAction: "Check feed, labor, medicine, and transport costs for savings."
    }));
  }

  const priorityRank = { urgent: 0, high: 1, medium: 2, low: 3 };
  return {
    recommendations: items.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]).slice(0, 12),
    alerts: items.filter((item) => ["urgent", "high", "medium"].includes(item.priority)),
    snapshot,
    finance
  };
}

export async function answerFarmQuestion(user, question = "") {
  const intelligence = await generateFarmIntelligence(user);
  const q = question.toLowerCase();
  const { snapshot, finance } = intelligence;

  if (q.includes("vaccine") || q.includes("vaccination")) {
    const vaccines = snapshot.vaccinations.filter((record) => ["overdue", "upcoming"].includes(record.status));
    return vaccines.length
      ? vaccines.map((record) => `${record.animal?.animalId}: ${record.vaccineName} is ${record.status}${record.nextDueDate ? `, due ${new Date(record.nextDueDate).toLocaleDateString()}` : ""}.`).join("\n")
      : "No upcoming or overdue vaccinations were found.";
  }

  if (q.includes("sick") || q.includes("health")) {
    const sick = snapshot.animals.filter((animal) => animal.status === "Sick");
    return sick.length ? sick.map((animal) => `${animal.animalId} (${animal.name || animal.species}) is marked sick.`).join("\n") : "No animals are currently marked sick.";
  }

  if (q.includes("crop") || q.includes("harvest")) {
    const ready = snapshot.crops.filter((crop) => crop.status === "Ready" || (crop.harvestDate && daysUntil(crop.harvestDate) <= 14));
    return ready.length ? ready.map((crop) => `${crop.name} in ${crop.field} is ${crop.status.toLowerCase()}${crop.harvestDate ? `; harvest date ${new Date(crop.harvestDate).toLocaleDateString()}` : ""}.`).join("\n") : "No crops are currently close to harvest.";
  }

  if (q.includes("birth") || q.includes("pregnant") || q.includes("giving birth")) {
    const close = snapshot.breedingRecords.filter((record) => record.pregnancyStatus === "pregnant" && daysUntil(record.expectedBirthDate) <= 45);
    return close.length ? close.map((record) => `${record.femaleAnimal?.animalId} is expected around ${new Date(record.expectedBirthDate).toLocaleDateString()}.`).join("\n") : "No pregnant animals are close to expected birth in the next 45 days.";
  }

  if (q.includes("profit") || q.includes("expense") || q.includes("money")) {
    return `This month: income ${finance.income.toLocaleString()}, expenses ${finance.expenses.toLocaleString()}, profit/loss ${finance.profit.toLocaleString()}.`;
  }

  return intelligence.recommendations.length
    ? `Here are the top farm recommendations:\n${intelligence.recommendations.slice(0, 5).map((item) => `- ${item.message} Action: ${item.suggestedAction}`).join("\n")}`
    : "I do not see urgent recommendations right now. Try asking about vaccines, sick animals, crops, births, or profit.";
}
