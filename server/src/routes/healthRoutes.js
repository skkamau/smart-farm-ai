import express from "express";
import { createHealthRecord, deleteHealthRecord, healthRules, listHealthRecords, updateHealthRecord } from "../controllers/healthController.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();

router.use(protect);
router.route("/").get(listHealthRecords).post(healthRules, validate, createHealthRecord);
router.route("/:id").put(healthRules, validate, updateHealthRecord).delete(deleteHealthRecord);

export default router;
