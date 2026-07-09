import express from "express";
import { createWeather, deleteWeather, importCurrentWeather, listWeather, updateWeather, weatherRules } from "../controllers/weatherController.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { mongoIdParam } from "../middleware/validators.js";

const router = express.Router();

router.use(protect);
router.post("/import-current", importCurrentWeather);
router.route("/").get(listWeather).post(weatherRules, validate, createWeather);
router.route("/:id").put(mongoIdParam(), weatherRules, validate, updateWeather).delete(mongoIdParam(), validate, deleteWeather);

export default router;
