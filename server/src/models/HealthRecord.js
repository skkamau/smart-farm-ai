import mongoose from "mongoose";

const medicationSchema = new mongoose.Schema(
  {
    medicationName: { type: String, required: true, trim: true },
    dosage: { type: String, required: true, trim: true },
    medicineCharge: { type: Number, min: 0, default: 0 }
  },
  { _id: false }
);

const healthRecordSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    animal: { type: mongoose.Schema.Types.ObjectId, ref: "Animal", required: true, index: true },
    recordDate: { type: Date, required: true, default: Date.now },
    condition: { type: String, required: true, trim: true },
    symptoms: { type: String, trim: true },
    // API validation requires diagnosis on new saves; optional storage keeps legacy backups importable.
    diagnosis: { type: String, trim: true },
    medications: { type: [medicationSchema], default: [] },
    // Legacy fields remain readable so existing records do not require a destructive migration.
    treatment: { type: String, trim: true },
    medication: { type: String, trim: true },
    dosage: { type: String, trim: true },
    vetName: { type: String, trim: true },
    serviceType: { type: String, trim: true },
    serviceCharge: { type: Number, min: 0, default: 0 },
    medicineCost: { type: Number, min: 0, default: 0 },
    transportCost: { type: Number, min: 0, default: 0 },
    otherCost: { type: Number, min: 0, default: 0 },
    totalCost: { type: Number, min: 0, default: 0 },
    paymentMethod: { type: String, trim: true },
    followUpDate: { type: Date },
    financeTransaction: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null },
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
