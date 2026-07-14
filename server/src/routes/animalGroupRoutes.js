import express from "express";
import { archiveAnimalGroup, createAnimalGroup, createQuantityEvent, eventRules, getAnimalGroup, groupRules, listAnimalGroups, updateAnimalGroup, updateGroupRules } from "../controllers/animalGroupController.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { mongoIdParam } from "../middleware/validators.js";

const router = express.Router();
router.use(protect);
router.route("/").get(listAnimalGroups).post(groupRules, validate, createAnimalGroup);
router.post("/:id/events", mongoIdParam(), eventRules, validate, createQuantityEvent);
router.patch("/:id/archive", mongoIdParam(), validate, archiveAnimalGroup);
router.route("/:id").get(getAnimalGroup).put(mongoIdParam(), updateGroupRules, validate, updateAnimalGroup);

export default router;
