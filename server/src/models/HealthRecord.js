import mongoose from "mongoose";

const healthRecordSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    animal: { type: mongoose.Schema.Types.ObjectId, ref: "Animal", required: true, index: true },
    recordDate: { type: Date, required: true, default: Date.now },
    condition: { type: String, required: true, trim: true },
    symptoms: { type: String, trim: true },
    diagnosis: { type: String, trim: true },
    treatment: { type: String, trim: true },
    medication: { type: String, trim: true },
    dosage: { type: String, trim: true },
    vetName: { type: String, trim: true },
    recoveryStatus: {
      type: String,
      enum: ["Open", "Recovering", "Recovered", "Chronic", "Referred"],
      default: "Open"
    },
    notes: { type: String, trim: true }
  },
  { timestamps: true }
);

healthRecordSchema.index({ user: 1, recordDate: -1 });

export default mongoose.model("HealthRecord", healthRecordSchema);
