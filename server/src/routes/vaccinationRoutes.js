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

const router = express.Router();

router.use(protect);
router.route("/").get(listVaccinations).post(vaccinationRules, validate, createVaccination);
router.route("/:id").put(vaccinationRules, validate, updateVaccination).delete(deleteVaccination);

export default router;
