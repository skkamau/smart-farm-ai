import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { buildQrValue } from "../utils/qr.js";

const animalGroupSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    groupId: { type: String, required: true, trim: true, uppercase: true },
    groupName: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, enum: ["poultry", "fish", "rabbits", "bees", "other"], required: true, index: true },
    species: { type: String, required: true, trim: true, maxlength: 100 },
    breedOrStrain: { type: String, trim: true, maxlength: 120, default: "" },
    productionPurpose: { type: String, trim: true, maxlength: 120, default: "" },
    startingQuantity: { type: Number, required: true, min: 1 },
    currentQuantity: { type: Number, required: true, min: 0 },
    quantityType: { type: String, enum: ["confirmed", "estimated"], default: "confirmed" },
    quantityConfidence: { type: String, enum: ["high", "medium", "low", "not_applicable"], default: "not_applicable" },
    hatchStockingOrArrivalDate: { type: Date },
    locationType: { type: String, enum: ["poultry_house", "coop", "pond", "tank", "cage", "hutch", "apiary", "other"], default: "other" },
    locationName: { type: String, trim: true, maxlength: 120, default: "" },
    averageWeight: { type: Number, min: 0, default: 0 },
    averageWeightUnit: { type: String, enum: ["g", "kg"], default: "kg" },
    estimatedBiomass: { type: Number, min: 0, default: 0 },
    purchaseCost: { type: Number, min: 0, default: 0 },
    estimatedValue: { type: Number, min: 0, default: 0 },
    supplierOrSource: { type: String, trim: true, maxlength: 160, default: "" },
    lifecycleStatus: { type: String, enum: ["active", "sold", "harvested", "archived"], default: "active", index: true },
    healthStatus: { type: String, enum: ["healthy", "mild", "moderate", "serious", "critical", "recovering", "chronic", "stable", "unknown"], default: "unknown", index: true },
    notes: { type: String, trim: true, maxlength: 3000, default: "" },
    qrCodeId: { type: String, unique: true, sparse: true, index: true },
    qrCodeValue: { type: String, trim: true },
    lastQuantityEventAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

animalGroupSchema.pre("validate", function ensureGroupQr(next) {
  if (!this.qrCodeId) this.qrCodeId = `GRP-${randomUUID()}`;
  this.qrCodeValue = buildQrValue(this.qrCodeId, "groups");
  this.estimatedBiomass = calculateBiomass(this.currentQuantity, this.averageWeight, this.averageWeightUnit);
  next();
});

animalGroupSchema.index({ user: 1, groupId: 1 }, { unique: true });
animalGroupSchema.index({ user: 1, category: 1, lifecycleStatus: 1 });

export function calculateBiomass(quantity, weight, unit) {
  const kilograms = unit === "g" ? Number(weight || 0) / 1000 : Number(weight || 0);
  return Math.round(Number(quantity || 0) * kilograms * 1000) / 1000;
}

export default mongoose.model("AnimalGroup", animalGroupSchema);
