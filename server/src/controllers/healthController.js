import { body } from "express-validator";
import Animal from "../models/Animal.js";
import HealthRecord from "../models/HealthRecord.js";
import Transaction from "../models/Transaction.js";

export const healthRules = [
  body("animal").isMongoId().withMessage("Animal is required"),
  body("recordDate").optional({ values: "falsy" }).isISO8601().toDate(),
  body("condition").trim().notEmpty().withMessage("Condition or disease is required"),
  body("serviceCharge").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("medicineCost").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("transportCost").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("otherCost").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("recoveryStatus").optional().isIn(["Open", "Recovering", "Recovered", "Chronic", "Referred"])
];

function payload(body) {
  const allowed = ["animal", "recordDate", "condition", "symptoms", "diagnosis", "treatment", "medication", "dosage", "vetName", "serviceType", "serviceCharge", "medicineCost", "transportCost", "otherCost", "totalCost", "paymentMethod", "followUpDate", "recoveryStatus", "notes"];
  const out = allowed.reduce((acc, key) => {
    if (body[key] !== undefined) acc[key] = body[key];
    return acc;
  }, {});
  out.serviceCharge = Number(out.serviceCharge || 0);
  out.medicineCost = Number(out.medicineCost || 0);
  out.transportCost = Number(out.transportCost || 0);
  out.otherCost = Number(out.otherCost || 0);
  out.totalCost = out.serviceCharge + out.medicineCost + out.transportCost + out.otherCost;
  return out;
}

async function assertAnimal(user, animalId) {
  const animal = await Animal.findOne({ _id: animalId, user });
  return animal;
}

async function syncHealthFinance(record, animal) {
  const totalCost = Number(record.totalCost || 0);
  if (!totalCost) {
    if (record.financeTransaction) {
      await Transaction.findOneAndDelete({ _id: record.financeTransaction, user: record.user });
      record.financeTransaction = null;
      await record.save();
    }
    return;
  }

  const transactionPayload = {
    user: record.user,
    type: "expense",
    financeSection: "AnimalHealth",
    category: record.serviceType || record.condition || "Vet/Health",
    animal: record.animal,
    healthRecord: record._id,
    source: "health",
    transactionDate: record.recordDate,
    item: record.serviceType || record.condition || "Vet/Health",
    description: `${animal.animalId}${animal.name ? ` - ${animal.name}` : ""}: ${record.condition}`,
    amount: totalCost,
    totalCost,
    serviceCharge: record.serviceCharge,
    medicineCost: record.medicineCost,
    transportCost: record.transportCost,
    otherCost: record.otherCost,
    paymentMethod: record.paymentMethod,
    followUpDate: record.followUpDate,
    notes: record.notes
  };

  const transaction = record.financeTransaction
    ? await Transaction.findOneAndUpdate({ _id: record.financeTransaction, user: record.user }, transactionPayload, { new: true, runValidators: true })
    : await Transaction.create(transactionPayload);

  if (!record.financeTransaction && transaction?._id) {
    record.financeTransaction = transaction._id;
    await record.save();
  }
}

export async function listHealthRecords(req, res, next) {
  try {
    const query = { user: req.user._id };
    if (req.query.animal) query.animal = req.query.animal;
    const records = await HealthRecord.find(query).populate("animal", "animalId name species status").sort({ recordDate: -1 });
    res.json(records);
  } catch (error) {
    next(error);
  }
}

export async function createHealthRecord(req, res, next) {
  try {
    const animal = await assertAnimal(req.user._id, req.body.animal);
    if (!animal) return res.status(404).json({ message: "Animal not found" });

    const record = await HealthRecord.create({ ...payload(req.body), user: req.user._id });
    if (record.recoveryStatus !== "Recovered" && animal.status !== "Sick") {
      animal.status = "Sick";
      await animal.save();
    }
    await syncHealthFinance(record, animal);
    res.status(201).json(await record.populate("animal", "animalId name species status"));
  } catch (error) {
    next(error);
  }
}

export async function updateHealthRecord(req, res, next) {
  try {
    if (req.body.animal && !(await assertAnimal(req.user._id, req.body.animal))) {
      return res.status(404).json({ message: "Animal not found" });
    }
    const record = await HealthRecord.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, payload(req.body), {
      new: true,
      runValidators: true
    }).populate("animal", "animalId name species status");
    if (!record) return res.status(404).json({ message: "Health record not found" });
    await syncHealthFinance(record, record.animal);
    res.json(record);
  } catch (error) {
    next(error);
  }
}

export async function deleteHealthRecord(req, res, next) {
  try {
    const record = await HealthRecord.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!record) return res.status(404).json({ message: "Health record not found" });
    if (record.financeTransaction) await Transaction.findOneAndDelete({ _id: record.financeTransaction, user: req.user._id });
    res.json({ message: "Health record deleted" });
  } catch (error) {
    next(error);
  }
}
