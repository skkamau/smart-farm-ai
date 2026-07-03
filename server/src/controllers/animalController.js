import { body } from "express-validator";
import Animal from "../models/Animal.js";
import BirthRecord from "../models/BirthRecord.js";
import BreedingRecord from "../models/BreedingRecord.js";
import HealthRecord from "../models/HealthRecord.js";
import VaccinationRecord from "../models/VaccinationRecord.js";
import { ensureAnimalQr, extractQrCodeId } from "../utils/qr.js";
import { normalizeVaccination } from "../utils/vaccinations.js";

export const animalRules = [
  body("animalId").trim().notEmpty().withMessage("Animal ID is required"),
  body("species").trim().notEmpty().withMessage("Species is required"),
  body("weight").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("estimatedValue").optional({ values: "falsy" }).isFloat({ min: 0 })
];

function animalPayload(body) {
  const allowed = [
    "animalId",
    "name",
    "species",
    "breed",
    "gender",
    "dateOfBirth",
    "weight",
    "location",
    "status",
    "estimatedValue",
    "notes"
  ];
  return allowed.reduce((payload, key) => {
    if (body[key] !== undefined) payload[key] = body[key];
    return payload;
  }, {});
}

export async function listAnimals(req, res, next) {
  try {
    const { search = "", status = "", species = "" } = req.query;
    const query = { user: req.user._id };
    if (status) query.status = status;
    if (species) query.species = new RegExp(species, "i");
    if (search) {
      query.$or = [
        { animalId: new RegExp(search, "i") },
        { name: new RegExp(search, "i") },
        { breed: new RegExp(search, "i") },
        { species: new RegExp(search, "i") }
      ];
    }
    const animals = await Animal.find(query).sort({ createdAt: -1 });
    await Promise.all(animals.map((animal) => ensureAnimalQr(animal)));
    res.json(animals);
  } catch (error) {
    next(error);
  }
}

export async function getAnimal(req, res, next) {
  try {
    const animal = await Animal.findOne({ _id: req.params.id, user: req.user._id });
    if (!animal) return res.status(404).json({ message: "Animal not found" });
    await ensureAnimalQr(animal);
    const [healthRecords, vaccinationRecords] = await Promise.all([
      HealthRecord.find({ animal: animal._id, user: req.user._id }).sort({ recordDate: -1 }),
      VaccinationRecord.find({ animal: animal._id, user: req.user._id }).sort({ nextDueDate: 1, dateGiven: -1 })
    ]);
    const siblingQuery = [
      ...(animal.mother ? [{ mother: animal.mother }] : []),
      ...(animal.father ? [{ father: animal.father }] : [])
    ];
    const [mother, father, children, siblings, breedingRecords, birthRecords] = await Promise.all([
      animal.mother ? Animal.findOne({ _id: animal.mother, user: req.user._id }).select("animalId name species gender") : null,
      animal.father ? Animal.findOne({ _id: animal.father, user: req.user._id }).select("animalId name species gender") : null,
      Animal.find({ user: req.user._id, _id: { $in: animal.children || [] } }).select("animalId name species gender"),
      siblingQuery.length
        ? Animal.find({ user: req.user._id, _id: { $ne: animal._id }, $or: siblingQuery }).select("animalId name species gender mother father")
        : [],
      BreedingRecord.find({ user: req.user._id, $or: [{ femaleAnimal: animal._id }, { maleAnimal: animal._id }] })
        .populate("femaleAnimal", "animalId name species")
        .populate("maleAnimal", "animalId name species")
        .sort({ matingDate: -1 }),
      BirthRecord.find({ user: req.user._id, $or: [{ mother: animal._id }, { father: animal._id }, { offspring: animal._id }] })
        .populate("mother", "animalId name species")
        .populate("father", "animalId name species")
        .populate("offspring", "animalId name species")
        .sort({ birthDate: -1 })
    ]);
    const normalizedVaccinations = await Promise.all(vaccinationRecords.map((record) => normalizeVaccination(record)));
    res.json({
      ...animal.toObject(),
      family: {
        mother,
        father,
        children,
        siblings: siblings.filter((sibling) => Boolean(animal.mother || animal.father)),
        offspringCount: children.length
      },
      breedingRecords,
      birthRecords,
      healthRecords,
      vaccinationRecords: normalizedVaccinations,
      upcomingVaccinations: normalizedVaccinations.filter((record) => record.status === "upcoming"),
      overdueVaccinations: normalizedVaccinations.filter((record) => record.status === "overdue")
    });
  } catch (error) {
    next(error);
  }
}

export async function getAnimalByQr(req, res, next) {
  try {
    const qrCodeId = extractQrCodeId(req.params.qrCodeId);
    const animal = await Animal.findOne({ qrCodeId, user: req.user._id });
    if (!animal) return res.status(404).json({ message: "Animal not found for this QR code" });
    await ensureAnimalQr(animal);
    res.json(animal);
  } catch (error) {
    next(error);
  }
}

export async function createAnimal(req, res, next) {
  try {
    const animal = await Animal.create({ ...animalPayload(req.body), user: req.user._id });
    res.status(201).json(animal);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "Animal ID already exists" });
    next(error);
  }
}

export async function updateAnimal(req, res, next) {
  try {
    const animal = await Animal.findOne({ _id: req.params.id, user: req.user._id });
    if (!animal) return res.status(404).json({ message: "Animal not found" });
    Object.assign(animal, animalPayload(req.body));
    await ensureAnimalQr(animal);
    await animal.save();
    res.json(animal);
  } catch (error) {
    next(error);
  }
}

export async function deleteAnimal(req, res, next) {
  try {
    const animal = await Animal.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!animal) return res.status(404).json({ message: "Animal not found" });
    res.json({ message: "Animal deleted" });
  } catch (error) {
    next(error);
  }
}
