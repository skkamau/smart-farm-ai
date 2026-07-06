import express from "express";
import { exportAnimalRecord, exportBackup, exportCropRecord, exportReport, importBackup } from "../controllers/reportController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);
router.get("/backup/json", exportBackup);
router.post("/backup/import", importBackup);
router.get("/animal/:id/:format", exportAnimalRecord);
router.get("/crop/:id/:format", exportCropRecord);
router.get("/:type/:format", exportReport);

export default router;
