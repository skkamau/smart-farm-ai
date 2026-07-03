import express from "express";
import { animalRules, createAnimal, deleteAnimal, listAnimals, updateAnimal } from "../controllers/animalController.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();

router.use(protect);
router.route("/").get(listAnimals).post(animalRules, validate, createAnimal);
router.route("/:id").put(animalRules, validate, updateAnimal).delete(deleteAnimal);

export default router;
