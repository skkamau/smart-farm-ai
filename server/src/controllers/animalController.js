import { body } from "express-validator";
import Animal from "../models/Animal.js";
import BirthRecord from "../models/BirthRecord.js";
import BreedingRecord from "../models/BreedingRecord.js";
import HealthRecord from "../models/HealthRecord.js";
import VaccinationRecord from "../models/VaccinationRecord.js";
import { ensureAnimalQr, extractQrCodeId } from "../utils/qr.js";
import { normalizeVaccination } from "../utils/vaccinations.js";
import { logActivity } from "../services/auditService.js";

const animalStatuses = ["Healthy", "Sick", "Pregnant", "Sold", "Transferred", "Archived", "Deceased"];
const deathCauses = ["Disease", "Injury", "Accident", "Birth complications", "Old age", "Predation", "Poisoning", "Unknown", "Other"];
export const lifecycleStatuses = ["active", "sold", "transferred", "archived", "deceased"];
export const healthStatuses = ["healthy", "sick", "recovering", "chronic", "referred", "unknown"];
export const reproductiveStatuses = ["not_pregnant", "pregnant", "postpartum", "nursing", "unknown"];

export const animalRules = [
  body("animalId").trim().notEmpty().withMessage("Animal ID is required"),
  body("species").trim().notEmpty().withMessage("Species is required"),
  body("gender").optional({ values: "falsy" }).isIn(["Female", "Male"]).withMessage("Choose Female or Male"),
  body("weight").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("estimatedValue").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("status").optional().isIn(animalStatuses).withMessage("Choose a valid animal status"),
  body("lifecycleStatus").optional().isIn(lifecycleStatuses).withMessage("Choose a valid lifecycle status"),
  body("healthStatus").optional().isIn(healthStatuses).withMessage("Choose a valid health status"),
  body("reproductiveStatus").optional().isIn(reproductiveStatuses).withMessage("Choose a valid reproductive status"),
  body("dateOfDeath").if(body("status").equals("Deceased")).notEmpty().withMessage("Date of death is required").bail().isISO8601().withMessage("Enter a valid date of death"),
  body("dateOfDeath").if(body("lifecycleStatus").equals("deceased")).notEmpty().withMessage("Date of death is required").bail().isISO8601().withMessage("Enter a valid date of death"),
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
    "lifecycleStatus",
    "healthStatus",
    "reproductiveStatus",
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
    if (status) query.lifecycleStatus = status;
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
    const applicableVaccinations = animal.lifecycleStatus === "deceased" ? [] : normalizedVaccinations;
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
    if (data.lifecycleStatus === "deceased" || data.status === "Deceased") data.deathRecordedBy = req.user._id;
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
    const previousStatus = animal.lifecycleStatus;
    if (data.lifecycleStatus && data.lifecycleStatus !== previousStatus && req.body.confirmLifecycleChange !== true) {
      return res.status(400).json({ message: "Confirm this lifecycle status change" });
    }
    if (previousStatus === "deceased" && data.lifecycleStatus && data.lifecycleStatus !== "deceased" && req.body.confirmStatusCorrection !== true) {
      return res.status(400).json({ message: "Confirm that you want to correct this animal's Deceased status" });
    }
    if (data.deathAttachmentId) {
      const Document = (await import("../models/Document.js")).default;
      const owned = await Document.exists({ _id: data.deathAttachmentId, user: req.user._id, entityType: "animal", entityId: animal._id });
      if (!owned) return res.status(400).json({ message: "Death attachment was not found for this animal" });
    }
    if (data.lifecycleStatus === "deceased") data.deathRecordedBy = req.user._id;
    if (data.lifecycleStatus && data.lifecycleStatus !== previousStatus) {
      animal.statusHistory.push({ from: previousStatus, to: data.lifecycleStatus, changedBy: req.user._id, reason: String(req.body.statusChangeReason || "").trim() });
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

async function updateOwnedStatus(req, res, next, field, allowed) {
  try {
    const animal = await Animal.findOne({ _id: req.params.id, user: req.user._id });
    if (!animal) return res.status(404).json({ message: "Animal not found" });
    const value = req.body[field];
    if (!allowed.includes(value)) return res.status(400).json({ message: `Choose a valid ${field}` });
    if (field === "healthStatus" && animal.lifecycleStatus === "deceased") {
      return res.status(409).json({ message: "Health status is not applicable to a deceased animal" });
    }
    if (field === "lifecycleStatus") {
      const sensitive = ["deceased", "sold", "transferred", "archived", "active"];
      if (sensitive.includes(value) && req.body.confirmed !== true) return res.status(400).json({ message: "Confirm this lifecycle status change" });
      if (value === "deceased" && !req.body.dateOfDeath) return res.status(400).json({ message: "Date of death is required" });
      if (value === "deceased") {
        animal.dateOfDeath = req.body.dateOfDeath;
        animal.causeOfDeath = req.body.causeOfDeath || "Unknown";
        animal.customCauseOfDeath = req.body.customCauseOfDeath || "";
        animal.deathNotes = req.body.deathNotes || "";
        animal.deathRecordedBy = req.user._id;
      }
    }
    const previous = animal[field];
    animal[field] = value;
    animal.statusChangedAt = new Date();
    animal.statusHistory.push({ from: previous, to: value, changedBy: req.user._id, reason: String(req.body.reason || "").trim() });
    await animal.save();
    await logActivity({ actorUser: req.user._id, actorRole: req.user.role || "user", action: "animal_status_changed", targetUser: req.user._id, targetType: "animal", targetId: animal._id, metadata: { field, previous, value } });
    await animal.populate("deathRecordedBy", "name email");
    res.json(animal);
  } catch (error) { next(error); }
}

export const updateHealthStatus = (req, res, next) => updateOwnedStatus(req, res, next, "healthStatus", healthStatuses);
export const updateLifecycleStatus = (req, res, next) => updateOwnedStatus(req, res, next, "lifecycleStatus", lifecycleStatuses);
export const updateReproductiveStatus = (req, res, next) => updateOwnedStatus(req, res, next, "reproductiveStatus", reproductiveStatuses);

export async function deleteAnimal(req, res, next) {
  try {
    const animal = await Animal.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!animal) return res.status(404).json({ message: "Animal not found" });
    res.json({ message: "Animal deleted" });
  } catch (error) {
    next(error);
  }
}
