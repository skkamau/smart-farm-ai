import { body } from "express-validator";
import Animal from "../models/Animal.js";
import HealthRecord from "../models/HealthRecord.js";
import Transaction from "../models/Transaction.js";

export const healthRules = [
  body("animal").isMongoId().withMessage("Animal is required"),
  body("recordDate").optional({ values: "falsy" }).isISO8601().toDate(),
  body("condition").trim().notEmpty().withMessage("Condition or disease is required"),
  body("diagnosis").trim().notEmpty().withMessage("Diagnosis is required").isLength({ max: 2000 }),
  body("medications").optional().isArray({ max: 25 }).withMessage("Medications must be a list of up to 25 entries"),
  body("medications.*.medicationName").trim().notEmpty().withMessage("Medication name is required").isLength({ max: 200 }),
  body("medications.*.dosage").trim().notEmpty().withMessage("Dosage is required").isLength({ max: 200 }),
  body("medications.*.medicineCharge").isFloat({ min: 0 }).withMessage("Medicine charge must be a valid non-negative number"),
  body("serviceCharge").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("medicineCost").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("transportCost").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("otherCost").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("followUpDate").optional({ values: "falsy" }).isISO8601().withMessage("Follow-up date must be valid").toDate(),
  body("recoveryStatus").optional().isIn(["Open", "Recovering", "Recovered", "Chronic", "Referred"])
];

export function normalizeHealthMedications(body) {
  if (Array.isArray(body.medications)) {
    return body.medications
      .map((item) => ({
        medicationName: String(item?.medicationName || "").trim(),
        dosage: String(item?.dosage || "").trim(),
        medicineCharge: Number(item?.medicineCharge || 0)
      }))
      .filter((item) => item.medicationName || item.dosage || item.medicineCharge);
  }

  if (body.medication || body.dosage || Number(body.medicineCost || 0)) {
    return [{
      medicationName: String(body.medication || "").trim(),
      dosage: String(body.dosage || "").trim(),
      medicineCharge: Number(body.medicineCost || 0)
    }];
  }

  return [];
}

export function buildHealthPayload(body) {
  const allowed = ["animal", "recordDate", "condition", "symptoms", "diagnosis", "vetName", "serviceType", "serviceCharge", "transportCost", "otherCost", "paymentMethod", "followUpDate", "recoveryStatus", "notes"];
  const out = allowed.reduce((acc, key) => {
    if (body[key] !== undefined) acc[key] = body[key];
    return acc;
  }, {});
  out.medications = normalizeHealthMedications(body);
  out.serviceCharge = Number(out.serviceCharge || 0);
  out.medicineCost = out.medications.reduce((sum, item) => sum + Number(item.medicineCharge || 0), 0);
  out.transportCost = Number(out.transportCost || 0);
  out.otherCost = Number(out.otherCost || 0);
  out.totalCost = out.serviceCharge + out.medicineCost + out.transportCost + out.otherCost;
  return out;
}

async function assertAnimal(user, animalId) {
  const animal = await Animal.findOne({ _id: animalId, user });
  return animal;
}

function recordAfterDeath(animal, recordDate) {
  return animal.status === "Deceased" && animal.dateOfDeath && new Date(recordDate || Date.now()) > new Date(animal.dateOfDeath);
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
    if (recordAfterDeath(animal, req.body.recordDate)) return res.status(409).json({ message: "Health records cannot be dated after the animal's death" });

    const record = await HealthRecord.create({ ...buildHealthPayload(req.body), user: req.user._id });
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
    if (req.body.animal) {
      const animal = await assertAnimal(req.user._id, req.body.animal);
      if (!animal) return res.status(404).json({ message: "Animal not found" });
      if (recordAfterDeath(animal, req.body.recordDate)) return res.status(409).json({ message: "Health records cannot be dated after the animal's death" });
    }
    const record = await HealthRecord.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, buildHealthPayload(req.body), {
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
