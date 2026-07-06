import { body } from "express-validator";
import Transaction from "../models/Transaction.js";

const stockSections = ["Feed", "Fuel", "Consumables"];

export const transactionRules = [
  body("type").isIn(["income", "expense"]).withMessage("Type must be income or expense"),
  body("amount").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("quantity").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("unitCost").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("quantityIn").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("quantityOut").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("serviceCharge").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("medicineCost").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("transportCost").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("otherCost").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("description").optional({ values: "falsy" }).trim()
];

function normalizePayload(body) {
  const out = { ...body };
  const numberFields = ["amount", "quantity", "unitCost", "totalCost", "quantityIn", "quantityOut", "balance", "cashAmount", "savingsAmount", "serviceCharge", "medicineCost", "transportCost", "otherCost"];
  for (const field of numberFields) {
    if (out[field] === "" || out[field] === undefined || out[field] === null) continue;
    out[field] = Number(out[field]);
  }

  if (!out.financeSection) out.financeSection = "Expenses";
  if (!out.category) {
    if (out.financeSection === "CashSavings") out.category = "Cash";
    else if (out.financeSection === "Income") out.category = "Sales";
    else if (out.financeSection === "CropExpense") out.category = "Crop";
    else if (out.financeSection === "AnimalHealth") out.category = "Vet/Health";
    else out.category = out.financeSection;
  }
  if (!out.description) out.description = out.item || out.category || out.financeSection || "Farm finance record";
  if (!out.totalCost && out.quantity && out.unitCost) out.totalCost = out.quantity * out.unitCost;
  if (out.financeSection === "AnimalHealth" && !out.totalCost) {
    out.totalCost = Number(out.serviceCharge || 0) + Number(out.medicineCost || 0) + Number(out.transportCost || 0) + Number(out.otherCost || 0);
  }
  if (!out.amount) out.amount = out.totalCost || out.cashAmount || out.savingsAmount || 0;
  return out;
}

async function addCalculatedStockBalance(payload, userId, currentId) {
  if (!stockSections.includes(payload.financeSection) || payload.balance !== undefined) return payload;

  const previousQuery = {
    user: userId,
    financeSection: payload.financeSection,
    item: payload.item || ""
  };
  if (currentId) previousQuery._id = { $ne: currentId };

  const previous = await Transaction.findOne(previousQuery).sort({ transactionDate: -1, createdAt: -1 });
  const previousBalance = Number(previous?.balance || 0);
  payload.balance = previousBalance + Number(payload.quantityIn || 0) - Number(payload.quantityOut || 0);
  return payload;
}

export async function listTransactions(req, res, next) {
  try {
    const type = req.query.type;
    const query = { user: req.user._id };
    if (type) query.type = type;
    if (req.query.financeSection) query.financeSection = req.query.financeSection;
    if (req.query.crop) query.crop = req.query.crop;
    if (req.query.animal) query.animal = req.query.animal;
    if (req.query.category) query.category = req.query.category;
    if (req.query.paymentMethod) query.paymentMethod = req.query.paymentMethod;
    if (req.query.dateFrom || req.query.dateTo) {
      query.transactionDate = {};
      if (req.query.dateFrom) query.transactionDate.$gte = new Date(req.query.dateFrom);
      if (req.query.dateTo) query.transactionDate.$lte = new Date(req.query.dateTo);
    }
    const transactions = await Transaction.find(query)
      .populate("crop", "name field plot expectedYield actualYield revenue")
      .populate("animal", "animalId name species")
      .populate("healthRecord", "condition serviceType recordDate")
      .populate("vaccinationRecord", "vaccineName dateGiven nextDueDate")
      .sort({ transactionDate: -1, createdAt: -1 });
    res.json(transactions);
  } catch (error) {
    next(error);
  }
}

export async function createTransaction(req, res, next) {
  try {
    const payload = await addCalculatedStockBalance(normalizePayload(req.body), req.user._id);
    const transaction = await Transaction.create({ ...payload, user: req.user._id });
    res.status(201).json(transaction);
  } catch (error) {
    next(error);
  }
}

export async function updateTransaction(req, res, next) {
  try {
    const payload = await addCalculatedStockBalance(normalizePayload(req.body), req.user._id, req.params.id);
    const transaction = await Transaction.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, payload, {
      new: true,
      runValidators: true
    });
    if (!transaction) return res.status(404).json({ message: "Transaction not found" });
    res.json(transaction);
  } catch (error) {
    next(error);
  }
}

export async function deleteTransaction(req, res, next) {
  try {
    const transaction = await Transaction.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!transaction) return res.status(404).json({ message: "Transaction not found" });
    res.json({ message: "Transaction deleted" });
  } catch (error) {
    next(error);
  }
}
