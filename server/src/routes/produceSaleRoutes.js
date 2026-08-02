import express from "express";
import {
  cancelProduceSaleRecord, createProduceSaleRecord, downloadSaleReceipt, getProduceSale,
  listProduceSales, productionSalesCsv, productionSalesReport, reasonRules, recordSalePayment,
  saleEditRules, salePaymentRules, saleRules, updateProduceSaleRecord, voidSaleReceipt
} from "../controllers/produceSaleController.js";
import { protect } from "../middleware/auth.js";
import { sensitiveApiLimiter } from "../middleware/rateLimits.js";
import { validate } from "../middleware/validate.js";
import { mongoIdParam } from "../middleware/validators.js";

const router = express.Router();
router.use(protect);

router.get("/reports/summary", productionSalesReport);
router.get("/reports/csv", productionSalesCsv);
router.route("/").get(listProduceSales).post(saleRules, validate, createProduceSaleRecord);
router.route("/:id").get(mongoIdParam(), validate, getProduceSale).put(mongoIdParam(), saleEditRules, validate, updateProduceSaleRecord);
router.post("/:id/payments", sensitiveApiLimiter, mongoIdParam(), salePaymentRules, validate, recordSalePayment);
router.post("/:id/cancel", sensitiveApiLimiter, mongoIdParam(), reasonRules, validate, cancelProduceSaleRecord);
router.get("/:id/receipts/:receiptId/pdf", mongoIdParam(), mongoIdParam("receiptId"), validate, downloadSaleReceipt);
router.post("/:id/receipts/:receiptId/void", sensitiveApiLimiter, mongoIdParam(), mongoIdParam("receiptId"), reasonRules, validate, voidSaleReceipt);

export default router;
