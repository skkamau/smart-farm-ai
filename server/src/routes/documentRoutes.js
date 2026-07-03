import express from "express";
import { deleteDocument, listDocuments, uploadDocument } from "../controllers/documentController.js";
import { protect } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

router.use(protect);
router.get("/", listDocuments);
router.post("/", upload.single("file"), uploadDocument);
router.delete("/:id", deleteDocument);

export default router;
