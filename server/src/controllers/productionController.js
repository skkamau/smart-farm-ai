import { randomUUID } from "node:crypto";
import { body } from "express-validator";
import mongoose from "mongoose";
import Animal from "../models/Animal.js";
import AnimalGroup, { calculateBiomass } from "../models/AnimalGroup.js";
import Crop from "../models/Crop.js";
import GroupQuantityEvent from "../models/GroupQuantityEvent.js";
import InventoryItem from "../models/InventoryItem.js";
import ProduceSale from "../models/ProduceSale.js";
import ProductionRecord from "../models/ProductionRecord.js";
import StockMovement from "../models/StockMovement.js";
import { addProductionToInventory, outgoingReasons, productionAvailability, removeProductionStock, reverseProductionInventory, transferProductionStorage, updateProductionInventory } from "../services/productionInventoryService.js";

export const productTypes = ["eggs", "milk", "crop_harvest", "fish_harvest", "other_produce"];
export const sourceTypes = ["individual_animal", "animal_group", "crop", "field", "pond", "fish_group", "other"];
export const productionUnits = ["egg", "litre", "millilitre", "kilogram", "tonne", "bag", "crate", "piece", "other"];

export function calculateSellableQuantity(input) {
  const produced = Number(input.quantityProduced || 0);
  const removed = [input.quantityDamaged, input.quantityRejected, input.quantityUsedInternally, input.quantityReserved, input.quantityFedToYoung]
    .reduce((total, value) => total + Number(value || 0), 0);
  const sellable = produced - removed;
  if (![produced, removed, sellable].every(Number.isFinite) || produced < 0 || removed < 0 || sellable < 0) {
    throw new Error("Excluded quantities cannot exceed the quantity produced");
  }
  return Math.round((sellable + Number.EPSILON) * 1000000) / 1000000;
}

export const productionRules = [
  body("productType").isIn(productTypes).withMessage("Choose a supported product type"),
  body("productName").trim().notEmpty().isLength({ max: 120 }).withMessage("Product name is required"),
  body("sourceType").isIn(sourceTypes).withMessage("Choose a valid production source"),
  body("sourceId").custom((value, { req }) => req.body.sourceType === "other" || mongoose.isValidObjectId(value)).withMessage("Choose a valid production source"),
  body("productionDate").isISO8601().withMessage("Enter a valid production date"),
  body("quantityProduced").isFloat({ min: 0 }).withMessage("Produced quantity must be zero or greater"),
  body("baseUnit").isIn(productionUnits).withMessage("Choose a supported unit"),
  ...["quantityDamaged", "quantityRejected", "quantityUsedInternally", "quantityReserved", "quantityFedToYoung", "fishHarvestCount", "totalHarvestedWeight", "averageWeight"]
    .map((field) => body(field).optional({ values: "falsy" }).isFloat({ min: 0 }).withMessage(`${field} must be zero or greater`)),
  body("expiryDate").optional({ values: "falsy" }).isISO8601().withMessage("Enter a valid expiry date"),
  body("fishHarvestType").optional({ values: "falsy" }).isIn(["sample", "partial", "full"]),
  body().custom((payload) => {
    calculateSellableQuantity(payload);
    if (payload.productType === "eggs" && payload.baseUnit !== "egg") throw new Error("Egg production must be recorded in individual eggs");
    if (payload.productType === "milk" && !["litre", "millilitre"].includes(payload.baseUnit)) throw new Error("Milk must use litres or millilitres");
    if (payload.productType === "fish_harvest" && !payload.fishHarvestType) throw new Error("Choose a fish harvest type");
    if (payload.productType === "fish_harvest" && payload.fishHarvestType !== "sample" && Number(payload.fishHarvestCount || 0) < 1) throw new Error("Enter the confirmed number of fish removed");
    return true;
  })
];

export const removalRules = [
  body("reason").isIn([...outgoingReasons]).withMessage("Choose a valid removal reason"),
  body("quantity").isFloat({ gt: 0 }).withMessage("Quantity must be greater than zero"),
  body("movementDate").optional({ values: "falsy" }).isISO8601().withMessage("Enter a valid date"),
  body("idempotencyKey").trim().notEmpty().isLength({ max: 120 }).withMessage("A valid submission key is required"),
  body("notes").optional({ values: "falsy" }).trim().isLength({ max: 2000 })
];

export const reversalRules = [
  body("reason").trim().isLength({ min: 3, max: 500 }).withMessage("Enter a reversal reason")
];

export const transferRules = [
  body("storageLocation").trim().notEmpty().isLength({ max: 160 }).withMessage("Enter the new storage location"),
  body("movementDate").optional({ values: "falsy" }).isISO8601().withMessage("Enter a valid transfer date"),
  body("idempotencyKey").trim().notEmpty().isLength({ max: 120 }).withMessage("A valid submission key is required")
];

function cleanText(value, max = 3000) {
  return String(value || "").trim().slice(0, max);
}

async function resolveSource(userId, sourceType, sourceId) {
  if (sourceType === "other") return { sourceId: null, sourceModel: "Other", sourceLabel: "Other farm source", source: null };
  if (sourceType === "individual_animal") {
    const source = await Animal.findOne({ _id: sourceId, user: userId, lifecycleStatus: "active" });
    if (!source) return null;
    return { sourceId: source._id, sourceModel: "Animal", sourceLabel: `${source.animalId} - ${source.name || source.species}`, source };
  }
  if (["animal_group", "pond", "fish_group"].includes(sourceType)) {
    const source = await AnimalGroup.findOne({ _id: sourceId, user: userId, lifecycleStatus: "active" });
    if (!source || (["pond", "fish_group"].includes(sourceType) && source.category !== "fish")) return null;
    return { sourceId: source._id, sourceModel: "AnimalGroup", sourceLabel: `${source.groupId} - ${source.groupName}`, source };
  }
  const source = await Crop.findOne({ _id: sourceId, user: userId });
  if (!source) return null;
  return { sourceId: source._id, sourceModel: "Crop", sourceLabel: `${source.name} - ${source.plot || source.field}`, source };
}

function batchPrefix(type) {
  return { eggs: "EGG", milk: "MILK", crop_harvest: "CROP", fish_harvest: "FISH", other_produce: "PROD" }[type];
}

function buildBatchReference(type, date) {
  const stamp = new Date(date).toISOString().slice(0, 10).replaceAll("-", "");
  return `${batchPrefix(type)}-${stamp}-${randomUUID().slice(0, 6).toUpperCase()}`;
}

function productionPayload(body, source, userId) {
  return {
    user: userId,
    batchReference: buildBatchReference(body.productType, body.productionDate),
    productType: body.productType,
    productName: cleanText(body.productName, 120),
    sourceType: body.sourceType,
    sourceId: source.sourceId,
    sourceModel: source.sourceModel,
    sourceLabel: source.sourceLabel,
    productionDate: body.productionDate,
    session: cleanText(body.session, 80),
    quantityProduced: Number(body.quantityProduced),
    baseUnit: body.baseUnit,
    quantityDamaged: Number(body.quantityDamaged || 0),
    quantityRejected: Number(body.quantityRejected || 0),
    quantityUsedInternally: Number(body.quantityUsedInternally || 0),
    quantityReserved: Number(body.quantityReserved || 0),
    quantityFedToYoung: body.productType === "milk" ? Number(body.quantityFedToYoung || 0) : 0,
    quantitySellable: calculateSellableQuantity(body),
    storageLocation: cleanText(body.storageLocation, 160),
    expiryDate: body.expiryDate || null,
    qualityGrade: cleanText(body.qualityGrade, 80),
    qualityNotes: cleanText(body.qualityNotes, 1000),
    fishHarvestType: body.productType === "fish_harvest" ? body.fishHarvestType : "",
    fishHarvestCount: body.productType === "fish_harvest" ? Number(body.fishHarvestCount || 0) : 0,
    totalHarvestedWeight: body.productType === "fish_harvest" ? Number(body.totalHarvestedWeight || 0) : 0,
    averageWeight: body.productType === "fish_harvest" ? Number(body.averageWeight || 0) : 0,
    averageWeightUnit: body.averageWeightUnit === "g" ? "g" : "kg",
    notes: cleanText(body.notes),
    createdBy: userId
  };
}

async function applyFishHarvest(record, source) {
  const count = Number(record.fishHarvestCount || 0);
  if (!count || !source) return null;
  const idempotencyKey = `production-${record._id}`;
  const existing = await GroupQuantityEvent.findOne({ user: record.user, group: source._id, idempotencyKey });
  if (existing) return existing;
  const updated = await AnimalGroup.findOneAndUpdate(
    { _id: source._id, user: record.user, category: "fish", currentQuantity: { $gte: count } },
    { $inc: { currentQuantity: -count }, $set: { lastQuantityEventAt: new Date() } },
    { new: true, runValidators: true }
  );
  if (!updated) throw new Error("Fish harvest exceeds the group's current quantity");
  updated.estimatedBiomass = calculateBiomass(updated.currentQuantity, updated.averageWeight, updated.averageWeightUnit);
  await updated.save();
  try {
    return await GroupQuantityEvent.create({
      user: record.user, group: source._id, eventType: "harvested", quantity: count,
      quantityDelta: -count, balanceAfter: updated.currentQuantity, eventDate: record.productionDate,
      reason: `${record.productName} production harvest`, notes: `Production batch ${record.batchReference}`,
      createdBy: record.createdBy, idempotencyKey
    });
  } catch (error) {
    await AnimalGroup.updateOne({ _id: source._id, user: record.user }, { $inc: { currentQuantity: count } });
    throw error;
  }
}

export async function createProductionRecord(req, res, next) {
  let record;
  let fishEvent;
  let fishSource;
  try {
    const source = await resolveSource(req.user._id, req.body.sourceType, req.body.sourceId);
    if (!source) return res.status(400).json({ message: "Production source was not found for this farm" });
    if (req.body.productType === "eggs" && !(source.sourceModel === "AnimalGroup" && source.source.category === "poultry")) {
      return res.status(400).json({ message: "Egg production must use a poultry group" });
    }
    if (req.body.productType === "crop_harvest" && source.sourceModel !== "Crop") {
      return res.status(400).json({ message: "Crop harvest must use a crop or field" });
    }
    if (req.body.productType === "fish_harvest" && !(source.sourceModel === "AnimalGroup" && source.source.category === "fish")) {
      return res.status(400).json({ message: "Fish harvest must use a fish group, pond, tank, or cage" });
    }
    record = await ProductionRecord.create(productionPayload(req.body, source, req.user._id));
    fishSource = req.body.productType === "fish_harvest" ? source.source : null;
    fishEvent = fishSource ? await applyFishHarvest(record, fishSource) : null;
    if (fishEvent) {
      record.groupQuantityEvent = fishEvent._id;
      await record.save();
    }
    await addProductionToInventory(record);
    res.status(201).json(record);
  } catch (error) {
    if (fishEvent && fishSource) {
      await AnimalGroup.updateOne({ _id: fishSource._id, user: req.user._id }, { $inc: { currentQuantity: Number(record.fishHarvestCount || 0) } }).catch(() => {});
      await GroupQuantityEvent.deleteOne({ _id: fishEvent._id, user: req.user._id }).catch(() => {});
    }
    if (record?._id && !record.inventoryMovement) await ProductionRecord.deleteOne({ _id: record._id, user: req.user._id }).catch(() => {});
    if (error.code === 11000) return res.status(409).json({ message: "This production batch already exists" });
    if (/exceeds/.test(error.message)) return res.status(409).json({ message: error.message });
    next(error);
  }
}

function safeRegex(value) {
  return new RegExp(String(value || "").slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

function listQuery(req) {
  const query = { user: req.user._id };
  if (req.query.productType && productTypes.includes(req.query.productType)) query.productType = req.query.productType;
  if (req.query.sourceType && sourceTypes.includes(req.query.sourceType)) query.sourceType = req.query.sourceType;
  if (req.query.sourceId && mongoose.isValidObjectId(req.query.sourceId)) query.sourceId = req.query.sourceId;
  if (req.query.status && ["active", "reversed"].includes(req.query.status)) query.status = req.query.status;
  if (req.query.from || req.query.to) {
    query.productionDate = {};
    if (req.query.from) query.productionDate.$gte = new Date(req.query.from);
    if (req.query.to) { const end = new Date(req.query.to); end.setHours(23, 59, 59, 999); query.productionDate.$lte = end; }
  }
  if (req.query.search) {
    const search = safeRegex(req.query.search);
    query.$or = [{ batchReference: search }, { productName: search }, { sourceLabel: search }, { storageLocation: search }];
  }
  return query;
}

export async function listProductionRecords(req, res, next) {
  try {
    const records = await ProductionRecord.find(listQuery(req)).sort({ productionDate: -1, createdAt: -1 }).limit(500).lean();
    const availability = await availabilityMap(records, req.user._id);
    res.json(records.map((record) => ({ ...record, availableQuantity: availability.get(String(record._id)) || 0 })));
  } catch (error) { next(error); }
}

export async function getProductionRecord(req, res, next) {
  try {
    const record = await ProductionRecord.findOne({ _id: req.params.id, user: req.user._id });
    if (!record) return res.status(404).json({ message: "Production record not found" });
    const [availability, movements] = await Promise.all([
      productionAvailability(record, req.user._id),
      StockMovement.find({ user: req.user._id, productionRecord: record._id }).sort({ movementDate: -1, createdAt: -1 })
    ]);
    res.json({ ...record.toObject(), availableQuantity: availability.available, movements });
  } catch (error) { next(error); }
}

async function availabilityMap(records, user) {
  if (!records.length) return new Map();
  const rows = await StockMovement.aggregate([
    { $match: { user, productionRecord: { $in: records.map((record) => record._id) } } },
    { $group: { _id: "$productionRecord", available: { $sum: "$quantityChange" } } }
  ]);
  return new Map(rows.map((row) => [String(row._id), row.available]));
}

export async function availableProduce(req, res, next) {
  try {
    const records = await ProductionRecord.find({ user: req.user._id, status: "active", inventoryMovement: { $ne: null } }).lean();
    records.sort((a, b) => (a.expiryDate ? new Date(a.expiryDate).getTime() : Number.MAX_SAFE_INTEGER) - (b.expiryDate ? new Date(b.expiryDate).getTime() : Number.MAX_SAFE_INTEGER) || new Date(a.productionDate) - new Date(b.productionDate));
    const availability = await availabilityMap(records, req.user._id);
    res.json(records.map((record) => ({ ...record, availableQuantity: availability.get(String(record._id)) || 0 })).filter((record) => record.availableQuantity > 0));
  } catch (error) { next(error); }
}

export async function listProductionRemovals(req, res, next) {
  try {
    const movements = await StockMovement.find({
      user: req.user._id, productionRecord: { $ne: null }, quantityChange: { $lt: 0 }, productionRemovalReason: { $in: [...outgoingReasons] }
    }).populate("productionRecord", "batchReference productName baseUnit sourceLabel").sort({ movementDate: -1, createdAt: -1 }).limit(500);
    res.json(movements);
  } catch (error) { next(error); }
}

export async function updateProductionRecord(req, res, next) {
  try {
    const record = await ProductionRecord.findOne({ _id: req.params.id, user: req.user._id }).select("+stockVersion");
    if (!record) return res.status(404).json({ message: "Production record not found" });
    if (record.status !== "active") return res.status(409).json({ message: "Reversed production cannot be edited" });
    const immutableChecks = [["productType", record.productType], ["sourceType", record.sourceType], ["sourceId", String(record.sourceId || "")], ["baseUnit", record.baseUnit], ["productName", record.productName], ["productionDate", new Date(record.productionDate).toISOString().slice(0, 10)]];
    const changed = immutableChecks.find(([field, value]) => String(req.body[field] || "") !== String(value));
    if (changed) return res.status(409).json({ message: `${changed[0]} cannot change after produce enters Inventory` });
    if (record.productType === "fish_harvest" && Number(req.body.fishHarvestCount || 0) !== Number(record.fishHarvestCount || 0)) {
      return res.status(409).json({ message: "Confirmed fish count cannot change after the group quantity event" });
    }
    const newSellable = calculateSellableQuantity(req.body);
    if (record.inventoryMovement) await updateProductionInventory(record, newSellable);
    const mutable = productionPayload(req.body, { sourceId: record.sourceId, sourceModel: record.sourceModel, sourceLabel: record.sourceLabel }, req.user._id);
    for (const field of ["session", "quantityProduced", "quantityDamaged", "quantityRejected", "quantityUsedInternally", "quantityReserved", "quantityFedToYoung", "quantitySellable", "storageLocation", "expiryDate", "qualityGrade", "qualityNotes", "fishHarvestType", "totalHarvestedWeight", "averageWeight", "averageWeightUnit", "notes"]) record[field] = mutable[field];
    await record.save();
    if (!record.inventoryMovement && newSellable > 0) await addProductionToInventory(record);
    res.json({ ...record.toObject(), availableQuantity: (await productionAvailability(record, req.user._id)).available });
  } catch (error) { next(error); }
}

export async function createProductionRemoval(req, res, next) {
  try {
    const record = await ProductionRecord.findOne({ _id: req.params.id, user: req.user._id, status: "active" }).select("+stockVersion");
    if (!record) return res.status(404).json({ message: "Active production batch not found" });
    if (!record.inventoryMovement || !record.inventoryItem) return res.status(409).json({ message: "This batch is not linked to Inventory" });
    const movement = await removeProductionStock(record, { ...req.body, createdBy: req.user._id });
    res.status(201).json({ movement, availableQuantity: (await productionAvailability(record, req.user._id)).available });
  } catch (error) { next(error); }
}

export async function transferProductionRecord(req, res, next) {
  try {
    const record = await ProductionRecord.findOne({ _id: req.params.id, user: req.user._id, status: "active" }).select("+stockVersion");
    if (!record) return res.status(404).json({ message: "Active production batch not found" });
    if (!record.inventoryMovement || !record.inventoryItem) return res.status(409).json({ message: "This batch is not linked to Inventory" });
    await transferProductionStorage(record, { ...req.body, createdBy: req.user._id });
    res.json({ ...record.toObject(), availableQuantity: (await productionAvailability(record, req.user._id)).available });
  } catch (error) { next(error); }
}

export async function reverseProductionRecord(req, res, next) {
  let restoredFishGroup;
  let fishReversalEvent;
  let fishRestoredCount = 0;
  let inventoryReversal;
  let inventoryReversalExisted = false;
  try {
    const record = await ProductionRecord.findOne({ _id: req.params.id, user: req.user._id, status: "active" }).select("+stockVersion");
    if (!record) return res.status(404).json({ message: "Active production batch not found" });
    if (await ProduceSale.exists({ user: req.user._id, productionRecord: record._id, status: "confirmed" })) {
      return res.status(409).json({ message: "Cancel or resolve linked produce sales before reversing this production batch" });
    }
    if (record.groupQuantityEvent && Number(record.fishHarvestCount || 0) > 0) {
      const idempotencyKey = `production-reversal-${record._id}`;
      fishReversalEvent = await GroupQuantityEvent.findOne({ user: req.user._id, group: record.sourceId, idempotencyKey });
      if (!fishReversalEvent) {
        restoredFishGroup = await AnimalGroup.findOneAndUpdate({ _id: record.sourceId, user: req.user._id }, { $inc: { currentQuantity: record.fishHarvestCount } }, { new: true });
        if (!restoredFishGroup) return res.status(409).json({ message: "Fish group could not be restored" });
        try {
          fishReversalEvent = await GroupQuantityEvent.create({ user: req.user._id, group: restoredFishGroup._id, eventType: "added", quantity: record.fishHarvestCount, quantityDelta: record.fishHarvestCount, balanceAfter: restoredFishGroup.currentQuantity, eventDate: new Date(), reason: "Production harvest reversed", notes: req.body.reason, createdBy: req.user._id, idempotencyKey });
          fishRestoredCount = Number(record.fishHarvestCount);
        } catch (error) {
          await AnimalGroup.updateOne({ _id: restoredFishGroup._id, user: req.user._id }, { $inc: { currentQuantity: -record.fishHarvestCount } });
          restoredFishGroup = null;
          throw error;
        }
      }
    }
    if (record.inventoryMovement) inventoryReversalExisted = Boolean(await StockMovement.exists({ user: req.user._id, sourceKey: `production:${record._id}:reversal` }));
    inventoryReversal = record.inventoryMovement ? await reverseProductionInventory(record, req.body.reason, req.user._id) : null;
    record.status = "reversed"; record.reversalReason = req.body.reason; record.reversedAt = new Date(); record.reversedBy = req.user._id; record.reversalMovement = inventoryReversal?._id || null;
    await record.save();
    res.json(record);
  } catch (error) {
    if (inventoryReversal && !inventoryReversalExisted) {
      await InventoryItem.updateOne({ _id: inventoryReversal.item, user: req.user._id }, { $inc: { currentQuantity: Number(inventoryReversal.quantity) } }).catch(() => {});
      await StockMovement.deleteOne({ _id: inventoryReversal._id, user: req.user._id }).catch(() => {});
    }
    if (restoredFishGroup && fishReversalEvent) {
      await AnimalGroup.updateOne({ _id: restoredFishGroup._id, user: req.user._id }, { $inc: { currentQuantity: -fishRestoredCount } }).catch(() => {});
      await GroupQuantityEvent.deleteOne({ _id: fishReversalEvent._id, user: req.user._id }).catch(() => {});
    }
    next(error);
  }
}

export async function productionOverview(req, res, next) {
  try {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startWeek = new Date(startToday); startWeek.setDate(startWeek.getDate() - 6);
    const rows = await ProductionRecord.aggregate([
      { $match: { user: req.user._id, status: "active" } },
      { $group: {
        _id: { baseUnit: "$baseUnit", productType: "$productType" },
        produced: { $sum: "$quantityProduced" }, sellable: { $sum: "$quantitySellable" },
        damaged: { $sum: "$quantityDamaged" }, rejected: { $sum: "$quantityRejected" },
        internal: { $sum: "$quantityUsedInternally" }, reserved: { $sum: "$quantityReserved" },
        fedToYoung: { $sum: "$quantityFedToYoung" },
        today: { $sum: { $cond: [{ $gte: ["$productionDate", startToday] }, "$quantityProduced", 0] } },
        week: { $sum: { $cond: [{ $gte: ["$productionDate", startWeek] }, "$quantityProduced", 0] } }
      } },
      { $sort: { "_id.productType": 1, "_id.baseUnit": 1 } }
    ]);
    const recent = await ProductionRecord.find({ user: req.user._id }).sort({ productionDate: -1, createdAt: -1 }).limit(6).lean();
    const availability = await availabilityMap(recent, req.user._id);
    const inventoryByUnit = await StockMovement.aggregate([
      { $match: { user: req.user._id, productionRecord: { $ne: null } } },
      { $lookup: { from: "productionrecords", localField: "productionRecord", foreignField: "_id", as: "production" } },
      { $unwind: "$production" }, { $match: { "production.status": "active" } },
      { $group: { _id: { productType: "$production.productType", baseUnit: "$production.baseUnit" }, available: { $sum: "$quantityChange" } } }
    ]);
    const salesByUnit = await ProduceSale.aggregate([
      { $match: { user: req.user._id, status: "confirmed" } },
      { $lookup: { from: "productionrecords", localField: "productionRecord", foreignField: "_id", as: "production" } },
      { $unwind: "$production" },
      { $group: { _id: { productType: "$production.productType", baseUnit: "$baseUnit" }, sold: { $sum: "$baseQuantity" }, revenue: { $sum: "$totalAmount" } } }
    ]);
    const availableLookup = new Map(inventoryByUnit.map((item) => [`${item._id.productType}:${item._id.baseUnit}`, item.available]));
    const salesLookup = new Map(salesByUnit.map((item) => [`${item._id.productType}:${item._id.baseUnit}`, item]));
    res.json({ totalsByUnit: rows.map((row) => { const key = `${row._id.productType}:${row._id.baseUnit}`; return { productType: row._id.productType, baseUnit: row._id.baseUnit, ...row, available: availableLookup.get(key) || 0, sold: salesLookup.get(key)?.sold || 0, revenue: salesLookup.get(key)?.revenue || 0, _id: undefined }; }), recent: recent.map((record) => ({ ...record, availableQuantity: availability.get(String(record._id)) || 0 })) });
  } catch (error) { next(error); }
}
