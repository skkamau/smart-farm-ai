import express from "express";
import { askAssistant, assistantRules, getAlerts, getRecommendations } from "../controllers/aiController.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();

router.use(protect);
router.get("/recommendations", getRecommendations);
router.get("/alerts", getAlerts);
router.post("/assistant", assistantRules, validate, askAssistant);

export default router;
