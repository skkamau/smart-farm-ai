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
  body("expiryDate").optional({ values: "falsy" }).isISO8601().toDate()
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
  try {
    const openingQuantity = Number(req.body.openingQuantity || 0);
    const unitCost = Number(req.body.unitCost || 0);
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
    await StockMovement.create({
      user: req.user._id, item: item._id, type: "opening_stock",
      quantity: openingQuantity, quantityChange: openingQuantity, balanceAfter: openingQuantity,
      movementDate: req.body.openingDate || new Date(), unitCost, supplier: item.supplier,
      notes: "Opening stock", createdBy: req.user._id
    });
    res.status(201).json(itemView(item));
  } catch (error) {
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
  if (!source.createFinanceExpense || !amount) return null;
  const financeSection = item.category === "Feed" ? "Feed" : item.category === "Fuel" ? "Fuel" : item.category === "Equipment" ? "Equipment" : "Consumables";
  return Transaction.create({
    user, type: "expense", financeSection, category: item.category, source: "inventory",
    inventoryMovement: movement._id, amount, totalCost: amount, transactionDate: movement.movementDate,
    item: item.name, description: `Stock purchase: ${item.name}`, quantity: movement.quantity,
    unit: item.unit, unitCost: movement.unitCost, paymentMethod: movement.paymentMethod,
    supplierVendor: movement.supplier, storageLocation: item.storageLocation, notes: movement.notes
  });
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
