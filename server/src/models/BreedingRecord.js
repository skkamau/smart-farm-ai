import mongoose from "mongoose";

const breedingRecordSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    femaleAnimal: { type: mongoose.Schema.Types.ObjectId, ref: "Animal", required: true, index: true },
    maleAnimal: { type: mongoose.Schema.Types.ObjectId, ref: "Animal", required: true, index: true },
    matingDate: { type: Date, required: true },
    pregnancyStatus: {
      type: String,
      enum: ["unknown", "not_pregnant", "pregnant", "delivered"],
      default: "unknown",
      index: true
    },
    expectedBirthDate: { type: Date },
    actualBirthDate: { type: Date },
    vetNotes: { type: String, trim: true },
    breedingResult: {
      type: String,
      enum: ["successful", "failed", "pending"],
      default: "pending",
      index: true
    },
    notes: { type: String, trim: true }
  },
  { timestamps: true }
);

breedingRecordSchema.index({ user: 1, expectedBirthDate: 1 });

export default mongoose.model("BreedingRecord", breedingRecordSchema);
