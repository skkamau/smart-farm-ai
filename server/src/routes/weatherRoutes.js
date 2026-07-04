import express from "express";
import { createWeather, deleteWeather, listWeather, updateWeather, weatherRules } from "../controllers/weatherController.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();

router.use(protect);
router.route("/").get(listWeather).post(weatherRules, validate, createWeather);
router.route("/:id").put(weatherRules, validate, updateWeather).delete(deleteWeather);

export default router;
