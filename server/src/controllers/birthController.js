import { body } from "express-validator";
import Animal from "../models/Animal.js";
import BirthRecord from "../models/BirthRecord.js";

export const birthRules = [
  body("mother").isMongoId().withMessage("Mother is required"),
  body("father").isMongoId().withMessage("Father is required"),
  body("birthDate").isISO8601().toDate().withMessage("Birth date is required"),
  body("numberOfOffspring").isInt({ min: 1 }).withMessage("Number of offspring is required"),
  body("offspring").optional().isArray()
];

function payload(body) {
  const allowed = ["mother", "father", "birthDate", "numberOfOffspring", "offspring", "birthComplications", "vetNotes", "notes"];
  return allowed.reduce((out, key) => {
    if (body[key] !== undefined) out[key] = body[key] || (key === "offspring" ? [] : undefined);
    return out;
  }, {});
}

async function assertAnimals(user, ids) {
  const clean = [...new Set(ids.filter(Boolean).map(String))];
  const count = await Animal.countDocuments({ user, _id: { $in: clean } });
  return count === clean.length;
}

async function linkFamily(user, record) {
  const offspring = record.offspring || [];
  if (!offspring.length) return;
  const motherId = record.mother?._id || record.mother;
  const fatherId = record.father?._id || record.father;
  const offspringIds = offspring.map((animal) => animal?._id || animal);
  await Animal.updateMany({ user, _id: { $in: offspringIds } }, { $set: { mother: motherId, father: fatherId } });
  await Animal.updateOne({ user, _id: motherId }, { $addToSet: { children: { $each: offspringIds } }, $set: { reproductiveStatus: "postpartum" } });
  await Animal.updateOne({ user, _id: fatherId }, { $addToSet: { children: { $each: offspringIds } } });
}

export async function listBirthRecords(req, res, next) {
  try {
    const query = { user: req.user._id };
    if (req.query.animal) query.$or = [{ mother: req.query.animal }, { father: req.query.animal }, { offspring: req.query.animal }];
    const records = await BirthRecord.find(query)
      .populate("mother", "animalId name species")
      .populate("father", "animalId name species")
      .populate("offspring", "animalId name species")
      .sort({ birthDate: -1 });
    res.json(records);
  } catch (error) {
    next(error);
  }
}

export async function createBirthRecord(req, res, next) {
  try {
    const data = payload(req.body);
    if (!(await assertAnimals(req.user._id, [data.mother, data.father, ...(data.offspring || [])]))) {
      return res.status(404).json({ message: "One or more animals were not found" });
    }
    const record = await BirthRecord.create({ ...data, user: req.user._id });
    await linkFamily(req.user._id, record);
    res.status(201).json(await record.populate([{ path: "mother", select: "animalId name species" }, { path: "father", select: "animalId name species" }, { path: "offspring", select: "animalId name species" }]));
  } catch (error) {
    next(error);
  }
}

export async function updateBirthRecord(req, res, next) {
  try {
    const data = payload(req.body);
    if (!(await assertAnimals(req.user._id, [data.mother, data.father, ...(data.offspring || [])]))) {
      return res.status(404).json({ message: "One or more animals were not found" });
    }
    const record = await BirthRecord.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, data, { new: true, runValidators: true })
      .populate("mother", "animalId name species")
      .populate("father", "animalId name species")
      .populate("offspring", "animalId name species");
    if (!record) return res.status(404).json({ message: "Birth record not found" });
    await linkFamily(req.user._id, record);
    res.json(record);
  } catch (error) {
    next(error);
  }
}

export async function deleteBirthRecord(req, res, next) {
  try {
    const record = await BirthRecord.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!record) return res.status(404).json({ message: "Birth record not found" });
    res.json({ message: "Birth record deleted" });
  } catch (error) {
    next(error);
  }
}
