import Animal from "../models/Animal.js";
import BirthRecord from "../models/BirthRecord.js";
import BreedingRecord from "../models/BreedingRecord.js";
import Crop from "../models/Crop.js";
import HealthRecord from "../models/HealthRecord.js";
import Transaction from "../models/Transaction.js";
import VaccinationRecord from "../models/VaccinationRecord.js";
import WeatherRecord from "../models/WeatherRecord.js";
import { generateFarmIntelligence } from "../services/aiService.js";
import { normalizeVaccination } from "../utils/vaccinations.js";

export async function getDashboard(req, res, next) {
  try {
    const user = req.user._id;
    const today = new Date();
    const next45 = new Date();
    next45.setDate(today.getDate() + 45);
    const [animals, crops, transactions, recentVetCases, vaccinations, recentBirths, expectedBirths, latestWeather] = await Promise.all([
      Animal.find({ user }).lean(),
      Crop.find({ user }).lean(),
      Transaction.find({ user }).sort({ transactionDate: -1 }).limit(8).lean(),
      HealthRecord.find({ user }).populate("animal", "animalId name species").sort({ recordDate: -1 }).limit(6).lean(),
      VaccinationRecord.find({ user }).populate("animal", "animalId name species status").sort({ nextDueDate: 1 }).limit(25),
      BirthRecord.find({ user }).populate("mother", "animalId name species").populate("father", "animalId name species").populate("offspring", "animalId name species").sort({ birthDate: -1 }).limit(6).lean(),
      BreedingRecord.find({ user, pregnancyStatus: "pregnant", expectedBirthDate: { $gte: today, $lte: next45 } })
        .populate("femaleAnimal", "animalId name species")
        .populate("maleAnimal", "animalId name species")
        .sort({ expectedBirthDate: 1 })
        .limit(8)
        .lean(),
      WeatherRecord.findOne({ user }).sort({ recordDate: -1 }).lean()
    ]);
    const normalizedVaccinations = (await Promise.all(vaccinations.map((record) => normalizeVaccination(record))))
      .filter((record) => record.animal?.status !== "Deceased");

    const income = await Transaction.aggregate([
      { $match: { user, type: "income" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const expenses = await Transaction.aggregate([
      { $match: { user, type: "expense" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const totalIncome = income[0]?.total || 0;
    const totalExpenses = expenses[0]?.total || 0;
    const sickAnimals = animals.filter((animal) => animal.status === "Sick").length;
    const pregnantAnimals = animals.filter((animal) => animal.status === "Pregnant").length;
    const deceasedAnimals = animals.filter((animal) => animal.status === "Deceased").length;
    const activeAnimals = animals.filter((animal) => !["Sold", "Transferred", "Archived", "Deceased"].includes(animal.status)).length;
    const mortalityStart = new Date(today);
    mortalityStart.setFullYear(today.getFullYear() - 1);
    const recentDeaths = animals.filter((animal) => animal.status === "Deceased" && animal.dateOfDeath && new Date(animal.dateOfDeath) >= mortalityStart && new Date(animal.dateOfDeath) <= today);
    const mortalityDenominator = activeAnimals + recentDeaths.length;
    const deathsByCause = recentDeaths.reduce((counts, animal) => {
      const cause = animal.causeOfDeath === "Other" ? animal.customCauseOfDeath || "Other" : animal.causeOfDeath || "Unknown";
      counts[cause] = (counts[cause] || 0) + 1;
      return counts;
    }, {});
    const readyCrops = crops.filter((crop) => crop.status === "Ready").length;
    const dueForBreeding = animals.filter((animal) => animal.gender === "Female" && animal.status === "Healthy").length;
    const upcomingVaccinations = normalizedVaccinations.filter((record) => record.status === "upcoming").length;
    const overdueVaccinations = normalizedVaccinations.filter((record) => record.status === "overdue").length;
    const intelligence = await generateFarmIntelligence(user);

    res.json({
      totals: {
        animals: activeAnimals,
        totalAnimalRecords: animals.length,
        deceasedAnimals,
        crops: crops.length,
        sickAnimals,
        pregnantAnimals,
        expectedBirths: expectedBirths.length,
        dueForBreeding,
        upcomingVaccinations,
        overdueVaccinations,
        readyCrops,
        income: totalIncome,
        expenses: totalExpenses,
        profitLoss: totalIncome - totalExpenses
      },
      mortality: {
        dateFrom: mortalityStart,
        dateTo: today,
        deaths: recentDeaths.length,
        deathsByCause,
        rate: mortalityDenominator ? Number(((recentDeaths.length / mortalityDenominator) * 100).toFixed(1)) : null,
        formula: "Deaths recorded in the last 12 months / (currently active animals + those deaths) x 100",
        note: "This operational rate uses available animal records and may be incomplete if historical animals or death dates have not been entered."
      },
      animalStatus: ["Healthy", "Sick", "Pregnant", "Sold", "Transferred", "Archived", "Deceased"].map((status) => ({
        status,
        count: animals.filter((animal) => animal.status === status).length
      })),
      cropStatus: ["Planned", "Growing", "Ready", "Harvested"].map((status) => ({
        status,
        count: crops.filter((crop) => crop.status === status).length
      })),
      recentTransactions: transactions,
      recentVetCases,
      recentBirths,
      expectedBirths,
      vaccinationAlerts: normalizedVaccinations
        .filter((record) => ["upcoming", "overdue"].includes(record.status))
        .slice(0, 8),
      latestWeather,
      aiRecommendations: intelligence.recommendations.slice(0, 6)
    });
  } catch (error) {
    next(error);
  }
}
