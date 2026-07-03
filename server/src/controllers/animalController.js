import { body } from "express-validator";
import Animal from "../models/Animal.js";

export const animalRules = [
  body("animalId").trim().notEmpty().withMessage("Animal ID is required"),
  body("species").trim().notEmpty().withMessage("Species is required"),
  body("weight").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("estimatedValue").optional({ values: "falsy" }).isFloat({ min: 0 })
];

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
    res.json(animals);
  } catch (error) {
    next(error);
  }
}

export async function createAnimal(req, res, next) {
  try {
    const animal = await Animal.create({ ...req.body, user: req.user._id });
    res.status(201).json(animal);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "Animal ID already exists" });
    next(error);
  }
}

export async function updateAnimal(req, res, next) {
  try {
    const animal = await Animal.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, req.body, {
      new: true,
      runValidators: true
    });
    if (!animal) return res.status(404).json({ message: "Animal not found" });
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
