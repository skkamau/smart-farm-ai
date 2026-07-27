import { body } from "express-validator";
import Animal from "../models/Animal.js";
import AnimalGroup from "../models/AnimalGroup.js";
import Crop from "../models/Crop.js";
import InventoryItem from "../models/InventoryItem.js";
import StockMovement, { movementTypes } from "../models/StockMovement.js";
import Transaction from "../models/Transaction.js";

const categories = ["Feed", "Medicine", "Vaccine", "Fertilizer", "Seed", "Chemical", "Fuel", "Farm supplies", "Produce", "Equipment", "Other"];
const outgoingTypes = new Set(["used", "sold", "wasted", "expired", "transfer_out"]);
const incomingTypes = new Set(["purchase", "stock_added", "transfer_in"]);
const costBearingIncomingTypes = new Set(["opening_stock", "migration", ...incomingTypes]);

export function classificationFor(category) {
  if (category === "Equipment") return "equipment_asset";
  if (category === "Produce") return "produce";
  return "consumable";
}

export function inventoryStatus(item, warningDays = 30, now = new Date()) {
  const expiry = item.expiryDate ? new Date(item.expiryDate) : null;
  const expiresIn = expiry ? expiry.getTime() - now.getTime() : null;
  if (expiry && expiresIn < 0) return "Expired";
  if (expiry && expiresIn <= warningDays * 86400000) return "Expiring soon";
  if (Number(item.currentQuantity) === 0) return "Out of stock";
  if (Number(item.currentQuantity) <= Number(item.minimumStockLevel || 0)) return "Low stock";
  return "In stock";
}

export function calculateStockChange(currentQuantity, type, quantity, newCount) {
  const current = Number(currentQuantity || 0);
  const absoluteQuantity = Number(quantity || 0);
  if (type === "adjustment") {
    const counted = Number(newCount);
    return { quantity: Math.abs(counted - current), quantityChange: counted - current, newQuantity: counted };
  }
  const quantityChange = outgoingTypes.has(type) ? -absoluteQuantity : absoluteQuantity;
  return { quantity: absoluteQuantity, quantityChange, newQuantity: current + quantityChange };
}

export function weightedAverageCost(currentQuantity, currentCost, addedQuantity, addedCost) {
  const previousValue = Number(currentQuantity || 0) * Number(currentCost || 0);
  const addedValue = Number(addedQuantity || 0) * Number(addedCost || 0);
  const newQuantity = Number(currentQuantity || 0) + Number(addedQuantity || 0);
  return newQuantity > 0 ? (previousValue + addedValue) / newQuantity : 0;
}

export function calculateMovementLedger(movements) {
  let currentQuantity = 0;
  let averageUnitCost = 0;
  const rows = movements.map((movement) => {
    const type = movement.type;
    const quantity = Number(movement.quantity || 0);
    let quantityChange;
    if (type === "adjustment") {
      const target = Number(movement.balanceAfter || 0);
      quantityChange = target - currentQuantity;
    } else if (type === "reversal") {
      quantityChange = Number(movement.quantityChange || 0);
    } else {
      quantityChange = outgoingTypes.has(type) ? -quantity : quantity;
    }
    const nextQuantity = currentQuantity + quantityChange;
    if (nextQuantity < 0) {
      const error = new Error("This change would make historical stock negative");
      error.statusCode = 409;
      throw error;
    }
    if (costBearingIncomingTypes.has(type) && Number(movement.unitCost || 0) > 0 && quantity > 0) {
      averageUnitCost = weightedAverageCost(currentQuantity, averageUnitCost, quantity, movement.unitCost);
    }
    currentQuantity = nextQuantity;
    return { _id: movement._id, quantityChange, balanceAfter: currentQuantity };
  });
  return { rows, currentQuantity, averageUnitCost };
}

function itemView(item) {
  const value = Number(item.currentQuantity || 0) * Number(item.averageUnitCost || 0);
  return { ...item.toObject(), status: inventoryStatus(item), inventoryValue: value };
}

function text(value, max = 2000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export const itemRules = [
  body("name").trim().notEmpty().isLength({ max: 160 }).withMessage("Item name is required"),
  body("category").isIn(categories).withMessage("Choose a valid category"),
  body("unit").trim().notEmpty().isLength({ max: 40 }).withMessage("Unit is required"),
  body("openingQuantity").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("minimumStockLevel").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("unitCost").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("expiryDate").optional({ values: "falsy" }).isISO8601().toDate(),
  body("openingIsPurchase").optional().isBoolean()
];

export const movementRules = [
  body("type").isIn(movementTypes.filter((type) => !["opening_stock", "migration", "reversal"].includes(type))),
  body("quantity").if(body("type").not().equals("adjustment")).isFloat({ gt: 0 }).withMessage("Quantity must be greater than zero"),
  body("newCount").if(body("type").equals("adjustment")).isFloat({ min: 0 }).withMessage("Enter a valid counted quantity"),
  body("unitCost").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("movementDate").optional({ values: "falsy" }).isISO8601().toDate(),
  body("animal").optional({ values: "falsy" }).isMongoId(),
  body("animalGroup").optional({ values: "falsy" }).isMongoId(),
  body("crop").optional({ values: "falsy" }).isMongoId()
];

async function assertActivityOwnership(source, user) {
  const checks = [
    ["animal", Animal],
    ["animalGroup", AnimalGroup],
    ["crop", Crop]
  ];
  for (const [field, Model] of checks) {
    if (source[field] && !(await Model.exists({ _id: source[field], user }))) {
      const error = new Error(`Linked ${field} was not found`);
      error.statusCode = 404;
      throw error;
    }
  }
}

export async function listInventory(req, res, next) {
  try {
    const query = { user: req.user._id };
    if (req.query.archived !== "true") query.archivedAt = null;
    if (categories.includes(req.query.category)) query.category = req.query.category;
    if (["consumable", "produce", "equipment_asset"].includes(req.query.classification)) query.classification = req.query.classification;
    const items = await InventoryItem.find(query).sort({ archivedAt: 1, name: 1 });
    res.json(items.map(itemView));
  } catch (error) { next(error); }
}

export async function createInventoryItem(req, res, next) {
  let item;
  let movement;
  let finance;
  try {
    const openingQuantity = Number(req.body.openingQuantity || 0);
    const unitCost = Number(req.body.unitCost || 0);
    if (req.body.openingIsPurchase && (!openingQuantity || !unitCost)) {
      return res.status(400).json({ message: "A current opening purchase requires an opening quantity and unit cost" });
    }
    item = await InventoryItem.create({
      user: req.user._id,
      name: text(req.body.name, 160),
      category: req.body.category,
      classification: classificationFor(req.body.category),
      unit: text(req.body.unit, 40),
      openingQuantity,
      currentQuantity: openingQuantity,
      minimumStockLevel: Number(req.body.minimumStockLevel || 0),
      averageUnitCost: unitCost,
      storageLocation: text(req.body.storageLocation, 160),
      supplier: text(req.body.supplier, 160),
      expiryDate: req.body.expiryDate || null,
      notes: text(req.body.notes)
    });
    movement = await StockMovement.create({
      user: req.user._id, item: item._id, type: "opening_stock",
      quantity: openingQuantity, quantityChange: openingQuantity, balanceAfter: openingQuantity,
      movementDate: req.body.openingDate || new Date(), unitCost, supplier: item.supplier,
      paymentMethod: text(req.body.paymentMethod, 80),
      notes: "Opening stock", createdBy: req.user._id
    });
    finance = await createLinkedExpense(item, movement, {
      createFinanceExpense: Boolean(req.body.openingIsPurchase),
      openingIsPurchase: Boolean(req.body.openingIsPurchase)
    }, req.user._id);
    if (finance) {
      movement.financeTransaction = finance._id;
      await movement.save();
    }
    res.status(201).json(itemView(item));
  } catch (error) {
    if (finance?._id) await Transaction.deleteOne({ _id: finance._id, user: req.user._id }).catch(() => {});
    if (movement?._id) await StockMovement.deleteOne({ _id: movement._id, user: req.user._id }).catch(() => {});
    if (item?._id) await InventoryItem.deleteOne({ _id: item._id, user: req.user._id });
    next(error);
  }
}

export async function updateInventoryItem(req, res, next) {
  try {
    const update = {
      name: text(req.body.name, 160),
      category: req.body.category,
      classification: classificationFor(req.body.category),
      unit: text(req.body.unit, 40),
      minimumStockLevel: Number(req.body.minimumStockLevel || 0),
      storageLocation: text(req.body.storageLocation, 160),
      supplier: text(req.body.supplier, 160),
      expiryDate: req.body.expiryDate || null,
      notes: text(req.body.notes)
    };
    if (req.body.unitCost !== undefined) update.averageUnitCost = Number(req.body.unitCost || 0);
    const item = await InventoryItem.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, update, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ message: "Inventory item not found" });
    res.json(itemView(item));
  } catch (error) { next(error); }
}

async function createLinkedExpense(item, movement, source, user) {
  const amount = Number(movement.quantity) * Number(movement.unitCost || 0);
  const isPurchase = movement.type === "purchase" || (movement.type === "opening_stock" && source.openingIsPurchase);
  if (!isPurchase && !movement.financeTransaction) return null;
  if (!source.createFinanceExpense || !amount) return movement.financeTransaction || null;
  const financeSection = item.category === "Feed" ? "Feed" : item.category === "Fuel" ? "Fuel" : item.category === "Equipment" ? "Equipment" : "Consumables";
  const sourceKey = `inventory_movement:${movement._id}`;
  const existing = movement.financeTransaction
    ? await Transaction.findOne({ _id: movement.financeTransaction, user })
    : await Transaction.findOne({ user, sourceKey });
  const payload = {
    user, type: "expense", financeSection, category: item.category, source: "inventory",
    inventoryMovement: movement._id, sourceType: "inventory_movement", sourceId: String(movement._id),
    sourceKey, linkedRecordType: "Inventory item", linkedRecordId: item._id, enterpriseType: "Whole farm",
    amount, totalCost: amount, paymentStatus: "paid", amountPaid: amount, amountOutstanding: 0,
    transactionDate: movement.movementDate, item: item.name, description: `Stock purchase: ${item.name}`,
    quantity: movement.quantity, unit: item.unit, unitCost: movement.unitCost,
    paymentMethod: movement.paymentMethod, supplierVendor: movement.supplier,
    storageLocation: item.storageLocation, referenceNumber: movement.purchaseReference, notes: movement.notes
  };
  if (existing) {
    Object.assign(existing, payload, { reversedAt: null, reversalReason: "", reversedBy: null });
    await existing.save();
    return existing;
  }
  return Transaction.create({ ...payload, createdBy: user });
}

export async function createMovement(req, res, next) {
  let updatedItem;
  let movement;
  let originalQuantity;
  let originalAverageUnitCost;
  try {
    const item = await InventoryItem.findOne({ _id: req.params.id, user: req.user._id, archivedAt: null });
    if (!item) return res.status(404).json({ message: "Inventory item not found" });
    await assertActivityOwnership(req.body, req.user._id);

    const type = req.body.type;
    const oldQuantity = Number(item.currentQuantity || 0);
    originalQuantity = oldQuantity;
    originalAverageUnitCost = Number(item.averageUnitCost || 0);
    const stockChange = calculateStockChange(oldQuantity, type, req.body.quantity, req.body.newCount);
    const { quantity, quantityChange, newQuantity } = stockChange;
    if (newQuantity < 0) return res.status(409).json({ message: `Only ${oldQuantity} ${item.unit} available` });

    let averageUnitCost = Number(item.averageUnitCost || 0);
    const movementUnitCost = Number(req.body.unitCost || 0);
    if (incomingTypes.has(type) && movementUnitCost > 0 && quantity > 0) {
      averageUnitCost = weightedAverageCost(oldQuantity, averageUnitCost, quantity, movementUnitCost);
    }
    updatedItem = await InventoryItem.findOneAndUpdate(
      { _id: item._id, user: req.user._id, currentQuantity: oldQuantity, archivedAt: null },
      { $set: { currentQuantity: newQuantity, averageUnitCost } },
      { new: true, runValidators: true }
    );
    if (!updatedItem) return res.status(409).json({ message: "Stock changed while saving. Please try again." });

    movement = await StockMovement.create({
      user: req.user._id, item: item._id, type, quantity, quantityChange, balanceAfter: newQuantity,
      movementDate: req.body.movementDate || new Date(), unitCost: movementUnitCost,
      supplier: text(req.body.supplier, 160), paymentMethod: text(req.body.paymentMethod, 80),
      purchaseReference: text(req.body.purchaseReference, 160), usagePurpose: text(req.body.usagePurpose, 240),
      animal: req.body.animal || null, animalGroup: req.body.animalGroup || null, crop: req.body.crop || null,
      farmActivity: text(req.body.farmActivity, 160), reason: text(req.body.reason, 240),
      notes: text(req.body.notes), createdBy: req.user._id
    });
    const finance = await createLinkedExpense(updatedItem, movement, req.body, req.user._id);
    if (finance) {
      movement.financeTransaction = finance._id;
      await movement.save();
    }
    res.status(201).json({ item: itemView(updatedItem), movement });
  } catch (error) {
    if (updatedItem) {
      if (movement?.financeTransaction) {
        await Transaction.deleteOne({ _id: movement.financeTransaction, user: req.user._id }).catch(() => {});
      }
      if (movement?._id) await StockMovement.deleteOne({ _id: movement._id, user: req.user._id }).catch(() => {});
      await InventoryItem.updateOne(
        { _id: updatedItem._id, user: req.user._id },
        { $set: { currentQuantity: originalQuantity, averageUnitCost: originalAverageUnitCost } }
      ).catch(() => {});
    }
    next(error);
  }
}

export async function listMovements(req, res, next) {
  try {
    const item = await InventoryItem.exists({ _id: req.params.id, user: req.user._id });
    if (!item) return res.status(404).json({ message: "Inventory item not found" });
    const movements = await StockMovement.find({ item: req.params.id, user: req.user._id })
      .populate("createdBy", "name").populate("animal", "animalId name")
      .populate("animalGroup", "groupId groupName").populate("crop", "name field")
      .sort({ movementDate: -1, createdAt: -1 });
    res.json(movements);
  } catch (error) { next(error); }
}

export async function listAllMovements(req, res, next) {
  try {
    const movements = await StockMovement.find({ user: req.user._id })
      .populate("item", "name category unit classification storageLocation")
      .populate("createdBy", "name").populate("animal", "animalId name")
      .populate("animalGroup", "groupId groupName").populate("crop", "name field")
      .sort({ movementDate: -1, createdAt: -1 })
      .limit(1000);
    res.json(movements);
  } catch (error) { next(error); }
}

export async function updateMovement(req, res, next) {
  try {
    const item = await InventoryItem.findOne({ _id: req.params.id, user: req.user._id, archivedAt: null });
    if (!item) return res.status(404).json({ message: "Inventory item not found" });
    const movement = await StockMovement.findOne({
      _id: req.params.movementId, item: item._id, user: req.user._id
    });
    if (!movement) return res.status(404).json({ message: "Stock movement not found" });
    if (!incomingTypes.has(movement.type)) {
      return res.status(409).json({ message: "Only stock additions and purchases can be edited. Use an adjustment for other corrections." });
    }
    await assertActivityOwnership(req.body, req.user._id);
    movement.type = movement.financeTransaction ? "purchase" : incomingTypes.has(req.body.type) ? req.body.type : movement.type;
    movement.quantity = Number(req.body.quantity);
    movement.quantityChange = movement.quantity;
    movement.movementDate = req.body.movementDate || movement.movementDate;
    movement.unitCost = Number(req.body.unitCost || 0);
    movement.supplier = text(req.body.supplier, 160);
    movement.paymentMethod = text(req.body.paymentMethod, 80);
    movement.purchaseReference = text(req.body.purchaseReference, 160);
    movement.notes = text(req.body.notes);
    await movement.validate();

    const movements = await StockMovement.find({ item: item._id, user: req.user._id }).sort({ movementDate: 1, createdAt: 1 });
    const target = movements.find((entry) => String(entry._id) === String(movement._id));
    Object.assign(target, movement.toObject());
    movements.sort((a, b) => new Date(a.movementDate) - new Date(b.movementDate) || new Date(a.createdAt) - new Date(b.createdAt));
    const ledger = calculateMovementLedger(movements);
    const targetRow = ledger.rows.find((row) => String(row._id) === String(movement._id));
    movement.quantityChange = targetRow.quantityChange;
    movement.balanceAfter = targetRow.balanceAfter;
    await movement.save();
    for (const row of ledger.rows) {
      if (String(row._id) === String(movement._id)) continue;
      await StockMovement.updateOne(
        { _id: row._id, item: item._id, user: req.user._id },
        { $set: { quantityChange: row.quantityChange, balanceAfter: row.balanceAfter } }
      );
    }
    item.currentQuantity = ledger.currentQuantity;
    item.averageUnitCost = ledger.averageUnitCost;
    await item.save();

    const finance = await createLinkedExpense(item, movement, {
      ...req.body,
      createFinanceExpense: Boolean(movement.financeTransaction || req.body.createFinanceExpense)
    }, req.user._id);
    if (finance && String(movement.financeTransaction || "") !== String(finance._id)) {
      movement.financeTransaction = finance._id;
      await movement.save();
    }
    res.json({ item: itemView(item), movement });
  } catch (error) { next(error); }
}

export async function archiveInventoryItem(req, res, next) {
  try {
    const item = await InventoryItem.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { archivedAt: req.body.archived === false ? null : new Date() },
      { new: true }
    );
    if (!item) return res.status(404).json({ message: "Inventory item not found" });
    res.json(itemView(item));
  } catch (error) { next(error); }
}

export async function deleteInventoryItem(req, res, next) {
  try {
    const item = await InventoryItem.findOne({ _id: req.params.id, user: req.user._id });
    if (!item) return res.status(404).json({ message: "Inventory item not found" });
    const movements = await StockMovement.find({ item: item._id, user: req.user._id }).select("financeTransaction type");
    if (movements.some((entry) => entry.financeTransaction) || movements.some((entry) => !["opening_stock", "migration"].includes(entry.type))) {
      return res.status(409).json({ message: "This item has stock history. Archive it instead of deleting it." });
    }
    await StockMovement.deleteMany({ item: item._id, user: req.user._id });
    await item.deleteOne();
    res.json({ message: "Inventory item deleted" });
  } catch (error) { next(error); }
}
