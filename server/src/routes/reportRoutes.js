import express from "express";
import { exportAnimalRecord, exportBackup, exportCropRecord, exportReport, importBackup } from "../controllers/reportController.js";
import { protect } from "../middleware/auth.js";
import { sensitiveApiLimiter } from "../middleware/rateLimits.js";
import { validate } from "../middleware/validate.js";
import { backupConfirmQuery, mongoIdParam, reportFormatParam } from "../middleware/validators.js";

const router = express.Router();

router.use(protect);
router.get("/backup/json", sensitiveApiLimiter, exportBackup);
router.post("/backup/import", sensitiveApiLimiter, backupConfirmQuery, validate, importBackup);
router.get("/animal/:id/:format", mongoIdParam(), reportFormatParam, validate, exportAnimalRecord);
router.get("/crop/:id/:format", mongoIdParam(), reportFormatParam, validate, exportCropRecord);
router.get("/:type/:format", reportFormatParam, validate, exportReport);

export default router;
