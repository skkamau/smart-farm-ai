import express from "express";
import { deleteDocument, downloadDocument, listDocuments, uploadDocument } from "../controllers/documentController.js";
import { protect } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { sensitiveApiLimiter } from "../middleware/rateLimits.js";
import { validate } from "../middleware/validate.js";
import { mongoIdParam } from "../middleware/validators.js";

const router = express.Router();

router.use(protect);
router.get("/", listDocuments);
router.post("/", sensitiveApiLimiter, upload.single("file"), uploadDocument);
router.get("/:id/download", mongoIdParam(), validate, downloadDocument);
router.delete("/:id", mongoIdParam(), validate, deleteDocument);

export default router;
