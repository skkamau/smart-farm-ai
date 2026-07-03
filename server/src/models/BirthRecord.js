import mongoose from "mongoose";

const birthRecordSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    mother: { type: mongoose.Schema.Types.ObjectId, ref: "Animal", required: true, index: true },
    father: { type: mongoose.Schema.Types.ObjectId, ref: "Animal", required: true, index: true },
    birthDate: { type: Date, required: true },
    numberOfOffspring: { type: Number, min: 1, required: true },
    offspring: [{ type: mongoose.Schema.Types.ObjectId, ref: "Animal" }],
    birthComplications: { type: String, trim: true },
    vetNotes: { type: String, trim: true },
    notes: { type: String, trim: true }
  },
  { timestamps: true }
);

birthRecordSchema.index({ user: 1, birthDate: -1 });

export default mongoose.model("BirthRecord", birthRecordSchema);
