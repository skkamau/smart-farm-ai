import express from "express";
import {
  archiveInventoryItem, createInventoryItem, createMovement, deleteInventoryItem,
  itemRules, listAllMovements, listInventory, listMovements, movementRules,
  updateInventoryItem, updateMovement
} from "../controllers/inventoryController.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { mongoIdParam } from "../middleware/validators.js";

const router = express.Router();
router.use(protect);
router.route("/").get(listInventory).post(itemRules, validate, createInventoryItem);
router.get("/movements", listAllMovements);
router.route("/:id").put(mongoIdParam(), itemRules, validate, updateInventoryItem).delete(mongoIdParam(), validate, deleteInventoryItem);
router.post("/:id/movements", mongoIdParam(), movementRules, validate, createMovement);
router.get("/:id/movements", mongoIdParam(), validate, listMovements);
router.put("/:id/movements/:movementId", mongoIdParam(), mongoIdParam("movementId"), movementRules, validate, updateMovement);
router.patch("/:id/archive", mongoIdParam(), validate, archiveInventoryItem);

export default router;
