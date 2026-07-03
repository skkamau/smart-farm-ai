import { body } from "express-validator";
import Transaction from "../models/Transaction.js";

export const transactionRules = [
  body("type").isIn(["income", "expense"]).withMessage("Type must be income or expense"),
  body("amount").isFloat({ min: 0.01 }).withMessage("Amount must be greater than zero"),
  body("description").trim().notEmpty().withMessage("Description is required")
];

export async function listTransactions(req, res, next) {
  try {
    const type = req.query.type;
    const query = { user: req.user._id };
    if (type) query.type = type;
    const transactions = await Transaction.find(query).sort({ transactionDate: -1, createdAt: -1 });
    res.json(transactions);
  } catch (error) {
    next(error);
  }
}

export async function createTransaction(req, res, next) {
  try {
    const transaction = await Transaction.create({ ...req.body, user: req.user._id });
    res.status(201).json(transaction);
  } catch (error) {
    next(error);
  }
}

export async function updateTransaction(req, res, next) {
  try {
    const transaction = await Transaction.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, req.body, {
      new: true,
      runValidators: true
    });
    if (!transaction) return res.status(404).json({ message: "Transaction not found" });
    res.json(transaction);
  } catch (error) {
    next(error);
  }
}

export async function deleteTransaction(req, res, next) {
  try {
    const transaction = await Transaction.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!transaction) return res.status(404).json({ message: "Transaction not found" });
    res.json({ message: "Transaction deleted" });
  } catch (error) {
    next(error);
  }
}
