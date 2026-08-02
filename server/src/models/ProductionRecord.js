import mongoose from "mongoose";

const productionRecordSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    batchReference: { type: String, required: true, trim: true, uppercase: true },
    productType: {
      type: String,
      enum: ["eggs", "milk", "crop_harvest", "fish_harvest", "other_produce"],
      required: true,
      index: true
    },
    productName: { type: String, required: true, trim: true, maxlength: 120 },
    sourceType: {
      type: String,
      enum: ["individual_animal", "animal_group", "crop", "field", "pond", "fish_group", "other"],
      required: true,
      index: true
    },
    sourceId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    sourceModel: { type: String, enum: ["Animal", "AnimalGroup", "Crop", "Other"], required: true },
    sourceLabel: { type: String, required: true, trim: true, maxlength: 180 },
    productionDate: { type: Date, required: true, index: true },
    session: { type: String, trim: true, maxlength: 80, default: "" },
    quantityProduced: { type: Number, required: true, min: 0 },
    baseUnit: { type: String, enum: ["egg", "litre", "millilitre", "kilogram", "tonne", "bag", "crate", "piece", "other"], required: true },
    quantityDamaged: { type: Number, min: 0, default: 0 },
    quantityRejected: { type: Number, min: 0, default: 0 },
    quantityUsedInternally: { type: Number, min: 0, default: 0 },
    quantityReserved: { type: Number, min: 0, default: 0 },
    quantityFedToYoung: { type: Number, min: 0, default: 0 },
    quantitySellable: { type: Number, required: true, min: 0 },
    storageLocation: { type: String, trim: true, maxlength: 160, default: "" },
    expiryDate: { type: Date, default: null },
    qualityGrade: { type: String, trim: true, maxlength: 80, default: "" },
    qualityNotes: { type: String, trim: true, maxlength: 1000, default: "" },
    fishHarvestType: { type: String, enum: ["", "sample", "partial", "full"], default: "" },
    fishHarvestCount: { type: Number, min: 0, default: 0 },
    totalHarvestedWeight: { type: Number, min: 0, default: 0 },
    averageWeight: { type: Number, min: 0, default: 0 },
    averageWeightUnit: { type: String, enum: ["g", "kg"], default: "kg" },
    inventoryItem: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryItem", default: null },
    inventoryMovement: { type: mongoose.Schema.Types.ObjectId, ref: "StockMovement", default: null },
    groupQuantityEvent: { type: mongoose.Schema.Types.ObjectId, ref: "GroupQuantityEvent", default: null },
    notes: { type: String, trim: true, maxlength: 3000, default: "" },
    status: { type: String, enum: ["active", "reversed"], default: "active", index: true },
    reversalReason: { type: String, trim: true, maxlength: 500, default: "" },
    reversedAt: { type: Date, default: null },
    reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

productionRecordSchema.index({ user: 1, batchReference: 1 }, { unique: true });
productionRecordSchema.index({ user: 1, productType: 1, productionDate: -1 });
productionRecordSchema.index({ user: 1, sourceType: 1, sourceId: 1, productionDate: -1 });

export default mongoose.model("ProductionRecord", productionRecordSchema);
