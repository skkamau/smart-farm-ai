import express from "express";
import { exportReport } from "../controllers/reportController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.get("/:type/:format", protect, exportReport);

export default router;
