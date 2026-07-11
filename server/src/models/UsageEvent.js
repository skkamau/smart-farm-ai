import mongoose from "mongoose";

export const usageFeatures = [
  "dashboard", "animals", "health", "vaccinations", "breeding", "births", "crops", "finance",
  "inventory", "reports", "assistant", "alerts", "scanner", "weather", "settings", "feedback"
];

const usageEventSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    feature: { type: String, enum: usageFeatures, required: true, index: true },
    day: { type: Date, required: true, index: true }
  },
  { timestamps: true }
);

usageEventSchema.index({ user: 1, day: -1 });
usageEventSchema.index({ feature: 1, createdAt: -1 });
usageEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

export default mongoose.model("UsageEvent", usageEventSchema);
