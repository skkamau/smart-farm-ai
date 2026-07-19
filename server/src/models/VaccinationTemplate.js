import mongoose from "mongoose";

const vaccinationTemplateSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    templateKey: { type: String, trim: true, lowercase: true, maxlength: 120, default: "" },
    scheduleName: { type: String, required: true, trim: true, maxlength: 160 },
    species: { type: String, required: true, trim: true, maxlength: 80, index: true },
    supportedSpecies: [{ type: String, trim: true, lowercase: true, maxlength: 80 }],
    customSpecies: { type: String, trim: true, maxlength: 100, default: "" },
    breedOrStrain: { type: String, trim: true, maxlength: 120, default: "" },
    productionType: { type: String, trim: true, maxlength: 120, default: "" },
    treatmentType: { type: String, enum: ["vaccination", "preventive_treatment"], default: "vaccination" },
    vaccineName: { type: String, required: true, trim: true, maxlength: 160 },
    diseasePrevented: { type: String, trim: true, maxlength: 240, default: "" },
    recommendedStage: { type: String, trim: true, maxlength: 240, default: "" },
    recommendedTiming: { type: String, trim: true, maxlength: 2000, default: "" },
    explanation: { type: String, trim: true, maxlength: 2000, default: "" },
    majorSigns: { type: String, trim: true, maxlength: 2000, default: "" },
    safetyNotice: { type: String, trim: true, maxlength: 1000, default: "" },
    boosterInterval: { type: String, trim: true, maxlength: 120, default: "" },
    recurrence: { type: String, trim: true, maxlength: 120, default: "" },
    dose: { type: Number, min: 0, default: 0 },
    doseUnit: { type: String, trim: true, maxlength: 40, default: "ml" },
    administrationRoute: { type: String, trim: true, maxlength: 100, default: "" },
    notes: { type: String, trim: true, maxlength: 3000, default: "" }
  },
  { timestamps: true }
);

vaccinationTemplateSchema.index({ user: 1, scheduleName: 1 });
vaccinationTemplateSchema.index(
  { user: 1, templateKey: 1 },
  { unique: true, partialFilterExpression: { templateKey: { $type: "string", $gt: "" } } }
);

vaccinationTemplateSchema.pre("validate", function normalizeSupportedSpecies(next) {
  const values = this.supportedSpecies?.length ? this.supportedSpecies : [this.species];
  this.supportedSpecies = [...new Set(values.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean))];
  if (!this.species && this.supportedSpecies.length) this.species = this.supportedSpecies[0];
  next();
});

export default mongoose.model("VaccinationTemplate", vaccinationTemplateSchema);
