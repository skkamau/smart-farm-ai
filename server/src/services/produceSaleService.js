import mongoose from "mongoose";
import InventoryItem from "../models/InventoryItem.js";
import ProduceSale from "../models/ProduceSale.js";
import ProductionRecord from "../models/ProductionRecord.js";
import SaleReceipt from "../models/SaleReceipt.js";
import StockMovement from "../models/StockMovement.js";
import Transaction from "../models/Transaction.js";
import { productionAvailability } from "./productionInventoryService.js";

const round = (value) => Math.round((Number(value) + Number.EPSILON) * 1000000) / 1000000;

export function saleConversion(baseUnit, saleUnit, customConversion) {
  if (baseUnit === saleUnit) return 1;
  const standard = {
    "egg:dozen": 12, "egg:tray": 30,
    "litre:millilitre": 0.001, "millilitre:litre": 1000,
    "kilogram:tonne": 1000, "tonne:kilogram": 0.001
  }[`${baseUnit}:${saleUnit}`];
  if (standard) return standard;
  const custom = Number(customConversion || 0);
  if (custom > 0) return custom;
  throw Object.assign(new Error(`Enter how many ${baseUnit}s are in one ${saleUnit}`), { statusCode: 400 });
}

export function saleAmounts(input, baseUnit) {
  const quantity = Number(input.quantity || 0);
  const unitPrice = Number(input.unitPrice || 0);
  if (!Number.isFinite(quantity) || quantity <= 0) throw Object.assign(new Error("Sale quantity must be greater than zero"), { statusCode: 400 });
  if (!Number.isFinite(unitPrice) || unitPrice < 0) throw Object.assign(new Error("Unit price cannot be negative"), { statusCode: 400 });
  const conversionToBase = saleConversion(baseUnit, input.saleUnit, input.conversionToBase);
  return { quantity, unitPrice, conversionToBase, baseQuantity: round(quantity * conversionToBase), totalAmount: round(quantity * unitPrice) };
}

async function acquireProductionLock(record) {
  const version = Number(record.stockVersion || 0);
  const locked = await ProductionRecord.findOneAndUpdate(
    { _id: record._id, user: record.user, status: "active", stockVersion: version },
    { $inc: { stockVersion: 1 } }, { new: true, select: "+stockVersion" }
  );
  if (!locked) throw Object.assign(new Error("Produce stock changed while saving. Please try again."), { statusCode: 409 });
  return locked;
}

async function acquirePaymentLock(sale) {
  const version = Number(sale.paymentVersion || 0);
  const locked = await ProduceSale.findOneAndUpdate(
    { _id: sale._id, user: sale.user, status: "confirmed", paymentVersion: version },
    { $inc: { paymentVersion: 1 } }, { new: true, select: "+paymentVersion" }
  );
  if (!locked) throw Object.assign(new Error("Payment state changed while saving. Please try again."), { statusCode: 409 });
  return locked;
}

function financePayload(sale, input) {
  return {
    user: sale.user, type: "income", financeSection: "Income", category: "Produce Sales",
    amount: sale.totalAmount, totalCost: sale.totalAmount,
    description: `${sale.productName} sale ${sale.saleNumber}`,
    transactionDate: sale.saleDate, paymentMethod: input.paymentMethod || "Cash",
    paymentStatus: "unpaid", amountPaid: 0, amountOutstanding: sale.totalAmount,
    dueDate: sale.dueDate, counterparty: sale.customer, referenceNumber: input.referenceNumber || "",
    enterpriseType: input.enterpriseType || "Whole farm", linkedRecordType: "Produce sale",
    linkedRecordId: sale._id, source: "sale", sourceType: "sale", sourceId: String(sale._id),
    item: sale.productName, quantity: sale.quantity, unit: sale.saleUnit, unitCost: sale.unitPrice,
    notes: sale.notes, createdBy: sale.createdBy
  };
}

export async function createProduceSale(userId, input) {
  const duplicate = await ProduceSale.findOne({ user: userId, idempotencyKey: input.idempotencyKey });
  if (duplicate) return duplicate;
  const production = await ProductionRecord.findOne({ _id: input.productionRecord, user: userId, status: "active" }).select("+stockVersion");
  if (!production?.inventoryItem || !production.inventoryMovement) throw Object.assign(new Error("Available production batch not found"), { statusCode: 404 });
  const amounts = saleAmounts(input, production.baseUnit);
  await acquireProductionLock(production);
  const availability = await productionAvailability(production, userId);
  if (amounts.baseQuantity > Number(availability.available || 0)) throw Object.assign(new Error(`Only ${availability.available || 0} ${production.baseUnit} available in this batch`), { statusCode: 409 });

  let sale;
  let item;
  let movement;
  let transaction;
  try {
    sale = await ProduceSale.create({
      user: userId, idempotencyKey: input.idempotencyKey, productionRecord: production._id,
      inventoryItem: production.inventoryItem, productName: production.productName, baseUnit: production.baseUnit,
      saleUnit: input.saleUnit, ...amounts, customer: String(input.customer || "Walk-in customer").trim(),
      customerPhone: String(input.customerPhone || "").trim(), saleDate: input.saleDate,
      dueDate: input.dueDate || null, notes: String(input.notes || "").trim(), createdBy: userId
    });
    item = await InventoryItem.findOneAndUpdate(
      { _id: production.inventoryItem, user: userId, archivedAt: null, currentQuantity: { $gte: amounts.baseQuantity } },
      { $inc: { currentQuantity: -amounts.baseQuantity } }, { new: true, runValidators: true }
    );
    if (!item) throw Object.assign(new Error("Inventory stock is lower than this sale"), { statusCode: 409 });
    movement = await StockMovement.create({
      user: userId, item: item._id, type: "sold", quantity: amounts.baseQuantity,
      quantityChange: -amounts.baseQuantity, balanceAfter: item.currentQuantity,
      movementDate: input.saleDate, unitCost: input.unitPrice / amounts.conversionToBase,
      reason: `Sold through ${sale.saleNumber}`, notes: sale.notes, productionRecord: production._id,
      produceSale: sale._id, sourceKey: `sale:${sale._id}:sold`, createdBy: userId
    });
    transaction = await Transaction.create({ ...financePayload(sale, input), inventoryMovement: movement._id });
    movement.financeTransaction = transaction._id;
    await movement.save();
    sale.stockMovement = movement._id; sale.financeTransaction = transaction._id;
    await sale.save();
    return sale;
  } catch (error) {
    if (transaction) await Transaction.deleteOne({ _id: transaction._id, user: userId }).catch(() => {});
    if (movement) await StockMovement.deleteOne({ _id: movement._id, user: userId }).catch(() => {});
    if (item) await InventoryItem.updateOne({ _id: item._id, user: userId }, { $inc: { currentQuantity: amounts.baseQuantity } }).catch(() => {});
    if (sale) await ProduceSale.deleteOne({ _id: sale._id, user: userId }).catch(() => {});
    if (error.code === 11000) return ProduceSale.findOne({ user: userId, idempotencyKey: input.idempotencyKey });
    throw error;
  }
}

export async function recordProduceSalePayment(sale, input, userId) {
  const duplicate = await SaleReceipt.findOne({ user: userId, idempotencyKey: input.idempotencyKey });
  if (duplicate) return duplicate;
  const locked = await acquirePaymentLock(sale);
  const transaction = await Transaction.findOne({ _id: sale.financeTransaction, user: userId, reversedAt: null });
  if (!transaction) throw Object.assign(new Error("Linked Finance transaction not found"), { statusCode: 409 });
  const existingPayment = transaction.payments.find((payment) => payment.idempotencyKey === input.idempotencyKey);
  let payment = existingPayment;
  let paymentAdded = false;
  if (!payment) {
    const amount = Number(input.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) throw Object.assign(new Error("Payment amount must be greater than zero"), { statusCode: 400 });
    if (amount > Number(transaction.amountOutstanding || 0)) throw Object.assign(new Error("Payment exceeds the outstanding balance"), { statusCode: 400 });
    transaction.payments.push({
      _id: new mongoose.Types.ObjectId(), idempotencyKey: input.idempotencyKey, amount,
      paymentDate: input.paymentDate || new Date(), paymentMethod: input.paymentMethod || transaction.paymentMethod,
      referenceNumber: String(input.referenceNumber || "").trim(), notes: String(input.notes || "").trim(), recordedBy: userId
    });
    payment = transaction.payments[transaction.payments.length - 1];
    transaction.amountPaid = round(Number(transaction.amountPaid || 0) + amount);
    transaction.amountOutstanding = round(Math.max(0, transaction.amount - transaction.amountPaid));
    transaction.paymentStatus = transaction.amountOutstanding === 0 ? "paid" : "partially_paid";
    await transaction.save();
    paymentAdded = true;
  }
  try {
    return await SaleReceipt.create({
      user: userId, sale: sale._id, financeTransaction: transaction._id, paymentId: payment._id,
      idempotencyKey: input.idempotencyKey, receiptNumber: `RCPT-${new Date(payment.paymentDate).toISOString().slice(0, 10).replaceAll("-", "")}-${String(payment._id).slice(-8).toUpperCase()}`,
      amountReceived: payment.amount, paymentDate: payment.paymentDate, paymentMethod: payment.paymentMethod,
      paymentReference: payment.referenceNumber, remainingBalance: transaction.amountOutstanding, issuedBy: userId
    });
  } catch (error) {
    if (paymentAdded && error.code !== 11000) {
      transaction.payments.pull(payment._id);
      transaction.amountPaid = round(Math.max(0, transaction.amountPaid - payment.amount));
      transaction.amountOutstanding = round(transaction.amount - transaction.amountPaid);
      transaction.paymentStatus = transaction.amountPaid > 0 ? "partially_paid" : "unpaid";
      await transaction.save().catch(() => {});
    }
    if (error.code === 11000) return SaleReceipt.findOne({ user: userId, idempotencyKey: input.idempotencyKey });
    throw error;
  }
}

export async function updateProduceSale(sale, input, userId) {
  if (sale.status !== "confirmed") throw Object.assign(new Error("Cancelled sales cannot be edited"), { statusCode: 409 });
  if (new Date(input.saleDate).toISOString().slice(0, 10) !== new Date(sale.saleDate).toISOString().slice(0, 10)) {
    throw Object.assign(new Error("Sale date cannot change after stock and Finance records are posted"), { statusCode: 409 });
  }
  const transaction = await Transaction.findOne({ _id: sale.financeTransaction, user: userId, reversedAt: null });
  const movement = await StockMovement.findOne({ _id: sale.stockMovement, user: userId, produceSale: sale._id });
  const production = await ProductionRecord.findOne({ _id: sale.productionRecord, user: userId, status: "active" }).select("+stockVersion");
  if (!transaction || !movement || !production) throw Object.assign(new Error("Linked sale records could not be verified"), { statusCode: 409 });
  const amounts = saleAmounts(input, sale.baseUnit);
  if (amounts.totalAmount < Number(transaction.amountPaid || 0)) throw Object.assign(new Error("Sale total cannot be lower than payments already received"), { statusCode: 409 });
  await acquireProductionLock(production);
  const delta = round(amounts.baseQuantity - Number(sale.baseQuantity));
  if (delta > 0) {
    const availability = await productionAvailability(production, userId);
    if (delta > Number(availability.available || 0)) throw Object.assign(new Error(`Only ${availability.available || 0} additional ${sale.baseUnit} available`), { statusCode: 409 });
  }
  const itemQuery = { _id: sale.inventoryItem, user: userId, archivedAt: null };
  if (delta > 0) itemQuery.currentQuantity = { $gte: delta };
  const item = delta
    ? await InventoryItem.findOneAndUpdate(itemQuery, { $inc: { currentQuantity: -delta } }, { new: true, runValidators: true })
    : await InventoryItem.findOne(itemQuery);
  if (!item) throw Object.assign(new Error("Inventory stock prevents this sale edit"), { statusCode: 409 });
  const old = {
    quantity: sale.quantity, baseQuantity: sale.baseQuantity, saleUnit: sale.saleUnit,
    conversionToBase: sale.conversionToBase, unitPrice: sale.unitPrice, totalAmount: sale.totalAmount,
    customer: sale.customer, customerPhone: sale.customerPhone, saleDate: sale.saleDate,
    dueDate: sale.dueDate, notes: sale.notes, movementQuantity: movement.quantity,
    movementChange: movement.quantityChange, movementBalance: movement.balanceAfter,
    transactionAmount: transaction.amount, transactionOutstanding: transaction.amountOutstanding,
    transactionStatus: transaction.paymentStatus, transactionQuantity: transaction.quantity,
    transactionUnit: transaction.unit, transactionUnitCost: transaction.unitCost,
    transactionCounterparty: transaction.counterparty, transactionNotes: transaction.notes
  };
  try {
    Object.assign(sale, amounts, {
      saleUnit: input.saleUnit, customer: String(input.customer || "Walk-in customer").trim(),
      customerPhone: String(input.customerPhone || "").trim(), saleDate: input.saleDate,
      dueDate: input.dueDate || null, notes: String(input.notes || "").trim()
    });
    movement.quantity = amounts.baseQuantity;
    movement.quantityChange = -amounts.baseQuantity;
    movement.balanceAfter = round(Number(movement.balanceAfter) - delta);
    movement.movementDate = input.saleDate;
    movement.unitCost = amounts.unitPrice / amounts.conversionToBase;
    const later = await StockMovement.find({
      user: userId, item: movement.item,
      $or: [{ movementDate: { $gt: movement.movementDate } }, { movementDate: movement.movementDate, createdAt: { $gt: movement.createdAt } }]
    }).select("_id");
    transaction.amount = amounts.totalAmount; transaction.totalCost = amounts.totalAmount;
    transaction.amountOutstanding = round(amounts.totalAmount - Number(transaction.amountPaid || 0));
    transaction.paymentStatus = transaction.amountOutstanding === 0 ? "paid" : transaction.amountPaid > 0 ? "partially_paid" : "unpaid";
    transaction.transactionDate = input.saleDate; transaction.dueDate = input.dueDate || null;
    transaction.counterparty = sale.customer; transaction.quantity = amounts.quantity;
    transaction.unit = input.saleUnit; transaction.unitCost = amounts.unitPrice; transaction.notes = sale.notes;
    await movement.save(); await transaction.save(); await sale.save();
    if (later.length && delta) await StockMovement.updateMany({ _id: { $in: later.map((row) => row._id) }, user: userId }, { $inc: { balanceAfter: -delta } });
    return sale;
  } catch (error) {
    if (delta) await InventoryItem.updateOne({ _id: item._id, user: userId }, { $inc: { currentQuantity: delta } }).catch(() => {});
    Object.assign(sale, old);
    movement.quantity = old.movementQuantity; movement.quantityChange = old.movementChange; movement.balanceAfter = old.movementBalance;
    transaction.amount = old.transactionAmount; transaction.totalCost = old.transactionAmount;
    transaction.amountOutstanding = old.transactionOutstanding; transaction.paymentStatus = old.transactionStatus;
    transaction.quantity = old.transactionQuantity; transaction.unit = old.transactionUnit;
    transaction.unitCost = old.transactionUnitCost; transaction.counterparty = old.transactionCounterparty;
    transaction.notes = old.transactionNotes;
    await movement.save().catch(() => {}); await transaction.save().catch(() => {});
    throw error;
  }
}

export async function cancelProduceSale(sale, reason, userId) {
  const transaction = await Transaction.findOne({ _id: sale.financeTransaction, user: userId });
  if (!transaction) throw Object.assign(new Error("Linked Finance transaction not found"), { statusCode: 409 });
  if (Number(transaction.amountPaid || 0) > 0) throw Object.assign(new Error("Void or resolve received payments before cancelling this sale"), { statusCode: 409 });
  const duplicate = await StockMovement.findOne({ user: userId, sourceKey: `sale:${sale._id}:reversal` });
  if (duplicate) return duplicate;
  const item = await InventoryItem.findOneAndUpdate(
    { _id: sale.inventoryItem, user: userId, archivedAt: null },
    { $inc: { currentQuantity: sale.baseQuantity } }, { new: true, runValidators: true }
  );
  if (!item) throw Object.assign(new Error("Inventory item is unavailable"), { statusCode: 409 });
  let reversal;
  const priorTransaction = { reversedAt: transaction.reversedAt, reversalReason: transaction.reversalReason, reversedBy: transaction.reversedBy };
  try {
    reversal = await StockMovement.create({
      user: userId, item: item._id, type: "reversal", quantity: sale.baseQuantity,
      quantityChange: sale.baseQuantity, balanceAfter: item.currentQuantity, movementDate: new Date(),
      reason: `Cancelled ${sale.saleNumber}`, notes: reason, productionRecord: sale.productionRecord,
      produceSale: sale._id, financeTransaction: transaction._id, sourceKey: `sale:${sale._id}:reversal`, createdBy: userId
    });
    transaction.reversedAt = new Date(); transaction.reversalReason = reason; transaction.reversedBy = userId;
    await transaction.save();
    sale.status = "cancelled"; sale.cancelledAt = new Date(); sale.cancelledBy = userId;
    sale.cancellationReason = reason; sale.reversalMovement = reversal._id;
    await sale.save();
    return reversal;
  } catch (error) {
    if (reversal) await StockMovement.deleteOne({ _id: reversal._id, user: userId }).catch(() => {});
    await InventoryItem.updateOne({ _id: item._id, user: userId }, { $inc: { currentQuantity: -sale.baseQuantity } }).catch(() => {});
    transaction.reversedAt = priorTransaction.reversedAt; transaction.reversalReason = priorTransaction.reversalReason; transaction.reversedBy = priorTransaction.reversedBy;
    await transaction.save().catch(() => {});
    throw error;
  }
}

export async function voidSaleReceiptPayment(sale, receipt, reason, userId) {
  await acquirePaymentLock(sale);
  const transaction = await Transaction.findOne({ _id: receipt.financeTransaction, user: userId, reversedAt: null });
  if (!transaction) throw Object.assign(new Error("Linked Finance transaction not found"), { statusCode: 409 });
  const payment = transaction.payments.id(receipt.paymentId);
  if (!payment) throw Object.assign(new Error("Receipt payment was not found"), { statusCode: 409 });
  transaction.payments.pull(payment._id);
  transaction.amountPaid = round(Math.max(0, Number(transaction.amountPaid || 0) - Number(payment.amount || 0)));
  transaction.amountOutstanding = round(Math.max(0, transaction.amount - transaction.amountPaid));
  transaction.paymentStatus = transaction.amountPaid === 0 ? "unpaid" : transaction.amountOutstanding === 0 ? "paid" : "partially_paid";
  await transaction.save();
  receipt.voidedAt = new Date(); receipt.voidedBy = userId; receipt.voidReason = reason;
  try { await receipt.save(); return receipt; }
  catch (error) {
    transaction.payments.push(payment.toObject());
    transaction.amountPaid = round(transaction.amountPaid + Number(payment.amount || 0));
    transaction.amountOutstanding = round(Math.max(0, transaction.amount - transaction.amountPaid));
    transaction.paymentStatus = transaction.amountOutstanding === 0 ? "paid" : "partially_paid";
    await transaction.save().catch(() => {});
    throw error;
  }
}
