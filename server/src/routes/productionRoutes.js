import express from "express";
import { createProductionRecord, getProductionRecord, listProductionRecords, productionOverview, productionRules } from "../controllers/productionController.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { mongoIdParam } from "../middleware/validators.js";

const router = express.Router();
router.use(protect);
router.get("/overview", productionOverview);
router.route("/").get(listProductionRecords).post(productionRules, validate, createProductionRecord);
router.get("/:id", mongoIdParam(), validate, getProductionRecord);

export default router;
