import mongoose from "mongoose";

const cropSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    field: { type: String, required: true, trim: true },
    plot: { type: String, trim: true },
    area: { type: Number, min: 0, default: 0 },
    plantingDate: { type: Date },
    harvestDate: { type: Date },
    expectedYield: { type: Number, min: 0, default: 0 },
    actualYield: { type: Number, min: 0, default: 0 },
    cost: { type: Number, min: 0, default: 0 },
    revenue: { type: Number, min: 0, default: 0 },
    status: { type: String, enum: ["Planned", "Growing", "Ready", "Harvested"], default: "Growing" },
    notes: { type: String, trim: true }
  },
  { timestamps: true }
);

cropSchema.index({ user: 1, status: 1 });

export default mongoose.model("Crop", cropSchema);
