import mongoose from "mongoose";

const inventoryItemSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    category: {
      type: String,
      enum: ["Feed", "Medicine", "Vaccine", "Fertilizer", "Seed", "Chemical", "Fuel", "Farm supplies", "Produce", "Equipment", "Other"],
      required: true,
      index: true
    },
    classification: { type: String, enum: ["consumable", "produce", "equipment_asset"], required: true, index: true },
    unit: { type: String, required: true, trim: true, maxlength: 40 },
    openingQuantity: { type: Number, min: 0, default: 0 },
    currentQuantity: { type: Number, min: 0, default: 0 },
    minimumStockLevel: { type: Number, min: 0, default: 0 },
    averageUnitCost: { type: Number, min: 0, default: 0 },
    storageLocation: { type: String, trim: true, maxlength: 160 },
    supplier: { type: String, trim: true, maxlength: 160 },
    expiryDate: { type: Date, default: null },
    notes: { type: String, trim: true, maxlength: 2000 },
    archivedAt: { type: Date, default: null, index: true },
    legacyKey: { type: String, default: null },
    produceKey: { type: String, trim: true, default: null },
    legacyTransactionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Transaction" }]
  },
  { timestamps: true }
);

inventoryItemSchema.index({ user: 1, name: 1, archivedAt: 1 });
inventoryItemSchema.index({ user: 1, legacyKey: 1 }, { unique: true, sparse: true });
inventoryItemSchema.index({ user: 1, produceKey: 1 }, { unique: true, sparse: true });

export default mongoose.model("InventoryItem", inventoryItemSchema);
