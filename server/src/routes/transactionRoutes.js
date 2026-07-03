import express from "express";
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  transactionRules,
  updateTransaction
} from "../controllers/transactionController.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();

router.use(protect);
router.route("/").get(listTransactions).post(transactionRules, validate, createTransaction);
router.route("/:id").put(transactionRules, validate, updateTransaction).delete(deleteTransaction);

export default router;
