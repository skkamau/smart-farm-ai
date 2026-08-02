import express from "express";
import { availableProduce, createProductionRecord, createProductionRemoval, getProductionRecord, listProductionRecords, listProductionRemovals, productionOverview, productionRules, removalRules, reversalRules, reverseProductionRecord, transferProductionRecord, transferRules, updateProductionRecord } from "../controllers/productionController.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { mongoIdParam } from "../middleware/validators.js";

const router = express.Router();
router.use(protect);
router.get("/overview", productionOverview);
router.get("/available", availableProduce);
router.get("/removals", listProductionRemovals);
router.route("/").get(listProductionRecords).post(productionRules, validate, createProductionRecord);
router.route("/:id").get(mongoIdParam(), validate, getProductionRecord).put(mongoIdParam(), productionRules, validate, updateProductionRecord);
router.post("/:id/removals", mongoIdParam(), removalRules, validate, createProductionRemoval);
router.post("/:id/transfer", mongoIdParam(), transferRules, validate, transferProductionRecord);
router.post("/:id/reverse", mongoIdParam(), reversalRules, validate, reverseProductionRecord);

export default router;
