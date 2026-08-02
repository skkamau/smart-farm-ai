import { body } from "express-validator";
import ProduceSale from "../models/ProduceSale.js";
import ProductionRecord from "../models/ProductionRecord.js";
import SaleReceipt from "../models/SaleReceipt.js";
import StockMovement from "../models/StockMovement.js";
import Transaction from "../models/Transaction.js";
import { buildReceiptView, createReceiptPdf, safeReceiptFilename } from "../services/receiptDocumentService.js";
import { cancelProduceSale, createProduceSale, recordProduceSalePayment, updateProduceSale, voidSaleReceiptPayment } from "../services/produceSaleService.js";

const saleUnits = ["egg", "dozen", "tray", "crate", "litre", "millilitre", "kilogram", "tonne", "bag", "piece", "other"];
const paymentMethods = ["Cash", "M-Pesa", "Mpesa", "Bank transfer", "Bank Transfer", "Card", "Credit", "Other"];

export const saleRules = [
  body("productionRecord").isMongoId().withMessage("Choose an available production batch"),
  body("saleUnit").isIn(saleUnits).withMessage("Choose a supported sales unit"),
  body("quantity").isFloat({ gt: 0 }).withMessage("Quantity must be greater than zero"),
  body("unitPrice").isFloat({ min: 0 }).withMessage("Unit price cannot be negative"),
  body("conversionToBase").optional({ values: "falsy" }).isFloat({ gt: 0 }),
  body("saleDate").isISO8601().withMessage("Enter a valid sale date"),
  body("dueDate").optional({ values: "falsy" }).isISO8601().withMessage("Enter a valid due date"),
  body("customer").optional({ values: "falsy" }).trim().isLength({ max: 160 }),
  body("customerPhone").optional({ values: "falsy" }).trim().isLength({ max: 80 }),
  body("notes").optional({ values: "falsy" }).trim().isLength({ max: 2000 }),
  body("idempotencyKey").trim().notEmpty().isLength({ max: 120 }).withMessage("A valid submission key is required"),
  body("amountReceived").optional({ values: "falsy" }).isFloat({ gt: 0 }),
  body("paymentMethod").optional({ values: "falsy" }).isIn(paymentMethods)
];

export const saleEditRules = saleRules.slice(1, 10);

export const salePaymentRules = [
  body("amount").isFloat({ gt: 0 }).withMessage("Payment amount must be greater than zero"),
  body("paymentDate").optional({ values: "falsy" }).isISO8601().withMessage("Enter a valid payment date"),
  body("paymentMethod").isIn(paymentMethods).withMessage("Choose a payment method"),
  body("referenceNumber").optional({ values: "falsy" }).trim().isLength({ max: 160 }),
  body("notes").optional({ values: "falsy" }).trim().isLength({ max: 1000 }),
  body("idempotencyKey").trim().notEmpty().isLength({ max: 120 }).withMessage("A valid submission key is required")
];

export const reasonRules = [body("reason").trim().isLength({ min: 3, max: 500 }).withMessage("Enter a reason")];

function salePopulate(query) {
  return query
    .populate("productionRecord", "batchReference sourceLabel productionDate expiryDate storageLocation")
    .populate("financeTransaction", "transactionId amount amountPaid amountOutstanding paymentStatus paymentMethod payments reversedAt")
    .populate("createdBy", "name");
}

async function saleView(sale, userId) {
  const populated = await salePopulate(ProduceSale.findOne({ _id: sale._id || sale, user: userId }));
  if (!populated) return null;
  const receipts = await SaleReceipt.find({ user: userId, sale: populated._id })
    .populate("issuedBy", "name").populate("voidedBy", "name")
    .sort({ paymentDate: -1, createdAt: -1 });
  return { ...populated.toObject(), receipts };
}

export async function listProduceSales(req, res, next) {
  try {
    const query = { user: req.user._id };
    if (["confirmed", "cancelled"].includes(req.query.status)) query.status = req.query.status;
    if (req.query.from || req.query.to) {
      query.saleDate = {};
      if (req.query.from) query.saleDate.$gte = new Date(req.query.from);
      if (req.query.to) { const end = new Date(req.query.to); end.setHours(23, 59, 59, 999); query.saleDate.$lte = end; }
    }
    const sales = await salePopulate(ProduceSale.find(query).sort({ saleDate: -1, createdAt: -1 }).limit(500));
    res.json(sales);
  } catch (error) { next(error); }
}

export async function getProduceSale(req, res, next) {
  try {
    const sale = await saleView(req.params.id, req.user._id);
    if (!sale) return res.status(404).json({ message: "Sale not found" });
    res.json(sale);
  } catch (error) { next(error); }
}

export async function createProduceSaleRecord(req, res, next) {
  try {
    const sale = await createProduceSale(req.user._id, req.body);
    let receipt = null;
    if (Number(req.body.amountReceived || 0) > 0) {
      const paymentKey = `${req.body.idempotencyKey}:initial-payment`;
      const payableSale = await ProduceSale.findOne({ _id: sale._id, user: req.user._id }).select("+paymentVersion");
      receipt = await recordProduceSalePayment(payableSale, {
        amount: Number(req.body.amountReceived), paymentDate: req.body.saleDate,
        paymentMethod: req.body.paymentMethod || "Cash", referenceNumber: req.body.referenceNumber,
        idempotencyKey: paymentKey
      }, req.user._id);
    }
    res.status(201).json({ sale: await saleView(sale, req.user._id), receipt });
  } catch (error) { next(error); }
}

export async function updateProduceSaleRecord(req, res, next) {
  try {
    const sale = await ProduceSale.findOne({ _id: req.params.id, user: req.user._id });
    if (!sale) return res.status(404).json({ message: "Sale not found" });
    req.body.productionRecord = String(sale.productionRecord);
    const updated = await updateProduceSale(sale, req.body, req.user._id);
    res.json(await saleView(updated, req.user._id));
  } catch (error) { next(error); }
}

export async function recordSalePayment(req, res, next) {
  try {
    const sale = await ProduceSale.findOne({ _id: req.params.id, user: req.user._id, status: "confirmed" }).select("+paymentVersion");
    if (!sale) return res.status(404).json({ message: "Active sale not found" });
    const receipt = await recordProduceSalePayment(sale, req.body, req.user._id);
    res.status(201).json({ receipt, sale: await saleView(sale, req.user._id) });
  } catch (error) { next(error); }
}

export async function cancelProduceSaleRecord(req, res, next) {
  try {
    const sale = await ProduceSale.findOne({ _id: req.params.id, user: req.user._id, status: "confirmed" });
    if (!sale) return res.status(404).json({ message: "Active sale not found" });
    await cancelProduceSale(sale, req.body.reason, req.user._id);
    res.json(await saleView(sale, req.user._id));
  } catch (error) { next(error); }
}

export async function voidSaleReceipt(req, res, next) {
  try {
    const receipt = await SaleReceipt.findOne({ _id: req.params.receiptId, sale: req.params.id, user: req.user._id, voidedAt: null });
    if (!receipt) return res.status(404).json({ message: "Receipt not found or already voided" });
    const sale = await ProduceSale.findOne({ _id: req.params.id, user: req.user._id, status: "confirmed" }).select("+paymentVersion");
    if (!sale) return res.status(404).json({ message: "Active sale not found" });
    res.json(await voidSaleReceiptPayment(sale, receipt, req.body.reason, req.user._id));
  } catch (error) { next(error); }
}

async function receiptContext(receiptId, user) {
  const receipt = await SaleReceipt.findOne({ _id: receiptId, user: user._id })
    .populate("sale").populate("issuedBy", "name").populate("voidedBy", "name");
  if (!receipt) return null;
  const transaction = await Transaction.findOne({ _id: receipt.financeTransaction, user: user._id });
  if (!transaction) return null;
  const payment = transaction.payments.id(receipt.paymentId);
  return { receipt, transaction, view: buildReceiptView({ receipt, sale: receipt.sale, transaction, payment, user }) };
}

export async function getSaleReceipt(req, res, next) {
  try {
    const context = await receiptContext(req.params.receiptId, req.user);
    if (!context) return res.status(404).json({ message: "Receipt not found" });
    if (String(context.receipt.sale._id) !== req.params.id) return res.status(404).json({ message: "Receipt not found" });
    res.setHeader("Cache-Control", "private, no-store");
    res.json(context.view);
  } catch (error) { next(error); }
}

export async function downloadSaleReceipt(req, res, next) {
  try {
    const context = await receiptContext(req.params.receiptId, req.user);
    if (!context || String(context.receipt.sale._id) !== req.params.id) return res.status(404).json({ message: "Receipt not found" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Disposition", `attachment; filename="${safeReceiptFilename(context.receipt.receiptNumber)}"`);
    const doc = createReceiptPdf(context.view);
    doc.pipe(res);
    doc.end();
  } catch (error) { next(error); }
}

function csvCell(value) {
  const safe = /^[=+\-@]/.test(String(value ?? "")) ? `'${value}` : String(value ?? "");
  return /[",\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

async function reportData(user, query = {}) {
  const saleQuery = { user };
  const productionQuery = { user };
  if (query.from || query.to) {
    saleQuery.saleDate = {}; productionQuery.productionDate = {};
    if (query.from) { saleQuery.saleDate.$gte = new Date(query.from); productionQuery.productionDate.$gte = new Date(query.from); }
    if (query.to) { const end = new Date(query.to); end.setHours(23, 59, 59, 999); saleQuery.saleDate.$lte = end; productionQuery.productionDate.$lte = end; }
  }
  if (query.productType) productionQuery.productType = query.productType;
  const production = await ProductionRecord.find(productionQuery).sort({ productionDate: -1 }).lean();
  if (query.productType) saleQuery.productionRecord = { $in: production.map((row) => row._id) };
  const [sales, availability] = await Promise.all([
    ProduceSale.find(saleQuery).sort({ saleDate: -1 }).lean(),
    StockMovement.aggregate([
      { $match: { user, productionRecord: { $in: production.map((row) => row._id) } } },
      { $lookup: { from: "productionrecords", localField: "productionRecord", foreignField: "_id", as: "production" } },
      { $unwind: "$production" },
      { $group: { _id: { product: "$production.productName", unit: "$production.baseUnit" }, remaining: { $sum: "$quantityChange" } } }
    ])
  ]);
  const grouped = new Map();
  production.forEach((row) => {
    const key = `${row.productName}:${row.baseUnit}`;
    const item = grouped.get(key) || { product: row.productName, unit: row.baseUnit, produced: 0, sellable: 0, internal: 0, losses: 0, sold: 0, revenue: 0 };
    item.produced += row.quantityProduced; item.sellable += row.quantitySellable;
    item.internal += row.quantityUsedInternally + row.quantityReserved + row.quantityFedToYoung;
    item.losses += row.quantityDamaged + row.quantityRejected; grouped.set(key, item);
  });
  sales.filter((sale) => sale.status === "confirmed").forEach((sale) => {
    const key = `${sale.productName}:${sale.baseUnit}`;
    const item = grouped.get(key) || { product: sale.productName, unit: sale.baseUnit, produced: 0, sellable: 0, internal: 0, losses: 0, sold: 0, revenue: 0 };
    item.sold += sale.baseQuantity; item.revenue += sale.totalAmount; grouped.set(key, item);
  });
  const availableMap = new Map(availability.map((row) => [`${row._id.product}:${row._id.unit}`, row.remaining]));
  return { rows: [...grouped.values()].map((row) => ({ ...row, remaining: availableMap.get(`${row.product}:${row.unit}`) || 0 })), production, sales };
}

export async function productionSalesReport(req, res, next) {
  try { res.json(await reportData(req.user._id, req.query)); } catch (error) { next(error); }
}

export async function productionSalesCsv(req, res, next) {
  try {
    const { rows } = await reportData(req.user._id, req.query);
    const headers = ["Product", "Unit", "Produced", "Sellable", "Internal Use", "Damage/Loss", "Sold", "Remaining", "Sales Revenue"];
    const body = rows.map((row) => [row.product, row.unit, row.produced, row.sellable, row.internal, row.losses, row.sold, row.remaining, row.revenue].map(csvCell).join(","));
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="production_sales_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send([headers.join(","), ...body].join("\n"));
  } catch (error) { next(error); }
}
