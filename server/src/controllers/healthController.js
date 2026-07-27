import { body } from "express-validator";
import Animal from "../models/Animal.js";
import HealthRecord from "../models/HealthRecord.js";
import Transaction from "../models/Transaction.js";

export const healthConditions = ["healthy", "mild", "moderate", "serious", "critical", "recovering", "chronic", "stable", "unknown"];
export const conditionToAnimalHealth = {
  healthy: "healthy",
  mild: "sick",
  moderate: "sick",
  serious: "sick",
  critical: "sick",
  recovering: "recovering",
  chronic: "chronic",
  stable: "healthy",
  unknown: "unknown"
};

export const healthRules = [
  body("animal").isMongoId().withMessage("Animal is required"),
  body("recordDate").optional({ values: "falsy" }).isISO8601().toDate(),
  body("healthCondition").isIn(healthConditions).withMessage("Choose a valid health condition"),
  body("diagnosis").trim().notEmpty().withMessage("Diagnosis is required").isLength({ max: 2000 }),
  body("medications").optional().isArray({ max: 25 }).withMessage("Medications must be a list of up to 25 entries"),
  body("medications.*.medicationName").trim().notEmpty().withMessage("Medication name is required").isLength({ max: 200 }),
  body("medications.*.dosage").trim().notEmpty().withMessage("Dosage is required").isLength({ max: 200 }),
  body("medications.*.medicineCharge").isFloat({ min: 0 }).withMessage("Medicine charge must be a valid non-negative number"),
  body("serviceCharge").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("medicineCost").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("transportCost").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("otherCost").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("followUpDate").optional({ values: "falsy" }).isISO8601().withMessage("Follow-up date must be valid").toDate()
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
  const allowed = ["animal", "recordDate", "healthCondition", "symptoms", "diagnosis", "vetName", "serviceType", "serviceCharge", "transportCost", "otherCost", "paymentMethod", "followUpDate", "notes"];
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

async function syncAnimalHealthStatus(animal, healthCondition) {
  if (!animal || animal.lifecycleStatus === "deceased") return;
  const healthStatus = conditionToAnimalHealth[healthCondition];
  if (healthStatus && animal.healthStatus !== healthStatus) {
    animal.statusHistory.push({ from: animal.healthStatus, to: healthStatus, changedBy: animal.user, reason: `Health condition: ${healthCondition}` });
    animal.healthStatus = healthStatus;
    animal.statusChangedAt = new Date();
    await animal.save();
  }
}

function recordAfterDeath(animal, recordDate) {
  return animal.lifecycleStatus === "deceased" && animal.dateOfDeath && new Date(recordDate || Date.now()) > new Date(animal.dateOfDeath);
}

async function syncHealthFinance(record, animal) {
  const totalCost = Number(record.totalCost || 0);
  if (!totalCost) {
    if (record.financeTransaction) {
      await Transaction.findOneAndUpdate(
        { _id: record.financeTransaction, user: record.user, reversedAt: null },
        { reversedAt: new Date(), reversalReason: "Health record cost removed", reversedBy: record.user }
      );
    }
    return;
  }

  const transactionPayload = {
    user: record.user,
    type: "expense",
    financeSection: "AnimalHealth",
    category: record.serviceType || record.healthCondition || "Vet/Health",
    animal: record.animal,
    healthRecord: record._id,
    source: "health",
    sourceType: "health_record",
    sourceId: String(record._id),
    sourceKey: `health_record:${record._id}`,
    transactionId: `FIN-HLT-${String(record._id).slice(-8).toUpperCase()}`,
    linkedRecordType: "Health record",
    linkedRecordId: record._id,
    enterpriseType: "Individual animal",
    transactionDate: record.recordDate,
    item: record.serviceType || record.healthCondition || "Vet/Health",
    description: `${animal.animalId}${animal.name ? ` - ${animal.name}` : ""}: ${record.diagnosis || record.healthCondition}`,
    amount: totalCost,
    paymentStatus: "paid",
    amountPaid: totalCost,
    amountOutstanding: 0,
    reversedAt: null,
    reversalReason: "",
    reversedBy: null,
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
    : await Transaction.findOneAndUpdate(
      { user: record.user, sourceKey: transactionPayload.sourceKey },
      transactionPayload,
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );

  if (!record.financeTransaction && transaction?._id) {
    record.financeTransaction = transaction._id;
    await record.save();
  }
}

export async function listHealthRecords(req, res, next) {
  try {
    const query = { user: req.user._id };
    if (req.query.animal) query.animal = req.query.animal;
    const records = await HealthRecord.find(query).populate("animal", "animalId name species lifecycleStatus healthStatus reproductiveStatus dateOfDeath causeOfDeath customCauseOfDeath").sort({ recordDate: -1 });
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
    await syncAnimalHealthStatus(animal, record.healthCondition);
    await syncHealthFinance(record, animal);
    res.status(201).json(await record.populate("animal", "animalId name species lifecycleStatus healthStatus reproductiveStatus dateOfDeath causeOfDeath customCauseOfDeath"));
  } catch (error) {
    next(error);
  }
}

export async function updateHealthRecord(req, res, next) {
  try {
    let animal = null;
    if (req.body.animal) {
      animal = await assertAnimal(req.user._id, req.body.animal);
      if (!animal) return res.status(404).json({ message: "Animal not found" });
      if (recordAfterDeath(animal, req.body.recordDate)) return res.status(409).json({ message: "Health records cannot be dated after the animal's death" });
    }
    const record = await HealthRecord.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, buildHealthPayload(req.body), {
      new: true,
      runValidators: true
    }).populate("animal", "animalId name species lifecycleStatus healthStatus reproductiveStatus dateOfDeath causeOfDeath customCauseOfDeath");
    if (!record) return res.status(404).json({ message: "Health record not found" });
    await syncAnimalHealthStatus(animal || record.animal, record.healthCondition);
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
    if (record.financeTransaction) await Transaction.findOneAndUpdate(
      { _id: record.financeTransaction, user: req.user._id, reversedAt: null },
      { reversedAt: new Date(), reversalReason: "Originating health record deleted", reversedBy: req.user._id }
    );
    res.json({ message: "Health record deleted" });
  } catch (error) {
    next(error);
  }
}
