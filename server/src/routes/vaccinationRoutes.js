import express from "express";
import {
  createVaccination,
  deleteVaccination,
  listVaccinations,
  updateVaccination,
  vaccinationRules
} from "../controllers/vaccinationController.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { mongoIdParam, optionalMongoIdQuery } from "../middleware/validators.js";

const router = express.Router();

router.use(protect);
router.route("/").get(optionalMongoIdQuery("animal"), validate, listVaccinations).post(vaccinationRules, validate, createVaccination);
router.route("/:id").put(mongoIdParam(), vaccinationRules, validate, updateVaccination).delete(mongoIdParam(), validate, deleteVaccination);

export default router;
