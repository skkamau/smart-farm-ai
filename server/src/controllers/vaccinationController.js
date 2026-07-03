import { body } from "express-validator";
import Animal from "../models/Animal.js";
import VaccinationRecord from "../models/VaccinationRecord.js";
import { normalizeVaccination, resolveVaccinationStatus } from "../utils/vaccinations.js";

export const vaccinationRules = [
  body("animal").isMongoId().withMessage("Animal is required"),
  body("vaccineName").trim().notEmpty().withMessage("Vaccine name is required"),
  body("dateGiven").optional({ values: "falsy" }).isISO8601().toDate(),
  body("nextDueDate").optional({ values: "falsy" }).isISO8601().toDate(),
  body("status").optional().isIn(["completed", "upcoming", "overdue"])
];

function payload(body) {
  const allowed = ["animal", "vaccineName", "dateGiven", "nextDueDate", "vetName", "batchNumber", "status", "notes"];
  const out = allowed.reduce((value, key) => {
    if (body[key] !== undefined) value[key] = body[key];
    return value;
  }, {});
  out.status = resolveVaccinationStatus(out);
  return out;
}

async function assertAnimal(user, animalId) {
  return Animal.findOne({ _id: animalId, user });
}

export async function listVaccinations(req, res, next) {
  try {
    const query = { user: req.user._id };
    if (req.query.animal) query.animal = req.query.animal;
    let records = await VaccinationRecord.find(query).populate("animal", "animalId name species status").sort({ nextDueDate: 1, dateGiven: -1 });
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

    const record = await VaccinationRecord.create({ ...payload(req.body), user: req.user._id });
    res.status(201).json(await record.populate("animal", "animalId name species status"));
  } catch (error) {
    next(error);
  }
}

export async function updateVaccination(req, res, next) {
  try {
    if (req.body.animal && !(await assertAnimal(req.user._id, req.body.animal))) {
      return res.status(404).json({ message: "Animal not found" });
    }
    const record = await VaccinationRecord.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, payload(req.body), {
      new: true,
      runValidators: true
    }).populate("animal", "animalId name species status");
    if (!record) return res.status(404).json({ message: "Vaccination record not found" });
    res.json(record);
  } catch (error) {
    next(error);
  }
}

export async function deleteVaccination(req, res, next) {
  try {
    const record = await VaccinationRecord.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!record) return res.status(404).json({ message: "Vaccination record not found" });
    res.json({ message: "Vaccination record deleted" });
  } catch (error) {
    next(error);
  }
}
