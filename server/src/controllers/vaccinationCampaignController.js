import { body } from "express-validator";
import mongoose from "mongoose";
import Animal from "../models/Animal.js";
import AnimalGroup from "../models/AnimalGroup.js";
import Transaction from "../models/Transaction.js";
import VaccinationCampaign from "../models/VaccinationCampaign.js";
import VaccinationTemplate from "../models/VaccinationTemplate.js";
import {
  calculateCampaignCost,
  canonicalSpecies,
  isSpeciesCompatible,
  resolveCampaignStatus,
  systemVaccinationTemplates
} from "../services/vaccinationCampaignService.js";

const speciesOptions = ["sheep", "goat", "cattle", "poultry", "pig", "rabbit", "fish", "dog", "other"];
const campaignStatuses = ["scheduled", "due_soon", "overdue", "completed", "partially_completed", "cancelled", "missed"];
const completionStatuses = ["scheduled", "completed", "missed", "postponed"];

export const campaignRules = [
  body("scheduleName").trim().notEmpty().isLength({ max: 160 }).withMessage("Schedule name is required"),
  body("species").optional().isIn(speciesOptions).withMessage("Choose a supported species"),
  body("supportedSpecies").isArray({ min: 1, max: speciesOptions.length }).withMessage("Choose at least one supported species"),
  body("supportedSpecies.*").isIn(speciesOptions).withMessage("Choose only supported species"),
  body("customSpecies").if(body("species").equals("other")).trim().notEmpty().isLength({ max: 100 }).withMessage("Enter the species name"),
  body("vaccineName").trim().notEmpty().isLength({ max: 160 }).withMessage("Vaccine or treatment name is required"),
  body("diseasePrevented").trim().notEmpty().isLength({ max: 240 }).withMessage("Disease prevented is required"),
  body("treatmentType").optional().isIn(["vaccination", "preventive_treatment"]),
  body("scheduledDate").isISO8601().toDate().withMessage("Enter a valid scheduled date"),
  body("dateIssued").optional({ values: "falsy" }).isISO8601().toDate().withMessage("Enter a valid date issued"),
  body("firstVaccinationDate").optional({ values: "falsy" }).isISO8601().toDate(),
  body("nextVaccinationDate").optional({ values: "falsy" }).isISO8601().toDate(),
  body("boosterDate").optional({ values: "falsy" }).isISO8601().toDate(),
  body("expiryDate").optional({ values: "falsy" }).isISO8601().toDate(),
  body("dose").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("vaccineCost").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("serviceCharge").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("transportCost").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("otherCost").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("inventoryQuantityUsed").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("inventorySourceTransaction").optional({ values: "falsy" }).isMongoId(),
  body("previousCampaign").optional({ values: "falsy" }).isMongoId(),
  body("costMode").optional().isIn(["total", "per_animal", "per_group"]),
  body("status").optional().isIn(campaignStatuses),
  body("assignments").isArray({ min: 1, max: 500 }).withMessage("Select between 1 and 500 animals or groups"),
  body("assignments.*.targetType").isIn(["individual", "group"]),
  body("assignments.*.animal").optional({ values: "falsy" }).isMongoId(),
  body("assignments.*.group").optional({ values: "falsy" }).isMongoId(),
  body("assignments.*.quantityTreated").optional({ values: "falsy" }).isInt({ min: 0 }),
  body("assignments.*.completionStatus").optional().isIn(completionStatuses),
  body("assignments.*.completedDate").optional({ values: "falsy" }).isISO8601().toDate(),
  body("reminderSettings.daysBefore").optional().isInt({ min: 0, max: 365 })
];

export const templateRules = [
  body("scheduleName").trim().notEmpty().isLength({ max: 160 }),
  body("species").optional().isIn(speciesOptions),
  body("supportedSpecies").isArray({ min: 1, max: speciesOptions.length }),
  body("supportedSpecies.*").isIn(speciesOptions),
  body("customSpecies").if(body("species").equals("other")).trim().notEmpty().isLength({ max: 100 }),
  body("vaccineName").trim().notEmpty().isLength({ max: 160 }),
  body("dose").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("treatmentType").optional().isIn(["vaccination", "preventive_treatment"])
];

const campaignFields = [
  "template", "scheduleName", "species", "supportedSpecies", "customSpecies", "appliesToMultipleSpecies", "breedOrStrain", "productionType",
  "treatmentType", "vaccineName", "diseasePrevented", "recommendedStage", "recommendedTiming", "explanation", "majorSigns", "safetyNotice", "firstVaccinationDate", "dateIssued", "scheduledDate",
  "nextVaccinationDate", "boosterDate", "boosterInterval", "recurrence", "dose", "doseUnit", "administrationRoute",
  "vetName", "provider", "batchNumber", "expiryDate", "vaccineCost", "serviceCharge", "transportCost", "otherCost",
  "costMode", "paymentMethod", "reminderSettings", "status", "assignments", "inventorySourceTransaction", "inventoryQuantityUsed", "previousCampaign", "notes"
];

const templateFields = ["templateKey", "scheduleName", "species", "supportedSpecies", "customSpecies", "breedOrStrain", "productionType", "treatmentType", "vaccineName", "diseasePrevented", "recommendedStage", "recommendedTiming", "explanation", "majorSigns", "safetyNotice", "boosterInterval", "recurrence", "dose", "doseUnit", "administrationRoute", "notes"];

function pick(source, fields) {
  return fields.reduce((result, field) => {
    if (source[field] !== undefined) result[field] = source[field];
    return result;
  }, {});
}

export function buildCampaignPayload(source) {
  const output = pick(source, campaignFields);
  for (const field of ["template", "inventorySourceTransaction", "previousCampaign"]) {
    if (!output[field]) delete output[field];
  }
  for (const field of ["dose", "vaccineCost", "serviceCharge", "transportCost", "otherCost", "inventoryQuantityUsed"]) {
    if (output[field] !== undefined) output[field] = Number(output[field] || 0);
  }
  output.supportedSpecies = [...new Set((output.supportedSpecies?.length ? output.supportedSpecies : [output.species]).map(canonicalSpecies).filter(Boolean))];
  output.species = output.species || output.supportedSpecies[0];
  output.assignments = (output.assignments || []).map((assignment) => ({
    targetType: assignment.targetType,
    animal: assignment.targetType === "individual" ? assignment.animal : null,
    group: assignment.targetType === "group" ? assignment.group : null,
    quantityTreated: assignment.targetType === "group" ? Number(assignment.quantityTreated || 0) : 1,
    completionStatus: assignment.completionStatus || "scheduled",
    completedDate: assignment.completedDate || null,
    notes: String(assignment.notes || "").trim()
  }));
  output.totalCost = calculateCampaignCost(output, output.assignments);
  return output;
}

async function validateOwnedAssignments(user, payload, confirmMultipleSpecies) {
  const individualIds = payload.assignments.filter((item) => item.targetType === "individual").map((item) => item.animal);
  const groupIds = payload.assignments.filter((item) => item.targetType === "group").map((item) => item.group);
  if (individualIds.some((id) => !id) || groupIds.some((id) => !id)) return { error: "Every assignment must identify an animal or group" };
  const [animals, groups] = await Promise.all([
    Animal.find({ _id: { $in: individualIds }, user, lifecycleStatus: "active" }),
    AnimalGroup.find({ _id: { $in: groupIds }, user, lifecycleStatus: "active" })
  ]);
  if (animals.length !== new Set(individualIds.map(String)).size) return { error: "One or more animals were not found or are inactive" };
  if (groups.length !== new Set(groupIds.map(String)).size) return { error: "One or more groups were not found or are inactive" };

  const targets = [
    ...animals.map((animal) => ({ id: animal._id, species: animal.species, category: "" })),
    ...groups.map((group) => ({ id: group._id, species: group.species, category: group.category, quantity: group.currentQuantity }))
  ];
  const incompatible = targets.filter((target) => !isSpeciesCompatible(payload.supportedSpecies, target.species, target.category, payload.customSpecies));
  if (incompatible.length && confirmMultipleSpecies !== true) return { error: "Confirm the incompatible species selection before saving" };

  for (const assignment of payload.assignments.filter((item) => item.targetType === "group")) {
    const group = groups.find((item) => String(item._id) === String(assignment.group));
    if (!assignment.quantityTreated || assignment.quantityTreated > group.currentQuantity) {
      return { error: `Quantity treated for ${group.groupId} must be between 1 and ${group.currentQuantity}` };
    }
  }
  return { animals, groups };
}

async function populateCampaign(query) {
  return query
    .populate("assignments.animal", "animalId name species breed gender dateOfBirth healthStatus lifecycleStatus")
    .populate("assignments.group", "groupId groupName species category breedOrStrain currentQuantity healthStatus lifecycleStatus")
    .populate("inventorySourceTransaction", "item financeSection balance unit batchNumber expiryDate")
    .populate("template", "scheduleName species vaccineName");
}

async function syncCampaignFinance(campaign) {
  if (!campaign.totalCost) {
    if (campaign.financeTransaction) await Transaction.findOneAndUpdate(
      { _id: campaign.financeTransaction, user: campaign.user, reversedAt: null },
      { reversedAt: new Date(), reversalReason: "Vaccination campaign cost removed", reversedBy: campaign.user }
    );
    return;
  }
  const data = {
    user: campaign.user,
    type: "expense",
    financeSection: "AnimalHealth",
    category: "Vaccination",
    vaccinationCampaign: campaign._id,
    source: "vaccination",
    sourceType: "vaccination_campaign",
    sourceId: String(campaign._id),
    sourceKey: `vaccination_campaign:${campaign._id}`,
    transactionId: `FIN-CAM-${String(campaign._id).slice(-8).toUpperCase()}`,
    linkedRecordType: "Vaccination campaign",
    linkedRecordId: campaign._id,
    enterpriseType: "Whole farm",
    transactionDate: campaign.dateIssued || campaign.firstVaccinationDate || campaign.scheduledDate,
    item: campaign.vaccineName,
    description: `${campaign.scheduleName}: ${campaign.assignments.length} selected target${campaign.assignments.length === 1 ? "" : "s"}`,
    amount: campaign.totalCost,
    paymentStatus: "paid",
    amountPaid: campaign.totalCost,
    amountOutstanding: 0,
    reversedAt: null,
    reversalReason: "",
    reversedBy: null,
    totalCost: campaign.totalCost,
    serviceCharge: campaign.serviceCharge,
    medicineCost: campaign.vaccineCost,
    transportCost: campaign.transportCost,
    otherCost: campaign.otherCost,
    paymentMethod: campaign.paymentMethod,
    notes: campaign.notes
  };
  const transaction = campaign.financeTransaction
    ? await Transaction.findOneAndUpdate({ _id: campaign.financeTransaction, user: campaign.user }, data, { new: true, runValidators: true })
    : await Transaction.findOneAndUpdate(
      { user: campaign.user, sourceKey: data.sourceKey },
      data,
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );
  if (!campaign.financeTransaction && transaction) {
    campaign.financeTransaction = transaction._id;
    await campaign.save();
  }
}

async function deductCampaignInventory(campaign) {
  if (!campaign.inventorySourceTransaction || !campaign.inventoryQuantityUsed || campaign.inventoryDeductionTransaction) return;
  const source = await Transaction.findOne({ _id: campaign.inventorySourceTransaction, user: campaign.user });
  if (!source || !["Feed", "Fuel", "Consumables"].includes(source.financeSection)) throw Object.assign(new Error("Selected vaccine inventory item was not found"), { statusCode: 404 });
  const latest = await Transaction.findOne({ user: campaign.user, financeSection: source.financeSection, item: source.item }).sort({ transactionDate: -1, createdAt: -1 });
  const available = Number(latest?.balance || 0);
  if (available < campaign.inventoryQuantityUsed) throw Object.assign(new Error(`Insufficient stock. ${available} ${source.unit || "units"} available`), { statusCode: 409 });
  const claimed = await VaccinationCampaign.findOneAndUpdate(
    { _id: campaign._id, user: campaign.user, inventoryDeductedAt: null },
    { $set: { inventoryDeductedAt: new Date() } },
    { new: true }
  );
  if (!claimed) return;
  try {
    const movement = await Transaction.create({
      user: campaign.user, type: "expense", financeSection: source.financeSection, category: "Vaccination inventory use",
      vaccinationCampaign: campaign._id, source: "vaccination", amount: 0, totalCost: 0,
      transactionDate: new Date(), item: source.item, description: `Used for ${campaign.scheduleName}`,
      unit: source.unit, quantityOut: campaign.inventoryQuantityUsed, balance: available - campaign.inventoryQuantityUsed,
      storageLocation: source.storageLocation, expiryDate: source.expiryDate, notes: `Campaign ${campaign._id}`
    });
    campaign.inventoryDeductionTransaction = movement._id;
    campaign.inventoryDeductedAt = claimed.inventoryDeductedAt;
    await campaign.save();
  } catch (error) {
    await VaccinationCampaign.updateOne({ _id: campaign._id, user: campaign.user }, { $set: { inventoryDeductedAt: null } });
    throw error;
  }
}

export async function listCampaigns(req, res, next) {
  try {
    const query = { user: req.user._id };
    if (req.query.animal) query["assignments.animal"] = req.query.animal;
    if (req.query.group) query["assignments.group"] = req.query.group;
    let campaigns = await populateCampaign(VaccinationCampaign.find(query).sort({ scheduledDate: 1, createdAt: -1 }));
    for (const campaign of campaigns) {
      const status = resolveCampaignStatus(campaign);
      if (campaign.status !== status) { campaign.status = status; await campaign.save(); }
    }
    res.json(campaigns);
  } catch (error) { next(error); }
}

export async function createCampaign(req, res, next) {
  let campaign;
  try {
    const data = buildCampaignPayload(req.body);
    const ownership = await validateOwnedAssignments(req.user._id, data, req.body.confirmMultipleSpecies);
    if (ownership.error) return res.status(400).json({ message: ownership.error });
    if (data.template && !(await VaccinationTemplate.exists({ _id: data.template, user: req.user._id }))) data.template = null;
    if (data.previousCampaign && !(await VaccinationCampaign.exists({ _id: data.previousCampaign, user: req.user._id }))) {
      return res.status(400).json({ message: "Previous vaccination campaign was not found" });
    }
    data.status = resolveCampaignStatus(data);
    campaign = await VaccinationCampaign.create({ ...data, user: req.user._id, createdBy: req.user._id });
    await syncCampaignFinance(campaign);
    if (campaign.assignments.some((item) => item.completionStatus === "completed")) await deductCampaignInventory(campaign);
    res.status(201).json(await populateCampaign(VaccinationCampaign.findById(campaign._id)));
  } catch (error) {
    if (campaign?._id && !campaign.inventoryDeductionTransaction) {
      if (campaign.financeTransaction) await Transaction.deleteOne({ _id: campaign.financeTransaction, user: req.user._id });
      await VaccinationCampaign.deleteOne({ _id: campaign._id, user: req.user._id });
    }
    next(error);
  }
}

export async function updateCampaign(req, res, next) {
  try {
    const existing = await VaccinationCampaign.findOne({ _id: req.params.id, user: req.user._id });
    if (!existing) return res.status(404).json({ message: "Vaccination campaign not found" });
    const data = buildCampaignPayload(req.body);
    const ownership = await validateOwnedAssignments(req.user._id, data, req.body.confirmMultipleSpecies);
    if (ownership.error) return res.status(400).json({ message: ownership.error });
    if (existing.inventoryDeductedAt && String(data.inventorySourceTransaction || "") !== String(existing.inventorySourceTransaction || "")) {
      return res.status(409).json({ message: "Inventory source cannot change after stock has been deducted" });
    }
    data.status = resolveCampaignStatus({ ...existing.toObject(), ...data });
    Object.assign(existing, data);
    await existing.save();
    await syncCampaignFinance(existing);
    if (existing.assignments.some((item) => item.completionStatus === "completed")) await deductCampaignInventory(existing);
    res.json(await populateCampaign(VaccinationCampaign.findById(existing._id)));
  } catch (error) { next(error); }
}

export async function updateAssignmentStatuses(req, res, next) {
  try {
    const campaign = await VaccinationCampaign.findOne({ _id: req.params.id, user: req.user._id });
    if (!campaign) return res.status(404).json({ message: "Vaccination campaign not found" });
    const changes = Array.isArray(req.body.assignments) ? req.body.assignments : [];
    if (!changes.length) return res.status(400).json({ message: "Choose at least one assignment to update" });
    for (const change of changes) {
      if (!completionStatuses.includes(change.completionStatus)) return res.status(400).json({ message: "Choose a valid completion status" });
      const assignment = campaign.assignments.id(change.assignmentId);
      if (!assignment) return res.status(404).json({ message: "Vaccination assignment not found" });
      assignment.completionStatus = change.completionStatus;
      assignment.completedDate = change.completionStatus === "completed" ? change.completedDate || new Date() : null;
      if (change.notes !== undefined) assignment.notes = String(change.notes).trim();
    }
    campaign.status = resolveCampaignStatus(campaign);
    await campaign.save();
    if (campaign.assignments.some((item) => item.completionStatus === "completed")) await deductCampaignInventory(campaign);
    res.json(await populateCampaign(VaccinationCampaign.findById(campaign._id)));
  } catch (error) { next(error); }
}

export async function cancelCampaign(req, res, next) {
  try {
    const campaign = await VaccinationCampaign.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { status: "cancelled" }, { new: true });
    if (!campaign) return res.status(404).json({ message: "Vaccination campaign not found" });
    res.json(campaign);
  } catch (error) { next(error); }
}

export async function deleteCampaign(req, res, next) {
  try {
    const campaign = await VaccinationCampaign.findOne({ _id: req.params.id, user: req.user._id });
    if (!campaign) return res.status(404).json({ message: "Vaccination campaign not found" });
    if (campaign.inventoryDeductionTransaction) return res.status(409).json({ message: "Cancel completed campaigns instead of deleting their inventory history" });
    if (campaign.financeTransaction) await Transaction.findOneAndUpdate(
      { _id: campaign.financeTransaction, user: req.user._id, reversedAt: null },
      { reversedAt: new Date(), reversalReason: "Originating vaccination campaign deleted", reversedBy: req.user._id }
    );
    await campaign.deleteOne();
    res.json({ message: "Vaccination campaign deleted" });
  } catch (error) { next(error); }
}

export async function listTemplates(req, res, next) {
  try {
    const custom = await VaccinationTemplate.find({ user: req.user._id }).sort({ createdAt: -1 }).lean();
    res.json([...systemVaccinationTemplates, ...custom.map((item) => ({ ...item, system: false }))]);
  } catch (error) { next(error); }
}

export async function createTemplate(req, res, next) {
  try {
    const data = pick(req.body, templateFields);
    data.dose = Number(data.dose || 0);
    data.supportedSpecies = [...new Set((data.supportedSpecies?.length ? data.supportedSpecies : [data.species]).map(canonicalSpecies).filter(Boolean))];
    data.species = data.species || data.supportedSpecies[0];
    res.status(201).json(await VaccinationTemplate.create({ ...data, user: req.user._id }));
  } catch (error) { next(error); }
}

export async function updateTemplate(req, res, next) {
  try {
    if (String(req.params.id).startsWith("system-")) return res.status(403).json({ message: "Copy a system template before editing it" });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid template identifier" });
    const data = pick(req.body, templateFields);
    data.dose = Number(data.dose || 0);
    data.supportedSpecies = [...new Set((data.supportedSpecies?.length ? data.supportedSpecies : [data.species]).map(canonicalSpecies).filter(Boolean))];
    data.species = data.species || data.supportedSpecies[0];
    const template = await VaccinationTemplate.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, data, { new: true, runValidators: true });
    if (!template) return res.status(404).json({ message: "Vaccination template not found" });
    res.json(template);
  } catch (error) { next(error); }
}

export async function deleteTemplate(req, res, next) {
  try {
    if (String(req.params.id).startsWith("system-")) return res.status(403).json({ message: "System templates cannot be deleted" });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid template identifier" });
    const template = await VaccinationTemplate.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!template) return res.status(404).json({ message: "Vaccination template not found" });
    res.json({ message: "Vaccination template deleted" });
  } catch (error) { next(error); }
}
