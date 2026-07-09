import { body } from "express-validator";
import Crop from "../models/Crop.js";

export const cropRules = [
  body("name").trim().notEmpty().withMessage("Crop name is required"),
  body("field").trim().notEmpty().withMessage("Field is required"),
  body("area").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("cost").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("revenue").optional({ values: "falsy" }).isFloat({ min: 0 })
];

function payload(body) {
  const allowed = ["name", "field", "plot", "area", "plantingDate", "harvestDate", "expectedYield", "actualYield", "cost", "revenue", "status", "notes"];
  return allowed.reduce((out, key) => {
    if (body[key] !== undefined) out[key] = body[key];
    return out;
  }, {});
}

export async function listCrops(req, res, next) {
  try {
    const crops = await Crop.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(crops);
  } catch (error) {
    next(error);
  }
}

export async function createCrop(req, res, next) {
  try {
    const crop = await Crop.create({ ...payload(req.body), user: req.user._id });
    res.status(201).json(crop);
  } catch (error) {
    next(error);
  }
}

export async function updateCrop(req, res, next) {
  try {
    const crop = await Crop.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, payload(req.body), {
      new: true,
      runValidators: true
    });
    if (!crop) return res.status(404).json({ message: "Crop not found" });
    res.json(crop);
  } catch (error) {
    next(error);
  }
}

export async function deleteCrop(req, res, next) {
  try {
    const crop = await Crop.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!crop) return res.status(404).json({ message: "Crop not found" });
    res.json({ message: "Crop deleted" });
  } catch (error) {
    next(error);
  }
}
