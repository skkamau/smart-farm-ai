import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  amount: { type: Number, min: 0, required: true },
  paymentDate: { type: Date, default: Date.now },
  paymentMethod: { type: String, trim: true },
  referenceNumber: { type: String, trim: true },
  notes: { type: String, trim: true },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { _id: true, timestamps: true });

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
    vaccinationCampaign: { type: mongoose.Schema.Types.ObjectId, ref: "VaccinationCampaign", default: null, index: true },
    source: { type: String, enum: ["manual", "crop", "health", "vaccination", "inventory"], default: "manual", index: true },
    inventoryMovement: { type: mongoose.Schema.Types.ObjectId, ref: "StockMovement", default: null, index: true },
    transactionId: { type: String, trim: true },
    paymentStatus: { type: String, enum: ["paid", "partially_paid", "unpaid"], default: "paid", index: true },
    amountPaid: { type: Number, min: 0, default: 0 },
    amountOutstanding: { type: Number, min: 0, default: 0 },
    dueDate: { type: Date, default: null },
    counterparty: { type: String, trim: true, maxlength: 160 },
    referenceNumber: { type: String, trim: true, maxlength: 160 },
    linkedRecordType: { type: String, trim: true, maxlength: 80, index: true },
    linkedRecordId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    sourceType: { type: String, trim: true, maxlength: 80, index: true },
    sourceId: { type: String, trim: true, maxlength: 160, index: true },
    sourceKey: { type: String },
    enterpriseType: {
      type: String,
      enum: ["Whole farm", "Individual animal", "Animal group", "Poultry", "Sheep and goats", "Cattle", "Fish", "Crop", "Field", "Other"],
      default: "Whole farm",
      index: true
    },
    payments: { type: [paymentSchema], default: [] },
    reversedAt: { type: Date, default: null, index: true },
    reversalReason: { type: String, trim: true, maxlength: 500 },
    reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
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
    storageLocation: { type: String, trim: true },
    inventoryStatus: { type: String, trim: true },
    minimumStockLevel: { type: Number, min: 0, default: 0 },
    expiryDate: { type: Date },
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
transactionSchema.index({ user: 1, transactionId: 1 }, { unique: true, sparse: true });
transactionSchema.index({ user: 1, sourceKey: 1 }, { unique: true, sparse: true });

transactionSchema.pre("validate", function setStableIdentifiers(next) {
  if (!this.transactionId) {
    this.transactionId = `FIN-${Date.now().toString(36).toUpperCase()}-${this._id.toString().slice(-5).toUpperCase()}`;
  }
  if (this.sourceType && this.sourceId) this.sourceKey = `${this.sourceType}:${this.sourceId}`;
  if (this.paymentStatus === "paid") this.amountPaid = Number(this.amount || 0);
  this.amountOutstanding = Math.max(0, Number(this.amount || 0) - Number(this.amountPaid || 0));
  if (this.amountOutstanding === 0) this.paymentStatus = "paid";
  else if (this.amountPaid > 0) this.paymentStatus = "partially_paid";
  else this.paymentStatus = "unpaid";
  next();
});

export default mongoose.model("Transaction", transactionSchema);
