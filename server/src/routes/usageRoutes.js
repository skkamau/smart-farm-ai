import express from "express";
import { recordUsage } from "../controllers/usageController.js";
import { protect } from "../middleware/auth.js";
import { analyticsLimiter } from "../middleware/rateLimits.js";

const router = express.Router();
router.post("/", protect, analyticsLimiter, recordUsage);

export default router;
