import { body } from "express-validator";
import Animal from "../models/Animal.js";
import BirthRecord from "../models/BirthRecord.js";
import BreedingRecord from "../models/BreedingRecord.js";
import HealthRecord from "../models/HealthRecord.js";
import VaccinationRecord from "../models/VaccinationRecord.js";
import { ensureAnimalQr, extractQrCodeId } from "../utils/qr.js";
import { normalizeVaccination } from "../utils/vaccinations.js";

const animalStatuses = ["Healthy", "Sick", "Pregnant", "Sold", "Transferred", "Archived", "Deceased"];
const deathCauses = ["Disease", "Injury", "Accident", "Birth complications", "Old age", "Predation", "Poisoning", "Unknown", "Other"];

export const animalRules = [
  body("animalId").trim().notEmpty().withMessage("Animal ID is required"),
  body("species").trim().notEmpty().withMessage("Species is required"),
  body("weight").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("estimatedValue").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("status").optional().isIn(animalStatuses).withMessage("Choose a valid animal status"),
  body("dateOfDeath").if(body("status").equals("Deceased")).notEmpty().withMessage("Date of death is required").bail().isISO8601().withMessage("Enter a valid date of death"),
  body("causeOfDeath").optional({ values: "falsy" }).isIn(deathCauses).withMessage("Choose a valid cause of death"),
  body("customCauseOfDeath").if(body("causeOfDeath").equals("Other")).trim().notEmpty().withMessage("Enter the custom cause of death")
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
    "notes",
    "dateOfDeath",
    "causeOfDeath",
    "customCauseOfDeath",
    "deathNotes",
    "veterinaryConfirmation",
    "deathAttachmentId"
  ];
  return allowed.reduce((payload, key) => {
    if (body[key] !== undefined) payload[key] = body[key];
    return payload;
  }, {});
}

function safeRegex(value) {
  const text = String(value || "").slice(0, 80);
  return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

export async function listAnimals(req, res, next) {
  try {
    const { search = "", status = "", species = "" } = req.query;
    const query = { user: req.user._id };
    if (status) query.status = status;
    if (species) query.species = safeRegex(species);
    if (search) {
      const regex = safeRegex(search);
      query.$or = [
        { animalId: regex },
        { name: regex },
        { breed: regex },
        { species: regex }
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
    await animal.populate("deathRecordedBy", "name email");
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
    const applicableVaccinations = animal.status === "Deceased" ? [] : normalizedVaccinations;
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
      upcomingVaccinations: applicableVaccinations.filter((record) => record.status === "upcoming"),
      overdueVaccinations: applicableVaccinations.filter((record) => record.status === "overdue")
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
    const data = animalPayload(req.body);
    if (data.status === "Deceased") data.deathRecordedBy = req.user._id;
    const animal = await Animal.create({ ...data, user: req.user._id, statusChangedAt: new Date() });
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
    const data = animalPayload(req.body);
    const previousStatus = animal.status;
    if (previousStatus === "Deceased" && data.status && data.status !== "Deceased" && req.body.confirmStatusCorrection !== true) {
      return res.status(400).json({ message: "Confirm that you want to correct this animal's Deceased status" });
    }
    if (data.deathAttachmentId) {
      const Document = (await import("../models/Document.js")).default;
      const owned = await Document.exists({ _id: data.deathAttachmentId, user: req.user._id, entityType: "animal", entityId: animal._id });
      if (!owned) return res.status(400).json({ message: "Death attachment was not found for this animal" });
    }
    if (data.status === "Deceased") data.deathRecordedBy = req.user._id;
    if (data.status && data.status !== previousStatus) {
      animal.statusHistory.push({ from: previousStatus, to: data.status, changedBy: req.user._id, reason: String(req.body.statusChangeReason || "").trim() });
      data.statusChangedAt = new Date();
    }
    Object.assign(animal, data);
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
