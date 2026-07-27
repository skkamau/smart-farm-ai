import { body } from "express-validator";
import Animal from "../models/Animal.js";
import Transaction from "../models/Transaction.js";
import VaccinationRecord from "../models/VaccinationRecord.js";
import { normalizeVaccination, resolveVaccinationStatus } from "../utils/vaccinations.js";

export const vaccinationRules = [
  body("animal").isMongoId().withMessage("Animal is required"),
  body("vaccineName").trim().notEmpty().withMessage("Vaccine name is required"),
  body("dateGiven").optional({ values: "falsy" }).isISO8601().toDate(),
  body("nextDueDate").optional({ values: "falsy" }).isISO8601().toDate(),
  body("serviceCharge").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("vaccineCost").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("transportCost").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("otherCost").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("status").optional().isIn(["completed", "upcoming", "overdue"])
];

function payload(body) {
  const allowed = ["animal", "vaccineName", "dateGiven", "nextDueDate", "vetName", "batchNumber", "serviceCharge", "vaccineCost", "transportCost", "otherCost", "totalCost", "paymentMethod", "status", "notes"];
  const out = allowed.reduce((value, key) => {
    if (body[key] !== undefined) value[key] = body[key];
    return value;
  }, {});
  out.serviceCharge = Number(out.serviceCharge || 0);
  out.vaccineCost = Number(out.vaccineCost || 0);
  out.transportCost = Number(out.transportCost || 0);
  out.otherCost = Number(out.otherCost || 0);
  out.totalCost = out.serviceCharge + out.vaccineCost + out.transportCost + out.otherCost;
  out.status = resolveVaccinationStatus(out);
  return out;
}

async function assertAnimal(user, animalId) {
  return Animal.findOne({ _id: animalId, user });
}

async function syncVaccinationFinance(record, animal) {
  const totalCost = Number(record.totalCost || 0);
  if (!totalCost) {
    if (record.financeTransaction) {
      await Transaction.findOneAndUpdate(
        { _id: record.financeTransaction, user: record.user, reversedAt: null },
        { reversedAt: new Date(), reversalReason: "Vaccination record cost removed", reversedBy: record.user }
      );
    }
    return;
  }

  const transactionPayload = {
    user: record.user,
    type: "expense",
    financeSection: "AnimalHealth",
    category: "Vaccination",
    animal: record.animal,
    vaccinationRecord: record._id,
    source: "health",
    sourceType: "vaccination_record",
    sourceId: String(record._id),
    sourceKey: `vaccination_record:${record._id}`,
    transactionId: `FIN-VAX-${String(record._id).slice(-8).toUpperCase()}`,
    linkedRecordType: "Vaccination record",
    linkedRecordId: record._id,
    enterpriseType: "Individual animal",
    transactionDate: record.dateGiven || record.createdAt || new Date(),
    item: record.vaccineName,
    description: `${animal.animalId}${animal.name ? ` - ${animal.name}` : ""}: ${record.vaccineName}`,
    amount: totalCost,
    paymentStatus: "paid",
    amountPaid: totalCost,
    amountOutstanding: 0,
    reversedAt: null,
    reversalReason: "",
    reversedBy: null,
    totalCost,
    serviceCharge: record.serviceCharge,
    medicineCost: record.vaccineCost,
    transportCost: record.transportCost,
    otherCost: record.otherCost,
    paymentMethod: record.paymentMethod,
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

export async function listVaccinations(req, res, next) {
  try {
    const query = { user: req.user._id };
    if (req.query.animal) query.animal = req.query.animal;
    let records = await VaccinationRecord.find(query).populate("animal", "animalId name species lifecycleStatus healthStatus reproductiveStatus").sort({ nextDueDate: 1, dateGiven: -1 });
    records = await Promise.all(records.map((record) => normalizeVaccination(record)));
    res.json(records);
  } catch (error) {
    next(error);
  }
}

export async function createVaccination(req, res, next) {
  try {
    const animal = await assertAnimal(req.user._id, req.body.animal);
    if (!animal) return res.status(404).json({ message: "Animal not found" });
    if (animal.lifecycleStatus !== "active") return res.status(409).json({ message: "New vaccinations can only be scheduled for active animals" });

    const record = await VaccinationRecord.create({ ...payload(req.body), user: req.user._id });
    await syncVaccinationFinance(record, animal);
    res.status(201).json(await record.populate("animal", "animalId name species lifecycleStatus healthStatus reproductiveStatus"));
  } catch (error) {
    next(error);
  }
}

export async function updateVaccination(req, res, next) {
  try {
    if (req.body.animal) {
      const animal = await assertAnimal(req.user._id, req.body.animal);
      if (!animal) return res.status(404).json({ message: "Animal not found" });
      if (animal.lifecycleStatus !== "active") return res.status(409).json({ message: "Vaccinations can only be reassigned to active animals" });
    }
    const record = await VaccinationRecord.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, payload(req.body), {
      new: true,
      runValidators: true
    }).populate("animal", "animalId name species lifecycleStatus healthStatus reproductiveStatus");
    if (!record) return res.status(404).json({ message: "Vaccination record not found" });
    await syncVaccinationFinance(record, record.animal);
    res.json(record);
  } catch (error) {
    next(error);
  }
}

export async function deleteVaccination(req, res, next) {
  try {
    const record = await VaccinationRecord.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!record) return res.status(404).json({ message: "Vaccination record not found" });
    if (record.financeTransaction) await Transaction.findOneAndUpdate(
      { _id: record.financeTransaction, user: req.user._id, reversedAt: null },
      { reversedAt: new Date(), reversalReason: "Originating vaccination record deleted", reversedBy: req.user._id }
    );
    res.json({ message: "Vaccination record deleted" });
  } catch (error) {
    next(error);
  }
}
