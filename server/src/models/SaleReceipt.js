import mongoose from "mongoose";

const saleReceiptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sale: { type: mongoose.Schema.Types.ObjectId, ref: "ProduceSale", required: true, index: true },
    financeTransaction: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", required: true, index: true },
    paymentId: { type: mongoose.Schema.Types.ObjectId, required: true },
    idempotencyKey: { type: String, required: true, trim: true, maxlength: 120 },
    receiptNumber: { type: String, required: true, trim: true },
    amountReceived: { type: Number, required: true, min: 0.000001 },
    paymentDate: { type: Date, required: true },
    paymentMethod: { type: String, required: true, trim: true, maxlength: 80 },
    paymentReference: { type: String, trim: true, maxlength: 160, default: "" },
    remainingBalance: { type: Number, required: true, min: 0 },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    voidedAt: { type: Date, default: null },
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    voidReason: { type: String, trim: true, maxlength: 500, default: "" }
  },
  { timestamps: true }
);

saleReceiptSchema.index({ user: 1, receiptNumber: 1 }, { unique: true });
saleReceiptSchema.index({ user: 1, paymentId: 1 }, { unique: true });
saleReceiptSchema.index({ user: 1, idempotencyKey: 1 }, { unique: true });

export default mongoose.model("SaleReceipt", saleReceiptSchema);
