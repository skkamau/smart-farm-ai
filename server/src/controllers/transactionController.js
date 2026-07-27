import { body } from "express-validator";
import Animal from "../models/Animal.js";
import AnimalGroup from "../models/AnimalGroup.js";
import Crop from "../models/Crop.js";
import FinanceAuditLog from "../models/FinanceAuditLog.js";
import HealthRecord from "../models/HealthRecord.js";
import InventoryItem from "../models/InventoryItem.js";
import StockMovement from "../models/StockMovement.js";
import Transaction from "../models/Transaction.js";
import VaccinationRecord from "../models/VaccinationRecord.js";
import VaccinationCampaign from "../models/VaccinationCampaign.js";

const financeSections = ["Income", "Expenses", "CropExpense", "AnimalHealth", "Construction", "Equipment", "Feed", "Fuel", "Consumables", "CashSavings"];
const transactionTypes = ["income", "expense"];
const paymentMethods = ["Cash", "M-Pesa", "Mpesa", "Bank transfer", "Bank Transfer", "Card", "Credit", "Other"];
const paymentStatuses = ["paid", "partially_paid", "unpaid"];
const enterprises = ["Whole farm", "Cattle", "Sheep", "Goats", "Poultry", "Fish", "Crops", "Individual animal", "Animal group", "Field", "Other", "Sheep and goats", "Crop"];
const linkedModels = {
  Animal, "Animal group": AnimalGroup, Crop, "Inventory item": InventoryItem,
  "Health record": HealthRecord, "Vaccination record": VaccinationRecord, "Vaccination campaign": VaccinationCampaign
};

function scalar(value, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function canonicalCategory(value, type) {
  const cleaned = scalar(value, 120).replace(/\s+/g, " ");
  if (!cleaned) return type === "income" ? "Other income" : "Other expenses";
  return cleaned.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function paymentState(amount, amountPaid, requestedStatus) {
  const total = Number(amount || 0);
  let paid = Number(amountPaid || 0);
  if (requestedStatus === "paid") paid = total;
  if (requestedStatus === "unpaid") paid = 0;
  if (paid < 0 || paid > total) throw Object.assign(new Error("Amount paid cannot exceed the transaction amount"), { statusCode: 400 });
  return {
    amountPaid: paid,
    amountOutstanding: Math.max(0, total - paid),
    paymentStatus: paid === 0 ? "unpaid" : paid === total ? "paid" : "partially_paid"
  };
}

export const transactionRules = [
  body("type").isIn(transactionTypes).withMessage("Type must be income or expense"),
  body("financeSection").optional({ values: "falsy" }).isIn(financeSections),
  body("source").optional({ values: "falsy" }).isIn(["manual", "crop", "health", "vaccination", "inventory"]),
  body("amount").isFloat({ gt: 0 }).withMessage("Amount must be greater than zero"),
  body("amountPaid").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("paymentStatus").optional().isIn(paymentStatuses),
  body("paymentMethod").optional({ values: "falsy" }).isIn(paymentMethods),
  body("enterpriseType").optional({ values: "falsy" }).isIn(enterprises),
  body("crop").optional({ values: "falsy" }).isMongoId(),
  body("animal").optional({ values: "falsy" }).isMongoId(),
  body("healthRecord").optional({ values: "falsy" }).isMongoId(),
  body("vaccinationRecord").optional({ values: "falsy" }).isMongoId(),
  body("vaccinationCampaign").optional({ values: "falsy" }).isMongoId(),
  body("linkedRecordId").optional({ values: "falsy" }).isMongoId(),
  body("transactionDate").isISO8601().toDate(),
  body("dueDate").optional({ values: "falsy" }).isISO8601().toDate(),
  body("description").trim().notEmpty().isLength({ max: 500 }).withMessage("Description is required"),
  body("category").trim().notEmpty().isLength({ max: 120 }).withMessage("Category is required")
];

export const paymentRules = [
  body("amount").isFloat({ gt: 0 }).withMessage("Payment amount must be greater than zero"),
  body("paymentDate").optional({ values: "falsy" }).isISO8601().toDate(),
  body("paymentMethod").optional({ values: "falsy" }).isIn(paymentMethods),
  body("referenceNumber").optional({ values: "falsy" }).trim().isLength({ max: 160 }),
  body("notes").optional({ values: "falsy" }).trim().isLength({ max: 1000 })
];

export const reversalRules = [
  body("reason").trim().notEmpty().isLength({ min: 3, max: 500 }).withMessage("Enter a reversal reason")
];

export const resetFinanceRules = [
  body("confirmation").equals("RESET FINANCE").withMessage("Enter RESET FINANCE to confirm")
];

function normalizePayload(source, existing = null) {
  const amount = Number(source.amount ?? existing?.amount ?? 0);
  const type = source.type || existing?.type || "expense";
  const requestedStatus = source.paymentStatus || existing?.paymentStatus || "paid";
  const paidInput = source.amountPaid ?? (requestedStatus === "paid" ? amount : existing?.amountPaid || 0);
  const payment = paymentState(amount, paidInput, requestedStatus);
  const out = {
    type,
    financeSection: source.financeSection || (type === "income" ? "Income" : "Expenses"),
    category: canonicalCategory(source.category, type),
    amount,
    totalCost: amount,
    description: scalar(source.description),
    transactionDate: source.transactionDate,
    paymentMethod: scalar(source.paymentMethod, 80) || "Other",
    ...payment,
    dueDate: source.dueDate || null,
    counterparty: scalar(source.counterparty, 160),
    referenceNumber: scalar(source.referenceNumber, 160),
    enterpriseType: source.enterpriseType || "Whole farm",
    linkedRecordType: scalar(source.linkedRecordType, 80),
    linkedRecordId: source.linkedRecordId || null,
    source: source.source || existing?.source || "manual",
    sourceType: scalar(source.sourceType, 80),
    sourceId: scalar(source.sourceId, 160),
    notes: scalar(source.notes || source.remarks, 2000)
  };
  for (const field of ["crop", "animal", "healthRecord", "vaccinationRecord", "vaccinationCampaign", "inventoryMovement"]) {
    if (source[field] !== undefined) out[field] = source[field] || null;
    else if (existing?.[field]) out[field] = existing[field];
  }
  // Retain old detail fields when an old record is edited through the new form.
  for (const field of ["item", "quantity", "unit", "unitCost", "supplierVendor", "storageLocation", "serviceCharge", "medicineCost", "transportCost", "otherCost"]) {
    if (source[field] !== undefined) out[field] = source[field];
    else if (existing?.[field] !== undefined) out[field] = existing[field];
  }
  return out;
}

async function assertLinkedOwnership(payload, userId) {
  const direct = [
    ["crop", Crop], ["animal", Animal], ["healthRecord", HealthRecord],
    ["vaccinationRecord", VaccinationRecord], ["vaccinationCampaign", VaccinationCampaign],
    ["inventoryMovement", (await import("../models/StockMovement.js")).default]
  ];
  for (const [field, Model] of direct) {
    if (payload[field] && !(await Model.exists({ _id: payload[field], user: userId }))) {
      throw Object.assign(new Error(`${field} was not found`), { statusCode: 404 });
    }
  }
  if (payload.linkedRecordId) {
    const Model = linkedModels[payload.linkedRecordType];
    if (!Model || !(await Model.exists({ _id: payload.linkedRecordId, user: userId }))) {
      throw Object.assign(new Error("Linked farm record was not found"), { statusCode: 404 });
    }
  }
}

function compatibleView(record) {
  const object = record.toObject ? record.toObject() : record;
  const amount = Number(object.amount || object.totalCost || object.cashAmount || object.savingsAmount || 0);
  const legacyHasPaymentState = object.amountPaid !== undefined
    && object.paymentStatus
    && !record.$isDefault?.("amountPaid")
    && !record.$isDefault?.("paymentStatus");
  const amountPaid = legacyHasPaymentState ? Number(object.amountPaid || 0) : amount;
  const amountOutstanding = Math.max(0, amount - amountPaid);
  const linkedRecordType = object.linkedRecordType
    || (object.healthRecord ? "Health record" : object.vaccinationRecord ? "Vaccination record" : object.vaccinationCampaign ? "Vaccination campaign" : object.inventoryMovement ? "Inventory item" : object.crop ? "Crop" : object.animal ? "Animal" : "");
  const linkedRecordId = object.linkedRecordId
    || object.healthRecord?._id || object.healthRecord || object.vaccinationRecord?._id || object.vaccinationRecord
    || object.vaccinationCampaign?._id || object.vaccinationCampaign || object.crop?._id || object.crop || object.animal?._id || object.animal || null;
  const legacyEnterprise = record.$isDefault?.("enterpriseType");
  return {
    ...object,
    amount,
    amountPaid,
    amountOutstanding,
    paymentStatus: amountOutstanding === 0 ? "paid" : amountPaid > 0 ? "partially_paid" : "unpaid",
    category: object.category || (object.type === "income" ? "Other income" : "Other expenses"),
    linkedRecordType,
    linkedRecordId,
    enterpriseType: !legacyEnterprise && object.enterpriseType ? object.enterpriseType : object.crop ? "Crop" : object.animal ? "Individual animal" : "Whole farm",
    transactionId: object.transactionId || `LEGACY-${String(object._id).slice(-8).toUpperCase()}`
  };
}

async function audit(user, transaction, action, summary = {}) {
  await FinanceAuditLog.create({ user, transaction, action, summary }).catch(() => {});
}

function populate(query) {
  return query
    .populate("crop", "name field plot").populate("animal", "animalId name species")
    .populate("healthRecord", "healthCondition diagnosis recordDate")
    .populate("vaccinationRecord", "vaccineName dateGiven")
    .populate("vaccinationCampaign", "scheduleName vaccineName")
    .populate("createdBy", "name").populate("reversedBy", "name");
}

export async function listTransactions(req, res, next) {
  try {
    const query = { user: req.user._id };
    if (transactionTypes.includes(scalar(req.query.type))) query.type = scalar(req.query.type);
    if (paymentStatuses.includes(scalar(req.query.paymentStatus))) query.paymentStatus = scalar(req.query.paymentStatus);
    if (scalar(req.query.category)) query.category = scalar(req.query.category, 120);
    if (scalar(req.query.paymentMethod)) query.paymentMethod = scalar(req.query.paymentMethod, 80);
    if (scalar(req.query.linkedRecordType)) query.linkedRecordType = scalar(req.query.linkedRecordType, 80);
    if (req.query.crop) query.crop = req.query.crop;
    if (req.query.animal) query.animal = req.query.animal;
    if (req.query.dateFrom || req.query.dateTo) {
      query.transactionDate = {};
      const from = validDate(req.query.dateFrom);
      const to = validDate(req.query.dateTo);
      if (from) query.transactionDate.$gte = from;
      if (to) {
        to.setHours(23, 59, 59, 999);
        query.transactionDate.$lte = to;
      }
    }
    const sort = req.query.sort === "oldest" ? { transactionDate: 1 } : req.query.sort === "highest" ? { amount: -1 } : req.query.sort === "lowest" ? { amount: 1 } : { transactionDate: -1, createdAt: -1 };
    const records = await populate(Transaction.find(query).sort(sort));
    res.json(records.map(compatibleView));
  } catch (error) { next(error); }
}

export async function createTransaction(req, res, next) {
  try {
    const payload = normalizePayload(req.body);
    await assertLinkedOwnership(payload, req.user._id);
    const existing = payload.sourceType && payload.sourceId
      ? await Transaction.findOne({ user: req.user._id, sourceKey: `${payload.sourceType}:${payload.sourceId}` })
      : null;
    if (existing) return res.status(409).json({ message: "A Finance transaction already exists for this farm record", transactionId: existing._id });
    const transaction = await Transaction.create({ ...payload, user: req.user._id, createdBy: req.user._id });
    await audit(req.user._id, transaction._id, "created", { type: transaction.type, amount: transaction.amount, category: transaction.category });
    res.status(201).json(compatibleView(transaction));
  } catch (error) { next(error); }
}

export async function updateTransaction(req, res, next) {
  try {
    const existing = await Transaction.findOne({ _id: req.params.id, user: req.user._id });
    if (!existing) return res.status(404).json({ message: "Transaction not found" });
    if (existing.reversedAt) return res.status(409).json({ message: "Reversed transactions cannot be edited" });
    const payload = normalizePayload(req.body, existing);
    await assertLinkedOwnership(payload, req.user._id);
    Object.assign(existing, payload);
    await existing.save();
    await audit(req.user._id, existing._id, "edited", { type: existing.type, amount: existing.amount, category: existing.category });
    res.json(compatibleView(await populate(Transaction.findById(existing._id))));
  } catch (error) { next(error); }
}

export async function recordPayment(req, res, next) {
  try {
    const transaction = await Transaction.findOne({ _id: req.params.id, user: req.user._id, reversedAt: null });
    if (!transaction) return res.status(404).json({ message: "Transaction not found" });
    const current = compatibleView(transaction);
    const paymentAmount = Number(req.body.amount);
    if (paymentAmount > current.amountOutstanding) return res.status(400).json({ message: "Payment exceeds the outstanding amount" });
    transaction.payments.push({
      amount: paymentAmount,
      paymentDate: req.body.paymentDate || new Date(),
      paymentMethod: scalar(req.body.paymentMethod, 80) || transaction.paymentMethod,
      referenceNumber: scalar(req.body.referenceNumber, 160),
      notes: scalar(req.body.notes, 1000),
      recordedBy: req.user._id
    });
    transaction.amountPaid = current.amountPaid + paymentAmount;
    transaction.amountOutstanding = Math.max(0, current.amount - transaction.amountPaid);
    transaction.paymentStatus = transaction.amountOutstanding === 0 ? "paid" : "partially_paid";
    await transaction.save();
    await audit(req.user._id, transaction._id, "payment_recorded", { amount: paymentAmount, amountOutstanding: transaction.amountOutstanding });
    res.json(compatibleView(transaction));
  } catch (error) { next(error); }
}

export async function reverseTransaction(req, res, next) {
  try {
    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id, reversedAt: null },
      { reversedAt: new Date(), reversalReason: scalar(req.body.reason, 500), reversedBy: req.user._id },
      { new: true, runValidators: true }
    );
    if (!transaction) return res.status(404).json({ message: "Transaction not found or already reversed" });
    await audit(req.user._id, transaction._id, "reversed", { reason: transaction.reversalReason });
    res.json(compatibleView(transaction));
  } catch (error) { next(error); }
}

export async function deleteTransaction(req, res, next) {
  try {
    const transaction = await Transaction.findOne({ _id: req.params.id, user: req.user._id });
    if (!transaction) return res.status(404).json({ message: "Transaction not found" });
    if (transaction.source !== "manual" || transaction.sourceKey || transaction.payments.length || transaction.reversedAt) {
      return res.status(409).json({ message: "Linked, paid, or reversed transactions must remain in financial history. Reverse the transaction instead." });
    }
    await audit(req.user._id, transaction._id, "deleted", { type: transaction.type, amount: transaction.amount, category: transaction.category });
    await transaction.deleteOne();
    res.json({ message: "Transaction deleted" });
  } catch (error) { next(error); }
}

export async function resetFinanceData(req, res, next) {
  try {
    const user = req.user._id;
    const transactionIds = await Transaction.find({ user }).distinct("_id");
    await Promise.all([
      HealthRecord.updateMany({ user, financeTransaction: { $in: transactionIds } }, { $set: { financeTransaction: null } }),
      VaccinationRecord.updateMany({ user, financeTransaction: { $in: transactionIds } }, { $set: { financeTransaction: null } }),
      VaccinationCampaign.updateMany({ user, financeTransaction: { $in: transactionIds } }, { $set: { financeTransaction: null } }),
      StockMovement.updateMany({ user, financeTransaction: { $in: transactionIds } }, { $set: { financeTransaction: null } })
    ]);
    const deleted = await Transaction.deleteMany({ user });
    await FinanceAuditLog.deleteMany({ user });
    await FinanceAuditLog.create({
      user, action: "reset", summary: { deletedTransactions: deleted.deletedCount, resetAt: new Date() }
    });
    res.json({
      message: "Finance data reset successfully",
      deletedTransactions: deleted.deletedCount
    });
  } catch (error) { next(error); }
}
