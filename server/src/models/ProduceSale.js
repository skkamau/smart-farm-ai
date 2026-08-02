import mongoose from "mongoose";

const produceSaleSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    saleNumber: { type: String, trim: true },
    idempotencyKey: { type: String, required: true, trim: true, maxlength: 120 },
    productionRecord: { type: mongoose.Schema.Types.ObjectId, ref: "ProductionRecord", required: true, index: true },
    inventoryItem: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryItem", required: true, index: true },
    productName: { type: String, required: true, trim: true, maxlength: 120 },
    baseUnit: { type: String, required: true, trim: true, maxlength: 40 },
    saleUnit: { type: String, required: true, trim: true, maxlength: 40 },
    conversionToBase: { type: Number, required: true, min: 0.000001 },
    quantity: { type: Number, required: true, min: 0.000001 },
    baseQuantity: { type: Number, required: true, min: 0.000001 },
    unitPrice: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    customer: { type: String, trim: true, maxlength: 160, default: "Walk-in customer" },
    customerPhone: { type: String, trim: true, maxlength: 80, default: "" },
    saleDate: { type: Date, required: true, default: Date.now, index: true },
    dueDate: { type: Date, default: null },
    notes: { type: String, trim: true, maxlength: 2000, default: "" },
    stockMovement: { type: mongoose.Schema.Types.ObjectId, ref: "StockMovement", default: null },
    financeTransaction: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null },
    status: { type: String, enum: ["confirmed", "cancelled"], default: "confirmed", index: true },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    cancellationReason: { type: String, trim: true, maxlength: 500, default: "" },
    reversalMovement: { type: mongoose.Schema.Types.ObjectId, ref: "StockMovement", default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    stockVersion: { type: Number, min: 0, default: 0, select: false },
    paymentVersion: { type: Number, min: 0, default: 0, select: false }
  },
  { timestamps: true }
);

produceSaleSchema.index({ user: 1, saleNumber: 1 }, { unique: true, sparse: true });
produceSaleSchema.index({ user: 1, idempotencyKey: 1 }, { unique: true });
produceSaleSchema.index({ user: 1, saleDate: -1 });

produceSaleSchema.pre("validate", function setSaleNumber(next) {
  if (!this.saleNumber) this.saleNumber = `SALE-${Date.now().toString(36).toUpperCase()}-${this._id.toString().slice(-5).toUpperCase()}`;
  next();
});

export default mongoose.model("ProduceSale", produceSaleSchema);
