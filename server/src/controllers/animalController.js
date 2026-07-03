import { body } from "express-validator";
import Animal from "../models/Animal.js";
import { ensureAnimalQr, extractQrCodeId } from "../utils/qr.js";

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
    res.json(animal);
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
