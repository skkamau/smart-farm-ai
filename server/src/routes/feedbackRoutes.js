import express from "express";
import { createBugReport, downloadOwnScreenshot, listOwnBugReports } from "../controllers/feedbackController.js";
import { protect } from "../middleware/auth.js";
import { bugScreenshotUpload } from "../middleware/upload.js";
import { supportRequestLimiter } from "../middleware/rateLimits.js";
import { mongoIdParam } from "../middleware/validators.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();
router.use(protect);
router.get("/", listOwnBugReports);
router.post("/", supportRequestLimiter, bugScreenshotUpload.single("screenshot"), createBugReport);
router.get("/:id/screenshot", mongoIdParam(), validate, downloadOwnScreenshot);

export default router;
