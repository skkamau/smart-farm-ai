import mongoose from "mongoose";

const birthRecordSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    mother: { type: mongoose.Schema.Types.ObjectId, ref: "Animal", required: true, index: true },
    father: { type: mongoose.Schema.Types.ObjectId, ref: "Animal", default: null, index: true },
    fatherKnown: { type: Boolean, default: false },
    birthDate: { type: Date, required: true },
    numberOfOffspring: { type: Number, min: 1, required: true },
    offspring: [{ type: mongoose.Schema.Types.ObjectId, ref: "Animal" }],
    birthComplications: { type: String, trim: true },
    vetNotes: { type: String, trim: true },
    notes: { type: String, trim: true },
    submissionKey: { type: String, trim: true, maxlength: 100 }
  },
  { timestamps: true }
);

birthRecordSchema.index({ user: 1, birthDate: -1 });
birthRecordSchema.index({ user: 1, submissionKey: 1 }, { unique: true, sparse: true });

export default mongoose.model("BirthRecord", birthRecordSchema);
