import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["income", "expense"], required: true, index: true },
    category: {
      type: String,
      enum: ["Feed", "Medicine", "Labour", "Equipment", "Transport", "Sales", "Utilities", "Crop", "Other"],
      default: "Other"
    },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, required: true, trim: true },
    transactionDate: { type: Date, default: Date.now },
    notes: { type: String, trim: true }
  },
  { timestamps: true }
);

transactionSchema.index({ user: 1, transactionDate: -1 });

export default mongoose.model("Transaction", transactionSchema);
