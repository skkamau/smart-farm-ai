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
    gender: { type: String, enum: ["Female", "Male", "Unknown"], default: "Female" },
    dateOfBirth: { type: Date },
    weight: { type: Number, min: 0, default: 0 },
    location: { type: String, trim: true },
    status: { type: String, enum: ["Healthy", "Sick", "Pregnant", "Sold", "Transferred", "Archived", "Deceased"], default: "Healthy" },
    lifecycleStatus: { type: String, enum: ["active", "sold", "transferred", "archived", "deceased"], default: "active", index: true },
    healthStatus: { type: String, enum: ["healthy", "sick", "recovering", "chronic", "referred", "unknown"], default: "unknown", index: true },
    reproductiveStatus: { type: String, enum: ["not_pregnant", "pregnant", "postpartum", "nursing", "unknown"], default: "unknown", index: true },
    dateOfDeath: { type: Date, default: null },
    causeOfDeath: { type: String, enum: ["", "Disease", "Injury", "Accident", "Birth complications", "Old age", "Predation", "Poisoning", "Unknown", "Other"], default: "" },
    customCauseOfDeath: { type: String, trim: true, maxlength: 200, default: "" },
    deathNotes: { type: String, trim: true, maxlength: 2000, default: "" },
    deathRecordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    veterinaryConfirmation: { type: String, trim: true, maxlength: 500, default: "" },
    deathAttachmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Document", default: null },
    statusChangedAt: { type: Date, default: Date.now },
    statusHistory: [{
      from: { type: String, trim: true },
      to: { type: String, required: true, trim: true },
      changedAt: { type: Date, default: Date.now },
      changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      reason: { type: String, trim: true, maxlength: 500, default: "" }
    }],
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
  this.qrCodeValue = buildQrValue(this);
  next();
});

animalSchema.pre("validate", function mapLegacyStatus(next) {
  if (this.isNew || this.isModified("status")) {
    const legacy = {
      Healthy: { lifecycleStatus: "active", healthStatus: "healthy" },
      Sick: { lifecycleStatus: "active", healthStatus: "sick" },
      Pregnant: { lifecycleStatus: "active", reproductiveStatus: "pregnant" },
      Sold: { lifecycleStatus: "sold" },
      Transferred: { lifecycleStatus: "transferred" },
      Archived: { lifecycleStatus: "archived" },
      Deceased: { lifecycleStatus: "deceased" }
    }[this.status];
    if (legacy) {
      for (const [key, value] of Object.entries(legacy)) {
        if (!this.isModified(key)) this[key] = value;
      }
    }
  }
  next();
});

animalSchema.pre("validate", function validateDeathDetails(next) {
  if (this.lifecycleStatus === "deceased" && !this.dateOfDeath) {
    this.invalidate("dateOfDeath", "Date of death is required when status is Deceased");
  }
  if (this.lifecycleStatus === "deceased" && this.causeOfDeath === "Other" && !this.customCauseOfDeath?.trim()) {
    this.invalidate("customCauseOfDeath", "Enter the cause of death when Other is selected");
  }
  next();
});

animalSchema.index({ user: 1, animalId: 1 }, { unique: true });
animalSchema.index({ user: 1, species: 1, status: 1 });

export default mongoose.model("Animal", animalSchema);
