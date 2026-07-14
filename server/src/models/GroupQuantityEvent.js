import mongoose from "mongoose";

const quantityEventSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    group: { type: mongoose.Schema.Types.ObjectId, ref: "AnimalGroup", required: true, index: true },
    eventType: {
      type: String,
      enum: ["initial_stock", "added", "purchased", "hatched", "born", "stocked", "death", "culled", "sold", "harvested", "transferred_in", "transferred_out", "missing", "stock_correction"],
      required: true
    },
    quantity: { type: Number, required: true, min: 0 },
    quantityDelta: { type: Number, required: true },
    balanceAfter: { type: Number, required: true, min: 0 },
    eventDate: { type: Date, required: true, default: Date.now, index: true },
    reason: { type: String, trim: true, maxlength: 500, default: "" },
    destinationOrSource: { type: String, trim: true, maxlength: 200, default: "" },
    financialAmount: { type: Number, min: 0, default: 0 },
    notes: { type: String, trim: true, maxlength: 2000, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    idempotencyKey: { type: String, required: true, trim: true, maxlength: 120 }
  },
  { timestamps: true, immutable: true }
);

quantityEventSchema.index({ user: 1, group: 1, idempotencyKey: 1 }, { unique: true });
quantityEventSchema.index({ user: 1, group: 1, eventDate: -1 });

export default mongoose.model("GroupQuantityEvent", quantityEventSchema);
