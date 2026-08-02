import InventoryItem from "../models/InventoryItem.js";
import StockMovement from "../models/StockMovement.js";
import ProductionRecord from "../models/ProductionRecord.js";

const outgoingReasons = new Set(["household", "animal_feed", "farm_input", "seed", "incubation", "damaged", "spoiled", "missing", "donated", "other"]);

function exactRegex(value) {
  return new RegExp(`^${String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
}

export function productionProduceKey(record) {
  return `${String(record.productName).trim().toLowerCase()}::${String(record.baseUnit).trim().toLowerCase()}`;
}

export async function ensureProduceItem(record) {
  const produceKey = productionProduceKey(record);
  let item = await InventoryItem.findOne({ user: record.user, produceKey });
  if (item?.archivedAt) { item.archivedAt = null; await item.save(); }
  if (!item) {
    item = await InventoryItem.findOne({
      user: record.user, category: "Produce", unit: record.baseUnit,
      name: exactRegex(record.productName), archivedAt: null
    });
    if (item && !item.produceKey) {
      try { item.produceKey = produceKey; await item.save(); } catch (error) { if (error.code !== 11000) throw error; }
    }
  }
  if (item) return item;
  try {
    return await InventoryItem.create({
      user: record.user, name: record.productName, category: "Produce", classification: "produce",
      unit: record.baseUnit, openingQuantity: 0, currentQuantity: 0, minimumStockLevel: 0,
      averageUnitCost: 0, storageLocation: record.storageLocation, expiryDate: null,
      produceKey, notes: "Created automatically from Production."
    });
  } catch (error) {
    if (error.code === 11000) {
      const existing = await InventoryItem.findOne({ user: record.user, produceKey });
      if (existing?.archivedAt) { existing.archivedAt = null; await existing.save(); }
      return existing;
    }
    throw error;
  }
}

export async function productionAvailability(recordOrId, user) {
  const productionId = recordOrId._id || recordOrId;
  const match = { productionRecord: productionId };
  if (user) match.user = user;
  const result = await StockMovement.aggregate([
    { $match: match },
    { $group: { _id: null, available: { $sum: "$quantityChange" }, additions: { $sum: { $cond: [{ $gt: ["$quantityChange", 0] }, "$quantityChange", 0] } }, removals: { $sum: { $cond: [{ $and: [{ $lt: ["$quantityChange", 0] }, { $ne: ["$type", "transfer_out"] }] }, { $abs: "$quantityChange" }, 0] } } } }
  ]);
  return result[0] || { available: 0, additions: 0, removals: 0 };
}

export async function addProductionToInventory(record) {
  if (record.status !== "active" || Number(record.quantitySellable || 0) <= 0) return null;
  const sourceKey = `production:${record._id}:added`;
  const existing = await StockMovement.findOne({ user: record.user, sourceKey });
  if (existing) {
    record.inventoryItem = existing.item;
    record.inventoryMovement = existing._id;
    await ProductionRecord.updateOne({ _id: record._id, user: record.user }, { $set: { inventoryItem: existing.item, inventoryMovement: existing._id } });
    return existing;
  }
  const item = await ensureProduceItem(record);
  const quantity = Number(record.quantitySellable);
  const updatedItem = await InventoryItem.findOneAndUpdate(
    { _id: item._id, user: record.user, archivedAt: null },
    { $inc: { currentQuantity: quantity } },
    { new: true, runValidators: true }
  );
  if (!updatedItem) throw new Error("Produce inventory item is unavailable");
  let movement;
  try {
    movement = await StockMovement.create({
      user: record.user, item: item._id, type: "stock_added", quantity,
      quantityChange: quantity, balanceAfter: updatedItem.currentQuantity,
      movementDate: record.productionDate, unitCost: 0, reason: "Production added",
      farmActivity: "Production", notes: `Production batch ${record.batchReference}`,
      productionRecord: record._id, sourceKey, createdBy: record.createdBy
    });
  } catch (error) {
    await InventoryItem.updateOne({ _id: item._id, user: record.user }, { $inc: { currentQuantity: -quantity } });
    if (error.code === 11000) {
      const duplicate = await StockMovement.findOne({ user: record.user, sourceKey });
      if (duplicate) {
        record.inventoryItem = duplicate.item;
        record.inventoryMovement = duplicate._id;
        await ProductionRecord.updateOne({ _id: record._id, user: record.user }, { $set: { inventoryItem: duplicate.item, inventoryMovement: duplicate._id } });
      }
      return duplicate;
    }
    throw error;
  }
  record.inventoryItem = item._id;
  record.inventoryMovement = movement._id;
  await record.save();
  return movement;
}

async function acquireStockLock(record) {
  const version = Number(record.stockVersion || 0);
  const locked = await ProductionRecord.findOneAndUpdate(
    { _id: record._id, user: record.user, stockVersion: version, status: "active" },
    { $inc: { stockVersion: 1 } },
    { new: true, select: "+stockVersion" }
  );
  if (!locked) {
    const error = new Error("Production stock changed while saving. Please try again.");
    error.statusCode = 409;
    throw error;
  }
  return locked;
}

export async function removeProductionStock(record, input) {
  if (!outgoingReasons.has(input.reason)) {
    const error = new Error("Choose a valid removal reason"); error.statusCode = 400; throw error;
  }
  const quantity = Number(input.quantity || 0);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    const error = new Error("Quantity must be greater than zero"); error.statusCode = 400; throw error;
  }
  const sourceKey = `production:${record._id}:removal:${input.idempotencyKey}`;
  const duplicate = await StockMovement.findOne({ user: record.user, sourceKey });
  if (duplicate) return duplicate;
  const locked = await acquireStockLock(record);
  let itemUpdated = false;
  try {
    const availability = await productionAvailability(record, record.user);
    if (quantity > Number(availability.available || 0)) {
      const error = new Error(`Only ${availability.available || 0} ${record.baseUnit} available in this batch`); error.statusCode = 409; throw error;
    }
    const item = await InventoryItem.findOneAndUpdate(
      { _id: record.inventoryItem, user: record.user, archivedAt: null, currentQuantity: { $gte: quantity } },
      { $inc: { currentQuantity: -quantity } }, { new: true, runValidators: true }
    );
    if (!item) { const error = new Error("Available Inventory stock is lower than this removal"); error.statusCode = 409; throw error; }
    itemUpdated = true;
    const type = input.reason === "spoiled" ? "expired" : ["damaged", "missing"].includes(input.reason) ? "wasted" : "used";
    return await StockMovement.create({
      user: record.user, item: item._id, type, quantity, quantityChange: -quantity,
      balanceAfter: item.currentQuantity, movementDate: input.movementDate || new Date(),
      usagePurpose: input.reason.replaceAll("_", " "), reason: input.reason.replaceAll("_", " "),
      notes: String(input.notes || "").trim().slice(0, 2000), productionRecord: record._id,
      productionRemovalReason: input.reason, sourceKey, createdBy: input.createdBy
    });
  } catch (error) {
    if (itemUpdated) await InventoryItem.updateOne({ _id: record.inventoryItem, user: record.user }, { $inc: { currentQuantity: quantity } }).catch(() => {});
    await ProductionRecord.updateOne({ _id: locked._id, user: record.user, stockVersion: locked.stockVersion }, { $inc: { stockVersion: -1 } }).catch(() => {});
    if (error.code === 11000) return StockMovement.findOne({ user: record.user, sourceKey });
    throw error;
  }
}

export async function updateProductionInventory(record, newSellable) {
  const movement = await StockMovement.findOne({ _id: record.inventoryMovement, user: record.user, productionRecord: record._id });
  if (!movement) throw Object.assign(new Error("Linked production stock movement was not found"), { statusCode: 409 });
  const availability = await productionAvailability(record, record.user);
  const consumed = Number(movement.quantity) - Number(availability.available);
  if (newSellable < consumed) throw Object.assign(new Error(`At least ${consumed} ${record.baseUnit} has already been removed from this batch`), { statusCode: 409 });
  const delta = Number(newSellable) - Number(movement.quantity);
  if (!delta) return movement;
  const locked = await acquireStockLock(record);
  const itemQuery = { _id: movement.item, user: record.user, archivedAt: null };
  if (delta < 0) itemQuery.currentQuantity = { $gte: Math.abs(delta) };
  const item = await InventoryItem.findOneAndUpdate(itemQuery, { $inc: { currentQuantity: delta } }, { new: true, runValidators: true });
  if (!item) {
    await ProductionRecord.updateOne({ _id: locked._id, user: record.user, stockVersion: locked.stockVersion }, { $inc: { stockVersion: -1 } });
    throw Object.assign(new Error("Inventory stock already used prevents this production edit"), { statusCode: 409 });
  }
  try {
    const laterMovements = await StockMovement.find({
      user: record.user, item: movement.item,
      $or: [{ movementDate: { $gt: movement.movementDate } }, { movementDate: movement.movementDate, createdAt: { $gt: movement.createdAt } }]
    }).select("_id");
    movement.quantity = Number(newSellable);
    movement.quantityChange = Number(newSellable);
    movement.balanceAfter = Number(movement.balanceAfter) + delta;
    await movement.save();
    if (laterMovements.length) await StockMovement.updateMany({ _id: { $in: laterMovements.map((entry) => entry._id) }, user: record.user }, { $inc: { balanceAfter: delta } });
    return movement;
  } catch (error) {
    await InventoryItem.updateOne({ _id: movement.item, user: record.user }, { $inc: { currentQuantity: -delta } }).catch(() => {});
    throw error;
  }
}

export async function reverseProductionInventory(record, reason, userId) {
  const duplicate = await StockMovement.findOne({ user: record.user, sourceKey: `production:${record._id}:reversal` });
  if (duplicate) return duplicate;
  await acquireStockLock(record);
  const availability = await productionAvailability(record, record.user);
  if (Number(availability.removals) > 0) throw Object.assign(new Error("Resolve linked usage, losses, or sales before reversing this production batch"), { statusCode: 409 });
  const quantity = Number(availability.available || 0);
  if (quantity <= 0) return null;
  const item = await InventoryItem.findOneAndUpdate(
    { _id: record.inventoryItem, user: record.user, archivedAt: null, currentQuantity: { $gte: quantity } },
    { $inc: { currentQuantity: -quantity } }, { new: true, runValidators: true }
  );
  if (!item) throw Object.assign(new Error("Inventory stock is too low to reverse this batch"), { statusCode: 409 });
  try {
    return await StockMovement.create({
      user: record.user, item: item._id, type: "reversal", quantity, quantityChange: -quantity,
      balanceAfter: item.currentQuantity, movementDate: new Date(), reason: "Production reversed",
      notes: reason, productionRecord: record._id, sourceKey: `production:${record._id}:reversal`, createdBy: userId
    });
  } catch (error) {
    await InventoryItem.updateOne({ _id: item._id, user: record.user }, { $inc: { currentQuantity: quantity } });
    if (error.code === 11000) return StockMovement.findOne({ user: record.user, sourceKey: `production:${record._id}:reversal` });
    throw error;
  }
}

export async function transferProductionStorage(record, input) {
  const location = String(input.storageLocation || "").trim().slice(0, 160);
  if (!location) throw Object.assign(new Error("Enter the new storage location"), { statusCode: 400 });
  const baseKey = `production:${record._id}:transfer:${input.idempotencyKey}`;
  const duplicate = await StockMovement.findOne({ user: record.user, sourceKey: `${baseKey}:in` });
  if (duplicate) {
    record.storageLocation = location;
    await record.save();
    return duplicate;
  }
  await acquireStockLock(record);
  const availability = await productionAvailability(record, record.user);
  const quantity = Number(availability.available || 0);
  if (quantity <= 0) throw Object.assign(new Error("This batch has no available produce to transfer"), { statusCode: 409 });
  const item = await InventoryItem.findOne({ _id: record.inventoryItem, user: record.user, archivedAt: null });
  if (!item || Number(item.currentQuantity) < quantity) throw Object.assign(new Error("Inventory stock is too low to transfer this batch"), { statusCode: 409 });
  let outgoing = await StockMovement.findOne({ user: record.user, sourceKey: `${baseKey}:out` });
  let incoming;
  let createdOutgoing = false;
  try {
    if (!outgoing) {
      outgoing = await StockMovement.create({
        user: record.user, item: item._id, type: "transfer_out", quantity, quantityChange: -quantity,
        balanceAfter: Number(item.currentQuantity) - quantity, movementDate: input.movementDate || new Date(),
        reason: `Transferred from ${record.storageLocation || "previous storage"}`,
        notes: `Storage transfer for ${record.batchReference}`, productionRecord: record._id,
        sourceKey: `${baseKey}:out`, createdBy: input.createdBy
      });
      createdOutgoing = true;
    }
    incoming = await StockMovement.create({
      user: record.user, item: item._id, type: "transfer_in", quantity, quantityChange: quantity,
      balanceAfter: Number(item.currentQuantity), movementDate: input.movementDate || new Date(),
      reason: `Transferred to ${location}`, notes: `Storage transfer for ${record.batchReference}`,
      productionRecord: record._id, sourceKey: `${baseKey}:in`, createdBy: input.createdBy
    });
    record.storageLocation = location;
    await record.save();
    return incoming;
  } catch (error) {
    if (incoming) await StockMovement.deleteOne({ _id: incoming._id, user: record.user }).catch(() => {});
    if (createdOutgoing) await StockMovement.deleteOne({ _id: outgoing._id, user: record.user }).catch(() => {});
    if (error.code === 11000) {
      const existingIncoming = await StockMovement.findOne({ user: record.user, sourceKey: `${baseKey}:in` });
      if (existingIncoming) {
        record.storageLocation = location;
        await record.save();
      }
      return existingIncoming;
    }
    throw error;
  }
}

export { outgoingReasons };
