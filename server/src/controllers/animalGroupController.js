import { randomUUID } from "node:crypto";
import { body } from "express-validator";
import mongoose from "mongoose";
import AnimalGroup, { calculateBiomass } from "../models/AnimalGroup.js";
import GroupQuantityEvent from "../models/GroupQuantityEvent.js";
import VaccinationCampaign from "../models/VaccinationCampaign.js";
import { groupQuantityDelta } from "../services/groupQuantityService.js";
import { campaignHistoryRecord } from "../utils/vaccinationCampaignViews.js";

const categories = ["poultry", "fish", "rabbits", "bees", "other"];
const quantityTypes = ["confirmed", "estimated"];
const quantityConfidences = ["high", "medium", "low", "not_applicable"];
const locationTypes = ["poultry_house", "coop", "pond", "tank", "cage", "hutch", "apiary", "other"];
const lifecycleStatuses = ["active", "sold", "harvested", "archived"];
const healthStatuses = ["healthy", "mild", "moderate", "serious", "critical", "recovering", "chronic", "stable", "unknown"];
const eventTypes = ["added", "purchased", "hatched", "born", "stocked", "death", "culled", "sold", "harvested", "transferred_in", "transferred_out", "missing", "stock_correction"];

export const groupRules = [
  body("groupId").optional({ values: "falsy" }).trim().matches(/^[A-Za-z0-9-]{3,30}$/).withMessage("Group ID may use letters, numbers, and hyphens"),
  body("groupName").trim().notEmpty().isLength({ max: 120 }).withMessage("Group name is required"),
  body("category").isIn(categories).withMessage("Choose a valid group category"),
  body("species").trim().notEmpty().isLength({ max: 100 }).withMessage("Species is required"),
  body("startingQuantity").isInt({ min: 1 }).withMessage("Starting quantity must be greater than zero"),
  body("quantityType").optional().isIn(quantityTypes),
  body("quantityConfidence").optional().isIn(quantityConfidences),
  body("locationType").optional().isIn(locationTypes),
  body("averageWeight").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("averageWeightUnit").optional().isIn(["g", "kg"]),
  body("purchaseCost").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("estimatedValue").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("hatchStockingOrArrivalDate").optional({ values: "falsy" }).isISO8601()
];

export const updateGroupRules = [
  body("groupName").optional().trim().notEmpty().isLength({ max: 120 }),
  body("category").optional().isIn(categories),
  body("species").optional().trim().notEmpty().isLength({ max: 100 }),
  body("quantityType").optional().isIn(quantityTypes),
  body("quantityConfidence").optional().isIn(quantityConfidences),
  body("locationType").optional().isIn(locationTypes),
  body("lifecycleStatus").optional().isIn(lifecycleStatuses),
  body("healthStatus").optional().isIn(healthStatuses),
  body("averageWeight").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("averageWeightUnit").optional().isIn(["g", "kg"]),
  body("purchaseCost").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("estimatedValue").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("hatchStockingOrArrivalDate").optional({ values: "falsy" }).isISO8601()
];

export const eventRules = [
  body("eventType").isIn(eventTypes).withMessage("Choose a valid quantity event"),
  body("quantity").isInt({ min: 0 }).withMessage("Quantity must be a whole number"),
  body("eventDate").optional({ values: "falsy" }).isISO8601().withMessage("Enter a valid event date"),
  body("financialAmount").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("idempotencyKey").optional({ values: "falsy" }).trim().isLength({ max: 120 })
];

const allowedGroupFields = ["groupName", "category", "species", "breedOrStrain", "productionPurpose", "quantityType", "quantityConfidence", "hatchStockingOrArrivalDate", "locationType", "locationName", "averageWeight", "averageWeightUnit", "purchaseCost", "estimatedValue", "supplierOrSource", "lifecycleStatus", "healthStatus", "notes"];

function pickGroupFields(source) {
  return allowedGroupFields.reduce((result, field) => {
    if (source[field] !== undefined) result[field] = source[field];
    return result;
  }, {});
}

function safeRegex(value) {
  return new RegExp(String(value || "").slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

function categoryPrefix(category, locationType) {
  if (category === "poultry") return "FLK";
  if (category === "fish") return locationType === "tank" ? "TNK" : "PND";
  if (category === "rabbits") return "RBT";
  if (category === "bees") return "API";
  return "GRP";
}

async function generateGroupId(userId, category, locationType) {
  const prefix = categoryPrefix(category, locationType);
  const latest = await AnimalGroup.findOne({ user: userId, groupId: new RegExp(`^${prefix}-\\d+$`) }).sort({ groupId: -1 }).select("groupId");
  const next = latest ? Number(latest.groupId.split("-").pop()) + 1 : 1;
  return `${prefix}-${String(next).padStart(3, "0")}`;
}

export async function listAnimalGroups(req, res, next) {
  try {
    const query = { user: req.user._id };
    if (req.query.category) query.category = req.query.category;
    if (req.query.lifecycleStatus) query.lifecycleStatus = req.query.lifecycleStatus;
    if (req.query.search) {
      const regex = safeRegex(req.query.search);
      query.$or = [{ groupId: regex }, { groupName: regex }, { species: regex }, { breedOrStrain: regex }, { locationName: regex }];
    }
    res.json(await AnimalGroup.find(query).sort({ createdAt: -1 }));
  } catch (error) { next(error); }
}

export async function createAnimalGroup(req, res, next) {
  let group;
  try {
    const groupId = String(req.body.groupId || await generateGroupId(req.user._id, req.body.category, req.body.locationType)).toUpperCase();
    const startingQuantity = Number(req.body.startingQuantity);
    group = await AnimalGroup.create({
      ...pickGroupFields(req.body), groupId, user: req.user._id,
      startingQuantity, currentQuantity: startingQuantity
    });
    await GroupQuantityEvent.create({
      user: req.user._id, group: group._id, eventType: "initial_stock", quantity: startingQuantity,
      quantityDelta: startingQuantity, balanceAfter: startingQuantity,
      eventDate: req.body.hatchStockingOrArrivalDate || new Date(), reason: "Group created",
      financialAmount: Number(req.body.purchaseCost || 0), createdBy: req.user._id,
      idempotencyKey: `initial-${group._id}`
    });
    res.status(201).json(group);
  } catch (error) {
    if (group?._id) await AnimalGroup.deleteOne({ _id: group._id, user: req.user._id });
    if (error.code === 11000) return res.status(409).json({ message: "Group ID already exists" });
    next(error);
  }
}

export async function getAnimalGroup(req, res, next) {
  try {
    const identifier = req.params.id;
    const identity = mongoose.isValidObjectId(identifier) ? { _id: identifier } : { qrCodeId: identifier };
    const group = await AnimalGroup.findOne({ ...identity, user: req.user._id });
    if (!group) return res.status(404).json({ message: "Animal group not found" });
    const [events, campaigns] = await Promise.all([
      GroupQuantityEvent.find({ user: req.user._id, group: group._id }).sort({ createdAt: 1 }),
      VaccinationCampaign.find({ user: req.user._id, "assignments.group": group._id }).sort({ scheduledDate: 1 })
    ]);
    const vaccinationCampaigns = campaigns.map((campaign) => {
      const assignment = campaign.assignments.find((item) => String(item.group) === String(group._id));
      return { ...campaignHistoryRecord(campaign, assignment), quantityTreated: assignment.quantityTreated };
    });
    res.json({ ...group.toObject(), quantityEvents: events, vaccinationCampaigns });
  } catch (error) { next(error); }
}

export async function updateAnimalGroup(req, res, next) {
  try {
    const group = await AnimalGroup.findOne({ _id: req.params.id, user: req.user._id });
    if (!group) return res.status(404).json({ message: "Animal group not found" });
    Object.assign(group, pickGroupFields(req.body));
    group.estimatedBiomass = calculateBiomass(group.currentQuantity, group.averageWeight, group.averageWeightUnit);
    await group.save();
    res.json(group);
  } catch (error) { next(error); }
}

export async function createQuantityEvent(req, res, next) {
  const idempotencyKey = String(req.body.idempotencyKey || req.get("Idempotency-Key") || randomUUID()).trim();
  let updatedGroup;
  let delta = 0;
  try {
    const duplicate = await GroupQuantityEvent.findOne({ user: req.user._id, group: req.params.id, idempotencyKey });
    if (duplicate) return res.status(409).json({ message: "This quantity event was already recorded" });
    const group = await AnimalGroup.findOne({ _id: req.params.id, user: req.user._id });
    if (!group) return res.status(404).json({ message: "Animal group not found" });
    const quantity = Number(req.body.quantity);
    if (req.body.eventType !== "stock_correction" && quantity < 1) return res.status(400).json({ message: "Quantity must be greater than zero" });
    delta = groupQuantityDelta(req.body.eventType, quantity, group.currentQuantity);
    const updateQuery = { _id: group._id, user: req.user._id };
    if (delta < 0) updateQuery.currentQuantity = { $gte: Math.abs(delta) };
    updatedGroup = await AnimalGroup.findOneAndUpdate(updateQuery, {
      $inc: { currentQuantity: delta }, $set: { lastQuantityEventAt: new Date() }
    }, { new: true, runValidators: true });
    if (!updatedGroup) return res.status(409).json({ message: "This event would make the current quantity negative" });
    updatedGroup.estimatedBiomass = calculateBiomass(updatedGroup.currentQuantity, updatedGroup.averageWeight, updatedGroup.averageWeightUnit);
    await updatedGroup.save();
    const event = await GroupQuantityEvent.create({
      user: req.user._id, group: group._id, eventType: req.body.eventType, quantity,
      quantityDelta: delta, balanceAfter: updatedGroup.currentQuantity,
      eventDate: req.body.eventDate || new Date(), reason: req.body.reason || "",
      destinationOrSource: req.body.destinationOrSource || "", financialAmount: Number(req.body.financialAmount || 0),
      notes: req.body.notes || "", createdBy: req.user._id, idempotencyKey
    });
    res.status(201).json({ group: updatedGroup, event });
  } catch (error) {
    if (updatedGroup && delta) {
      const restored = await AnimalGroup.findOneAndUpdate({ _id: updatedGroup._id, user: req.user._id }, { $inc: { currentQuantity: -delta } }, { new: true });
      if (restored) { restored.estimatedBiomass = calculateBiomass(restored.currentQuantity, restored.averageWeight, restored.averageWeightUnit); await restored.save(); }
    }
    if (error.code === 11000) return res.status(409).json({ message: "This quantity event was already recorded" });
    next(error);
  }
}

export async function archiveAnimalGroup(req, res, next) {
  try {
    const group = await AnimalGroup.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { lifecycleStatus: "archived" }, { new: true });
    if (!group) return res.status(404).json({ message: "Animal group not found" });
    res.json(group);
  } catch (error) { next(error); }
}
