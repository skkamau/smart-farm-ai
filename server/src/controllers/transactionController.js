import { body } from "express-validator";
import Animal from "../models/Animal.js";
import Crop from "../models/Crop.js";
import HealthRecord from "../models/HealthRecord.js";
import Transaction from "../models/Transaction.js";
import VaccinationRecord from "../models/VaccinationRecord.js";

const stockSections = ["Feed", "Fuel", "Consumables"];
const financeSections = ["Income", "Expenses", "CropExpense", "AnimalHealth", "Construction", "Equipment", "Feed", "Fuel", "Consumables", "CashSavings"];
const transactionTypes = ["income", "expense"];

function scalar(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const transactionRules = [
  body("type").isIn(transactionTypes).withMessage("Type must be income or expense"),
  body("financeSection").optional({ values: "falsy" }).isIn(financeSections),
  body("source").optional({ values: "falsy" }).isIn(["manual", "crop", "health"]),
  body("crop").optional({ values: "falsy" }).isMongoId(),
  body("animal").optional({ values: "falsy" }).isMongoId(),
  body("healthRecord").optional({ values: "falsy" }).isMongoId(),
  body("vaccinationRecord").optional({ values: "falsy" }).isMongoId(),
  body("amount").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("quantity").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("unitCost").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("quantityIn").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("quantityOut").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("minimumStockLevel").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("serviceCharge").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("medicineCost").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("transportCost").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("otherCost").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("description").optional({ values: "falsy" }).trim()
];

function normalizePayload(body) {
  const allowed = ["type", "financeSection", "category", "crop", "animal", "healthRecord", "vaccinationRecord", "source", "amount", "description", "transactionDate", "item", "quantity", "unit", "unitCost", "totalCost", "paymentMethod", "supplierVendor", "storageLocation", "inventoryStatus", "minimumStockLevel", "expiryDate", "quantityIn", "quantityOut", "balance", "month", "cashAmount", "savingsAmount", "serviceCharge", "medicineCost", "transportCost", "otherCost", "followUpDate", "remarks", "notes"];
  const out = allowed.reduce((payload, key) => {
    if (body[key] !== undefined) payload[key] = body[key];
    return payload;
  }, {});
  const numberFields = ["amount", "quantity", "unitCost", "totalCost", "quantityIn", "quantityOut", "balance", "cashAmount", "savingsAmount", "serviceCharge", "medicineCost", "transportCost", "otherCost", "minimumStockLevel"];
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

async function assertLinkedOwnership(payload, userId) {
  if (payload.crop && !(await Crop.exists({ _id: payload.crop, user: userId }))) {
    return "Crop not found";
  }
  if (payload.animal && !(await Animal.exists({ _id: payload.animal, user: userId }))) {
    return "Animal not found";
  }
  if (payload.healthRecord && !(await HealthRecord.exists({ _id: payload.healthRecord, user: userId }))) {
    return "Health record not found";
  }
  if (payload.vaccinationRecord && !(await VaccinationRecord.exists({ _id: payload.vaccinationRecord, user: userId }))) {
    return "Vaccination record not found";
  }
  return null;
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
    const type = scalar(req.query.type);
    const query = { user: req.user._id };
    if (transactionTypes.includes(type)) query.type = type;
    const financeSection = scalar(req.query.financeSection);
    if (financeSections.includes(financeSection)) query.financeSection = financeSection;
    if (req.query.crop) query.crop = req.query.crop;
    if (req.query.animal) query.animal = req.query.animal;
    if (scalar(req.query.category)) query.category = scalar(req.query.category).slice(0, 120);
    if (scalar(req.query.paymentMethod)) query.paymentMethod = scalar(req.query.paymentMethod).slice(0, 120);
    if (req.query.dateFrom || req.query.dateTo) {
      query.transactionDate = {};
      const dateFrom = validDate(req.query.dateFrom);
      const dateTo = validDate(req.query.dateTo);
      if (dateFrom) query.transactionDate.$gte = dateFrom;
      if (dateTo) query.transactionDate.$lte = dateTo;
      if (!Object.keys(query.transactionDate).length) delete query.transactionDate;
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
    const ownershipError = await assertLinkedOwnership(payload, req.user._id);
    if (ownershipError) return res.status(404).json({ message: ownershipError });
    const transaction = await Transaction.create({ ...payload, user: req.user._id });
    res.status(201).json(transaction);
  } catch (error) {
    next(error);
  }
}

export async function updateTransaction(req, res, next) {
  try {
    const payload = await addCalculatedStockBalance(normalizePayload(req.body), req.user._id, req.params.id);
    const ownershipError = await assertLinkedOwnership(payload, req.user._id);
    if (ownershipError) return res.status(404).json({ message: ownershipError });
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
