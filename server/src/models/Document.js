import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    entityType: {
      type: String,
      enum: ["animal", "health", "vaccination", "crop", "transaction"],
      required: true,
      index: true
    },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    originalName: { type: String, required: true, trim: true },
    storedName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    url: { type: String, required: true },
    notes: { type: String, trim: true }
  },
  { timestamps: true }
);

documentSchema.index({ user: 1, entityType: 1, entityId: 1 });

export default mongoose.model("Document", documentSchema);
