import express from "express";
import { birthRules, createBirthRecord, deleteBirthRecord, listBirthRecords, updateBirthRecord } from "../controllers/birthController.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();

router.use(protect);
router.route("/").get(listBirthRecords).post(birthRules, validate, createBirthRecord);
router.route("/:id").put(birthRules, validate, updateBirthRecord).delete(deleteBirthRecord);

export default router;
