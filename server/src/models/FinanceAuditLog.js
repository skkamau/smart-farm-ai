import mongoose from "mongoose";

const financeAuditLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  transaction: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null, index: true },
  action: {
    type: String,
    enum: ["created", "edited", "reversed", "deleted", "payment_recorded", "source_updated", "exported"],
    required: true,
    index: true
  },
  summary: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

financeAuditLogSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("FinanceAuditLog", financeAuditLogSchema);
