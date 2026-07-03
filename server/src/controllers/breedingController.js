import { body } from "express-validator";
import Animal from "../models/Animal.js";
import BreedingRecord from "../models/BreedingRecord.js";

export const breedingRules = [
  body("femaleAnimal").isMongoId().withMessage("Female animal is required"),
  body("maleAnimal").isMongoId().withMessage("Male animal is required"),
  body("matingDate").isISO8601().toDate().withMessage("Mating date is required"),
  body("pregnancyStatus").optional().isIn(["unknown", "not_pregnant", "pregnant", "delivered"]),
  body("breedingResult").optional().isIn(["successful", "failed", "pending"])
];

function payload(body) {
  const allowed = ["femaleAnimal", "maleAnimal", "matingDate", "pregnancyStatus", "expectedBirthDate", "actualBirthDate", "vetNotes", "breedingResult", "notes"];
  return allowed.reduce((out, key) => {
    if (body[key] !== undefined) out[key] = body[key] || undefined;
    return out;
  }, {});
}

async function assertAnimals(user, femaleAnimal, maleAnimal) {
  const animals = await Animal.find({ user, _id: { $in: [femaleAnimal, maleAnimal] } });
  return animals.length === 2;
}

async function syncFemaleStatus(user, record) {
  const female = await Animal.findOne({ _id: record.femaleAnimal, user });
  if (!female) return;
  if (record.pregnancyStatus === "pregnant" && female.status !== "Pregnant") {
    female.status = "Pregnant";
    await female.save();
  }
  if (record.pregnancyStatus === "delivered" && female.status === "Pregnant") {
    female.status = "Healthy";
    await female.save();
  }
}

export async function listBreedingRecords(req, res, next) {
  try {
    const query = { user: req.user._id };
    if (req.query.animal) query.$or = [{ femaleAnimal: req.query.animal }, { maleAnimal: req.query.animal }];
    const records = await BreedingRecord.find(query)
      .populate("femaleAnimal", "animalId name species status")
      .populate("maleAnimal", "animalId name species status")
      .sort({ matingDate: -1 });
    res.json(records);
  } catch (error) {
    next(error);
  }
}

export async function createBreedingRecord(req, res, next) {
  try {
    if (!(await assertAnimals(req.user._id, req.body.femaleAnimal, req.body.maleAnimal))) {
      return res.status(404).json({ message: "Female or male animal not found" });
    }
    const record = await BreedingRecord.create({ ...payload(req.body), user: req.user._id });
    await syncFemaleStatus(req.user._id, record);
    res.status(201).json(await record.populate([{ path: "femaleAnimal", select: "animalId name species status" }, { path: "maleAnimal", select: "animalId name species status" }]));
  } catch (error) {
    next(error);
  }
}

export async function updateBreedingRecord(req, res, next) {
  try {
    if (req.body.femaleAnimal && req.body.maleAnimal && !(await assertAnimals(req.user._id, req.body.femaleAnimal, req.body.maleAnimal))) {
      return res.status(404).json({ message: "Female or male animal not found" });
    }
    const record = await BreedingRecord.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, payload(req.body), { new: true, runValidators: true })
      .populate("femaleAnimal", "animalId name species status")
      .populate("maleAnimal", "animalId name species status");
    if (!record) return res.status(404).json({ message: "Breeding record not found" });
    await syncFemaleStatus(req.user._id, record);
    res.json(record);
  } catch (error) {
    next(error);
  }
}

export async function deleteBreedingRecord(req, res, next) {
  try {
    const record = await BreedingRecord.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!record) return res.status(404).json({ message: "Breeding record not found" });
    res.json({ message: "Breeding record deleted" });
  } catch (error) {
    next(error);
  }
}
