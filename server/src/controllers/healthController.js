import { body } from "express-validator";
import Animal from "../models/Animal.js";
import HealthRecord from "../models/HealthRecord.js";

export const healthRules = [
  body("animal").isMongoId().withMessage("Animal is required"),
  body("recordDate").optional({ values: "falsy" }).isISO8601().toDate(),
  body("condition").trim().notEmpty().withMessage("Condition or disease is required"),
  body("recoveryStatus").optional().isIn(["Open", "Recovering", "Recovered", "Chronic", "Referred"])
];

function payload(body) {
  const allowed = ["animal", "recordDate", "condition", "symptoms", "diagnosis", "treatment", "medication", "dosage", "vetName", "recoveryStatus", "notes"];
  return allowed.reduce((out, key) => {
    if (body[key] !== undefined) out[key] = body[key];
    return out;
  }, {});
}

async function assertAnimal(user, animalId) {
  const animal = await Animal.findOne({ _id: animalId, user });
  return animal;
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
    res.json(record);
  } catch (error) {
    next(error);
  }
}

export async function deleteHealthRecord(req, res, next) {
  try {
    const record = await HealthRecord.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!record) return res.status(404).json({ message: "Health record not found" });
    res.json({ message: "Health record deleted" });
  } catch (error) {
    next(error);
  }
}
