import express from "express";
import { breedingRules, createBreedingRecord, deleteBreedingRecord, listBreedingRecords, updateBreedingRecord } from "../controllers/breedingController.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();

router.use(protect);
router.route("/").get(listBreedingRecords).post(breedingRules, validate, createBreedingRecord);
router.route("/:id").put(breedingRules, validate, updateBreedingRecord).delete(deleteBreedingRecord);

export default router;
