import express from "express";
import { createHealthRecord, deleteHealthRecord, healthRules, listHealthRecords, updateHealthRecord } from "../controllers/healthController.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { mongoIdParam, optionalMongoIdQuery } from "../middleware/validators.js";

const router = express.Router();

router.use(protect);
router.route("/").get(optionalMongoIdQuery("animal"), validate, listHealthRecords).post(healthRules, validate, createHealthRecord);
router.route("/:id").put(mongoIdParam(), healthRules, validate, updateHealthRecord).delete(mongoIdParam(), validate, deleteHealthRecord);

export default router;
