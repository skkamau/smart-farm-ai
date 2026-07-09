import express from "express";
import { breedingRules, createBreedingRecord, deleteBreedingRecord, listBreedingRecords, updateBreedingRecord } from "../controllers/breedingController.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { mongoIdParam, optionalMongoIdQuery } from "../middleware/validators.js";

const router = express.Router();

router.use(protect);
router.route("/").get(optionalMongoIdQuery("animal"), validate, listBreedingRecords).post(breedingRules, validate, createBreedingRecord);
router.route("/:id").put(mongoIdParam(), breedingRules, validate, updateBreedingRecord).delete(mongoIdParam(), validate, deleteBreedingRecord);

export default router;
