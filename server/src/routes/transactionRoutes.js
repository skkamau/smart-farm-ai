import express from "express";
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  paymentRules,
  recordPayment,
  resetFinanceData,
  resetFinanceRules,
  reversalRules,
  reverseTransaction,
  transactionRules,
  updateTransaction
} from "../controllers/transactionController.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { mongoIdParam, optionalMongoIdQuery } from "../middleware/validators.js";
import { sensitiveApiLimiter } from "../middleware/rateLimits.js";

const router = express.Router();

router.use(protect);
router.route("/").get(optionalMongoIdQuery("crop"), optionalMongoIdQuery("animal"), validate, listTransactions).post(transactionRules, validate, createTransaction);
router.post("/reset", sensitiveApiLimiter, resetFinanceRules, validate, resetFinanceData);
router.route("/:id").put(mongoIdParam(), transactionRules, validate, updateTransaction).delete(mongoIdParam(), validate, deleteTransaction);
router.post("/:id/payments", mongoIdParam(), paymentRules, validate, recordPayment);
router.post("/:id/reverse", mongoIdParam(), reversalRules, validate, reverseTransaction);

export default router;
