import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["income", "expense"], required: true, index: true },
    financeSection: {
      type: String,
      enum: ["Income", "Expenses", "CropExpense", "AnimalHealth", "Construction", "Equipment", "Feed", "Fuel", "Consumables", "CashSavings"],
      default: "Expenses",
      index: true
    },
    category: { type: String, default: "Other", trim: true, index: true },
    crop: { type: mongoose.Schema.Types.ObjectId, ref: "Crop", default: null, index: true },
    animal: { type: mongoose.Schema.Types.ObjectId, ref: "Animal", default: null, index: true },
    healthRecord: { type: mongoose.Schema.Types.ObjectId, ref: "HealthRecord", default: null, index: true },
    vaccinationRecord: { type: mongoose.Schema.Types.ObjectId, ref: "VaccinationRecord", default: null, index: true },
    source: { type: String, enum: ["manual", "crop", "health"], default: "manual", index: true },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, required: true, trim: true },
    transactionDate: { type: Date, default: Date.now },
    item: { type: String, trim: true },
    quantity: { type: Number, min: 0, default: 0 },
    unit: { type: String, trim: true },
    unitCost: { type: Number, min: 0, default: 0 },
    totalCost: { type: Number, min: 0, default: 0 },
    paymentMethod: { type: String, trim: true },
    supplierVendor: { type: String, trim: true },
    quantityIn: { type: Number, min: 0, default: 0 },
    quantityOut: { type: Number, min: 0, default: 0 },
    balance: { type: Number, default: 0 },
    month: { type: String, trim: true },
    cashAmount: { type: Number, min: 0, default: 0 },
    savingsAmount: { type: Number, min: 0, default: 0 },
    serviceCharge: { type: Number, min: 0, default: 0 },
    medicineCost: { type: Number, min: 0, default: 0 },
    transportCost: { type: Number, min: 0, default: 0 },
    otherCost: { type: Number, min: 0, default: 0 },
    followUpDate: { type: Date },
    remarks: { type: String, trim: true },
    notes: { type: String, trim: true }
  },
  { timestamps: true }
);

transactionSchema.index({ user: 1, transactionDate: -1 });
transactionSchema.index({ user: 1, financeSection: 1, transactionDate: -1 });

export default mongoose.model("Transaction", transactionSchema);
