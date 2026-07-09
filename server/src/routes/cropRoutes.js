import express from "express";
import { createCrop, cropRules, deleteCrop, listCrops, updateCrop } from "../controllers/cropController.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { mongoIdParam } from "../middleware/validators.js";

const router = express.Router();

router.use(protect);
router.route("/").get(listCrops).post(cropRules, validate, createCrop);
router.route("/:id").put(mongoIdParam(), cropRules, validate, updateCrop).delete(mongoIdParam(), validate, deleteCrop);

export default router;
