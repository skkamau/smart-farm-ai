import assert from "node:assert/strict";
import dotenv from "dotenv";
import mongoose from "mongoose";
import InventoryItem from "./models/InventoryItem.js";
import ProduceSale from "./models/ProduceSale.js";
import ProductionRecord from "./models/ProductionRecord.js";
import SaleReceipt from "./models/SaleReceipt.js";
import StockMovement from "./models/StockMovement.js";
import Transaction from "./models/Transaction.js";
import User from "./models/User.js";
import { cancelProduceSale, createProduceSale, recordProduceSalePayment, updateProduceSale, voidSaleReceiptPayment } from "./services/produceSaleService.js";

dotenv.config();
await mongoose.connect(process.env.MONGODB_URI);
let user;

try {
  const stamp = Date.now();
  user = await User.create({ name: "Phase 3 Test", email: `phase3-${stamp}@example.invalid`, password: "TempPass1!", farmName: "Phase 3 Test Farm" });
  const item = await InventoryItem.create({
    user: user._id, name: "Table Eggs", category: "Produce", classification: "produce", unit: "egg",
    openingQuantity: 0, currentQuantity: 270, averageUnitCost: 0, produceKey: `phase3-eggs-${stamp}`
  });
  const production = await ProductionRecord.create({
    user: user._id, batchReference: `TEST-${stamp}`, productType: "eggs", productName: "Table Eggs",
    sourceType: "other", sourceModel: "Other", sourceLabel: "Integration test", productionDate: new Date(),
    quantityProduced: 320, baseUnit: "egg", quantityDamaged: 8, quantityUsedInternally: 12,
    quantityReserved: 30, quantitySellable: 270, inventoryItem: item._id, createdBy: user._id
  });
  const added = await StockMovement.create({
    user: user._id, item: item._id, type: "stock_added", quantity: 270, quantityChange: 270,
    balanceAfter: 270, movementDate: new Date(), reason: "Production added", productionRecord: production._id,
    sourceKey: `production:${production._id}:added`, createdBy: user._id
  });
  production.inventoryMovement = added._id;
  await production.save();

  const saleInput = {
    productionRecord: production._id, saleUnit: "tray", quantity: 3, unitPrice: 450,
    saleDate: new Date(), customer: "Test Buyer", paymentMethod: "M-Pesa", idempotencyKey: `sale-${stamp}`
  };
  const sale = await createProduceSale(user._id, saleInput);
  const saleRetry = await createProduceSale(user._id, saleInput);
  assert.equal(String(saleRetry._id), String(sale._id));
  assert.equal((await InventoryItem.findById(item._id)).currentQuantity, 180);
  assert.equal(await StockMovement.countDocuments({ user: user._id, produceSale: sale._id, type: "sold" }), 1);
  assert.equal(await Transaction.countDocuments({ user: user._id, sourceType: "sale", sourceId: String(sale._id) }), 1);

  await updateProduceSale(await ProduceSale.findById(sale._id), { ...saleInput, quantity: 4 }, user._id);
  assert.equal((await InventoryItem.findById(item._id)).currentQuantity, 150);
  assert.equal(await StockMovement.countDocuments({ user: user._id, produceSale: sale._id, type: "sold" }), 1);
  assert.equal((await Transaction.findById(sale.financeTransaction)).amount, 1800);

  const paymentInput = { amount: 500, paymentDate: new Date(), paymentMethod: "M-Pesa", idempotencyKey: `payment-${stamp}` };
  const receipt = await recordProduceSalePayment(await ProduceSale.findById(sale._id).select("+paymentVersion"), paymentInput, user._id);
  const receiptRetry = await recordProduceSalePayment(await ProduceSale.findById(sale._id).select("+paymentVersion"), paymentInput, user._id);
  assert.equal(String(receiptRetry._id), String(receipt._id));
  assert.equal((await Transaction.findById(sale.financeTransaction)).amountOutstanding, 1300);

  await voidSaleReceiptPayment(
    await ProduceSale.findById(sale._id).select("+paymentVersion"),
    await SaleReceipt.findById(receipt._id), "Integration test void", user._id
  );
  assert.equal((await Transaction.findById(sale.financeTransaction)).amountOutstanding, 1800);
  await cancelProduceSale(await ProduceSale.findById(sale._id), "Integration test cancellation", user._id);
  assert.equal((await InventoryItem.findById(item._id)).currentQuantity, 270);
  assert.equal((await ProduceSale.findById(sale._id)).status, "cancelled");
  assert.ok((await Transaction.findById(sale.financeTransaction)).reversedAt);
  console.log("Phase 3 database integration test passed");
} finally {
  if (user) {
    const query = { user: user._id };
    await Promise.all([
      SaleReceipt.deleteMany(query), ProduceSale.deleteMany(query), Transaction.deleteMany(query),
      StockMovement.deleteMany(query), ProductionRecord.deleteMany(query), InventoryItem.deleteMany(query)
    ]);
    await User.deleteOne({ _id: user._id });
  }
  await mongoose.disconnect();
}
