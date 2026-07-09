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

const weatherCodeMap = {
  0: "Sunny",
  1: "Sunny",
  2: "Cloudy",
  3: "Cloudy",
  45: "Foggy",
  48: "Foggy",
  51: "Rainy",
  53: "Rainy",
  55: "Rainy",
  61: "Rainy",
  63: "Rainy",
  65: "Rainy",
  80: "Rainy",
  81: "Rainy",
  82: "Rainy",
  95: "Stormy",
  96: "Stormy",
  99: "Stormy"
};

function conditionFromCode(code) {
  return weatherCodeMap[code] || "Cloudy";
}

function impactFromWeather({ condition, rainfall, windSpeed }) {
  if (condition === "Stormy" || rainfall >= 25 || windSpeed >= 45) return "high";
  if (rainfall >= 10 || windSpeed >= 25 || condition === "Rainy") return "medium";
  if (rainfall > 0 || condition === "Windy") return "low";
  return "none";
}

function numberOrUndefined(value) {
  return value === null || value === undefined ? undefined : Number(value);
}

function payload(body) {
  const allowed = ["recordDate", "condition", "temperature", "rainfall", "humidity", "windSpeed", "impact", "notes"];
  return allowed.reduce((out, key) => {
    if (body[key] !== undefined) out[key] = body[key];
    return out;
  }, {});
}

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
    const record = await WeatherRecord.create({ ...payload(req.body), user: req.user._id });
    res.status(201).json(record);
  } catch (error) {
    next(error);
  }
}

export async function importCurrentWeather(req, res, next) {
  try {
    const latitude = Number(req.body.latitude || process.env.WEATHER_LAT || -1.286389);
    const longitude = Number(req.body.longitude || process.env.WEATHER_LON || 36.817223);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ message: "Valid latitude and longitude are required" });
    }

    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("current", "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m");
    url.searchParams.set("timezone", "auto");

    const response = await fetch(url);
    if (!response.ok) return res.status(502).json({ message: "Could not fetch weather from Open-Meteo" });
    const data = await response.json();
    const current = data.current || {};
    const condition = conditionFromCode(current.weather_code);
    const rainfall = numberOrUndefined(current.precipitation) ?? 0;
    const windSpeed = numberOrUndefined(current.wind_speed_10m);
    const impact = impactFromWeather({ condition, rainfall, windSpeed: windSpeed || 0 });

    const record = await WeatherRecord.create({
      user: req.user._id,
      recordDate: current.time ? new Date(current.time) : new Date(),
      condition,
      temperature: numberOrUndefined(current.temperature_2m),
      rainfall,
      humidity: numberOrUndefined(current.relative_humidity_2m),
      windSpeed,
      impact,
      notes: `Imported from Open-Meteo for ${latitude.toFixed(4)}, ${longitude.toFixed(4)}.`
    });

    res.status(201).json(record);
  } catch (error) {
    next(error);
  }
}

export async function updateWeather(req, res, next) {
  try {
    const record = await WeatherRecord.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, payload(req.body), {
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
