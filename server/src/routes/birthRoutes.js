import express from "express";
import { birthRules, createBirthRecord, deleteBirthRecord, listBirthRecords, updateBirthRecord } from "../controllers/birthController.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { mongoIdParam, optionalMongoIdQuery } from "../middleware/validators.js";

const router = express.Router();

router.use(protect);
router.route("/").get(optionalMongoIdQuery("animal"), validate, listBirthRecords).post(birthRules, validate, createBirthRecord);
router.route("/:id").put(mongoIdParam(), birthRules, validate, updateBirthRecord).delete(mongoIdParam(), validate, deleteBirthRecord);

export default router;
