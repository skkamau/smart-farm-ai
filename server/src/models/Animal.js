import mongoose from "mongoose";

const animalSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    animalId: { type: String, required: true, trim: true },
    name: { type: String, trim: true },
    species: { type: String, required: true, trim: true },
    breed: { type: String, trim: true },
    gender: { type: String, enum: ["Female", "Male", "Unknown"], default: "Unknown" },
    dateOfBirth: { type: Date },
    weight: { type: Number, min: 0, default: 0 },
    location: { type: String, trim: true },
    status: { type: String, enum: ["Healthy", "Sick", "Pregnant", "Sold", "Archived"], default: "Healthy" },
    estimatedValue: { type: Number, min: 0, default: 0 },
    notes: { type: String, trim: true }
  },
  { timestamps: true }
);

animalSchema.index({ user: 1, animalId: 1 }, { unique: true });
animalSchema.index({ user: 1, species: 1, status: 1 });

export default mongoose.model("Animal", animalSchema);
