import express from "express";
import { createCrop, cropRules, deleteCrop, listCrops, updateCrop } from "../controllers/cropController.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();

router.use(protect);
router.route("/").get(listCrops).post(cropRules, validate, createCrop);
router.route("/:id").put(cropRules, validate, updateCrop).delete(deleteCrop);

export default router;
