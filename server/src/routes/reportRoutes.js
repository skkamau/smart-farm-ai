import express from "express";
import { exportAnimalRecord, exportCropRecord, exportReport } from "../controllers/reportController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.get("/:type/:format", protect, exportReport);
router.get("/animal/:id/pdf", protect, exportAnimalRecord);
router.get("/crop/:id/pdf", protect, exportCropRecord);

export default router;
