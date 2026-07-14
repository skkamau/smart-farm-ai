import Animal from "../models/Animal.js";
import BirthRecord from "../models/BirthRecord.js";
import BreedingRecord from "../models/BreedingRecord.js";
import Crop from "../models/Crop.js";
import HealthRecord from "../models/HealthRecord.js";
import Transaction from "../models/Transaction.js";
import VaccinationRecord from "../models/VaccinationRecord.js";
import VaccinationCampaign from "../models/VaccinationCampaign.js";
import WeatherRecord from "../models/WeatherRecord.js";
import { generateFarmIntelligence } from "../services/aiService.js";
import { normalizeVaccination } from "../utils/vaccinations.js";
import { resolveCampaignStatus } from "../services/vaccinationCampaignService.js";

const lifecycleStatuses = ["active", "sold", "transferred", "archived", "deceased"];

export async function getDashboard(req, res, next) {
  try {
    const user = req.user._id;
    const today = new Date();
    const next45 = new Date();
    next45.setDate(today.getDate() + 45);
    const [animals, crops, transactions, recentVetCases, vaccinations, vaccinationCampaigns, recentBirths, expectedBirths, latestWeather] = await Promise.all([
      Animal.find({ user }).lean(),
      Crop.find({ user }).lean(),
      Transaction.find({ user }).sort({ transactionDate: -1 }).limit(8).lean(),
      HealthRecord.find({ user }).populate("animal", "animalId name species").sort({ recordDate: -1 }).limit(6).lean(),
      VaccinationRecord.find({ user }).populate("animal", "animalId name species lifecycleStatus healthStatus reproductiveStatus").sort({ nextDueDate: 1 }).limit(25),
      VaccinationCampaign.find({ user, status: { $ne: "cancelled" } })
        .populate("assignments.animal", "animalId name species lifecycleStatus")
        .populate("assignments.group", "groupId groupName species lifecycleStatus currentQuantity")
        .sort({ scheduledDate: 1 }).limit(25),
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
      .filter((record) => record.animal?.lifecycleStatus !== "deceased");
    for (const campaign of vaccinationCampaigns) {
      const status = resolveCampaignStatus(campaign);
      if (campaign.status !== status) { campaign.status = status; await campaign.save(); }
    }
    const campaignAlerts = vaccinationCampaigns
      .filter((campaign) => ["due_soon", "overdue"].includes(campaign.status))
      .map((campaign) => ({
        _id: campaign._id,
        campaign: true,
        scheduleName: campaign.scheduleName,
        vaccineName: campaign.vaccineName,
        species: campaign.species,
        nextDueDate: campaign.scheduledDate,
        status: campaign.status === "due_soon" ? "upcoming" : campaign.status,
        affectedCount: campaign.assignments.length,
        targetSummary: campaign.assignments[0]?.animal?.animalId || campaign.assignments[0]?.group?.groupId || `${campaign.assignments.length} targets`
      }));

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
    const sickAnimals = animals.filter((animal) => animal.lifecycleStatus === "active" && animal.healthStatus === "sick").length;
    const pregnantAnimals = animals.filter((animal) => animal.lifecycleStatus === "active" && animal.reproductiveStatus === "pregnant").length;
    const deceasedAnimals = animals.filter((animal) => animal.lifecycleStatus === "deceased").length;
    const activeAnimals = animals.filter((animal) => animal.lifecycleStatus === "active").length;
    const mortalityStart = new Date(today);
    mortalityStart.setFullYear(today.getFullYear() - 1);
    const recentDeaths = animals.filter((animal) => animal.lifecycleStatus === "deceased" && animal.dateOfDeath && new Date(animal.dateOfDeath) >= mortalityStart && new Date(animal.dateOfDeath) <= today);
    const mortalityDenominator = activeAnimals + recentDeaths.length;
    const deathsByCause = recentDeaths.reduce((counts, animal) => {
      const cause = animal.causeOfDeath === "Other" ? animal.customCauseOfDeath || "Other" : animal.causeOfDeath || "Unknown";
      counts[cause] = (counts[cause] || 0) + 1;
      return counts;
    }, {});
    const readyCrops = crops.filter((crop) => crop.status === "Ready").length;
    const dueForBreeding = animals.filter((animal) => animal.gender === "Female" && animal.lifecycleStatus === "active" && animal.healthStatus === "healthy" && animal.reproductiveStatus !== "pregnant").length;
    const upcomingVaccinations = normalizedVaccinations.filter((record) => record.status === "upcoming").length + campaignAlerts.filter((record) => record.status === "upcoming").length;
    const overdueVaccinations = normalizedVaccinations.filter((record) => record.status === "overdue").length + campaignAlerts.filter((record) => record.status === "overdue").length;
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
      animalStatus: lifecycleStatuses.map((status) => ({
        status,
        count: animals.filter((animal) => animal.lifecycleStatus === status).length
      })),
      cropStatus: ["Planned", "Growing", "Ready", "Harvested"].map((status) => ({
        status,
        count: crops.filter((crop) => crop.status === status).length
      })),
      recentTransactions: transactions,
      recentVetCases,
      recentBirths,
      expectedBirths,
      vaccinationAlerts: [...normalizedVaccinations.filter((record) => ["upcoming", "overdue"].includes(record.status)), ...campaignAlerts]
        .sort((a, b) => new Date(a.nextDueDate) - new Date(b.nextDueDate)).slice(0, 8),
      latestWeather,
      aiRecommendations: intelligence.recommendations.slice(0, 6)
    });
  } catch (error) {
    next(error);
  }
}
