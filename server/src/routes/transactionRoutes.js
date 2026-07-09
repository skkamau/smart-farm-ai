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
import { mongoIdParam, optionalMongoIdQuery } from "../middleware/validators.js";

const router = express.Router();

router.use(protect);
router.route("/").get(optionalMongoIdQuery("crop"), optionalMongoIdQuery("animal"), validate, listTransactions).post(transactionRules, validate, createTransaction);
router.route("/:id").put(mongoIdParam(), transactionRules, validate, updateTransaction).delete(mongoIdParam(), validate, deleteTransaction);

export default router;
