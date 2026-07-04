import { body } from "express-validator";
import WeatherRecord from "../models/WeatherRecord.js";

export const weatherRules = [
  body("recordDate").optional({ values: "falsy" }).isISO8601().withMessage("Valid date is required"),
  body("condition").optional().isIn(["Sunny", "Cloudy", "Rainy", "Stormy", "Windy", "Cold", "Hot", "Foggy"]),
  body("temperature").optional({ values: "falsy" }).isFloat(),
  body("rainfall").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("humidity").optional({ values: "falsy" }).isFloat({ min: 0, max: 100 }),
  body("windSpeed").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("impact").optional().isIn(["none", "low", "medium", "high"])
];

export async function listWeather(req, res, next) {
  try {
    const records = await WeatherRecord.find({ user: req.user._id }).sort({ recordDate: -1 }).limit(90);
    res.json(records);
  } catch (error) {
    next(error);
  }
}

export async function createWeather(req, res, next) {
  try {
    const record = await WeatherRecord.create({ ...req.body, user: req.user._id });
    res.status(201).json(record);
  } catch (error) {
    next(error);
  }
}

export async function updateWeather(req, res, next) {
  try {
    const record = await WeatherRecord.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, req.body, {
      new: true,
      runValidators: true
    });
    if (!record) return res.status(404).json({ message: "Weather record not found" });
    res.json(record);
  } catch (error) {
    next(error);
  }
}

export async function deleteWeather(req, res, next) {
  try {
    const record = await WeatherRecord.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!record) return res.status(404).json({ message: "Weather record not found" });
    res.json({ message: "Weather record deleted" });
  } catch (error) {
    next(error);
  }
}
