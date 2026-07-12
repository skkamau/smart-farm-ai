import express from "express";
import { animalRules, createAnimal, deleteAnimal, getAnimal, getAnimalByQr, listAnimals, updateAnimal, updateHealthStatus, updateLifecycleStatus, updateReproductiveStatus } from "../controllers/animalController.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { mongoIdParam } from "../middleware/validators.js";

const router = express.Router();

router.use(protect);
router.route("/").get(listAnimals).post(animalRules, validate, createAnimal);
router.get("/qr/:qrCodeId", getAnimalByQr);
router.patch("/:id/health-status", mongoIdParam(), validate, updateHealthStatus);
router.patch("/:id/lifecycle-status", mongoIdParam(), validate, updateLifecycleStatus);
router.patch("/:id/reproductive-status", mongoIdParam(), validate, updateReproductiveStatus);
router.route("/:id").get(mongoIdParam(), validate, getAnimal).put(mongoIdParam(), animalRules, validate, updateAnimal).delete(mongoIdParam(), validate, deleteAnimal);

export default router;
