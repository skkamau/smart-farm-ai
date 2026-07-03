import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

function buildQrValue(animal) {
  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
  return `${clientUrl.replace(/\/$/, "")}/scan/${animal.qrCodeId}`;
}

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
    mother: { type: mongoose.Schema.Types.ObjectId, ref: "Animal", default: null, index: true },
    father: { type: mongoose.Schema.Types.ObjectId, ref: "Animal", default: null, index: true },
    children: [{ type: mongoose.Schema.Types.ObjectId, ref: "Animal" }],
    qrCodeId: { type: String, unique: true, sparse: true, index: true },
    qrCodeValue: { type: String, trim: true },
    notes: { type: String, trim: true }
  },
  { timestamps: true }
);

animalSchema.pre("validate", function ensureQrCode(next) {
  if (!this.qrCodeId) this.qrCodeId = `QR-${randomUUID()}`;
  if (!this.qrCodeValue) this.qrCodeValue = buildQrValue(this);
  next();
});

animalSchema.index({ user: 1, animalId: 1 }, { unique: true });
animalSchema.index({ user: 1, species: 1, status: 1 });

export default mongoose.model("Animal", animalSchema);
