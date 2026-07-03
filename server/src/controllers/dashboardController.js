import Animal from "../models/Animal.js";
import Crop from "../models/Crop.js";
import Transaction from "../models/Transaction.js";

export async function getDashboard(req, res, next) {
  try {
    const user = req.user._id;
    const [animals, crops, transactions] = await Promise.all([
      Animal.find({ user }).lean(),
      Crop.find({ user }).lean(),
      Transaction.find({ user }).sort({ transactionDate: -1 }).limit(8).lean()
    ]);

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
    const readyCrops = crops.filter((crop) => crop.status === "Ready").length;

    res.json({
      totals: {
        animals: animals.length,
        crops: crops.length,
        sickAnimals,
        readyCrops,
        income: totalIncome,
        expenses: totalExpenses,
        profitLoss: totalIncome - totalExpenses
      },
      animalStatus: ["Healthy", "Sick", "Pregnant", "Sold", "Archived"].map((status) => ({
        status,
        count: animals.filter((animal) => animal.status === status).length
      })),
      cropStatus: ["Planned", "Growing", "Ready", "Harvested"].map((status) => ({
        status,
        count: crops.filter((crop) => crop.status === status).length
      })),
      recentTransactions: transactions
    });
  } catch (error) {
    next(error);
  }
}
