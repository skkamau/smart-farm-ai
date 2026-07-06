import mongoose from "mongoose";

const vaccinationRecordSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    animal: { type: mongoose.Schema.Types.ObjectId, ref: "Animal", required: true, index: true },
    vaccineName: { type: String, required: true, trim: true },
    dateGiven: { type: Date },
    nextDueDate: { type: Date },
    vetName: { type: String, trim: true },
    batchNumber: { type: String, trim: true },
    serviceCharge: { type: Number, min: 0, default: 0 },
    vaccineCost: { type: Number, min: 0, default: 0 },
    transportCost: { type: Number, min: 0, default: 0 },
    otherCost: { type: Number, min: 0, default: 0 },
    totalCost: { type: Number, min: 0, default: 0 },
    paymentMethod: { type: String, trim: true },
    financeTransaction: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null },
    status: {
      type: String,
      enum: ["completed", "upcoming", "overdue"],
      default: "completed",
      index: true
    },
    notes: { type: String, trim: true }
  },
  { timestamps: true }
);

vaccinationRecordSchema.index({ user: 1, nextDueDate: 1 });

export default mongoose.model("VaccinationRecord", vaccinationRecordSchema);
