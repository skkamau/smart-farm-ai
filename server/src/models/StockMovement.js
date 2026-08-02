import mongoose from "mongoose";

const movementTypes = [
  "opening_stock", "migration", "purchase", "stock_added", "used", "sold",
  "wasted", "expired", "adjustment", "transfer_in", "transfer_out", "reversal"
];

const stockMovementSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    item: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryItem", required: true, index: true },
    type: { type: String, enum: movementTypes, required: true, index: true },
    quantity: { type: Number, min: 0, required: true },
    quantityChange: { type: Number, required: true },
    balanceAfter: { type: Number, min: 0, required: true },
    movementDate: { type: Date, required: true, default: Date.now, index: true },
    unitCost: { type: Number, min: 0, default: 0 },
    supplier: { type: String, trim: true, maxlength: 160 },
    paymentMethod: { type: String, trim: true, maxlength: 80 },
    purchaseReference: { type: String, trim: true, maxlength: 160 },
    usagePurpose: { type: String, trim: true, maxlength: 240 },
    animal: { type: mongoose.Schema.Types.ObjectId, ref: "Animal", default: null },
    animalGroup: { type: mongoose.Schema.Types.ObjectId, ref: "AnimalGroup", default: null },
    crop: { type: mongoose.Schema.Types.ObjectId, ref: "Crop", default: null },
    farmActivity: { type: String, trim: true, maxlength: 160 },
    reason: { type: String, trim: true, maxlength: 240 },
    notes: { type: String, trim: true, maxlength: 2000 },
    financeTransaction: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null },
    productionRecord: { type: mongoose.Schema.Types.ObjectId, ref: "ProductionRecord", default: null, index: true },
    productionRemovalReason: {
      type: String,
      enum: ["", "household", "animal_feed", "farm_input", "seed", "incubation", "damaged", "spoiled", "missing", "donated", "other"],
      default: ""
    },
    sourceKey: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

stockMovementSchema.index({ user: 1, item: 1, movementDate: -1 });
stockMovementSchema.index({ user: 1, sourceKey: 1 }, { unique: true, sparse: true });

export { movementTypes };
export default mongoose.model("StockMovement", stockMovementSchema);
