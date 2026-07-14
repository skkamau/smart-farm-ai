import mongoose from "mongoose";

const vaccinationTemplateSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    scheduleName: { type: String, required: true, trim: true, maxlength: 160 },
    species: { type: String, required: true, trim: true, maxlength: 80, index: true },
    customSpecies: { type: String, trim: true, maxlength: 100, default: "" },
    breedOrStrain: { type: String, trim: true, maxlength: 120, default: "" },
    productionType: { type: String, trim: true, maxlength: 120, default: "" },
    treatmentType: { type: String, enum: ["vaccination", "preventive_treatment"], default: "vaccination" },
    vaccineName: { type: String, required: true, trim: true, maxlength: 160 },
    diseasePrevented: { type: String, trim: true, maxlength: 240, default: "" },
    recommendedStage: { type: String, trim: true, maxlength: 240, default: "" },
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

export default mongoose.model("VaccinationTemplate", vaccinationTemplateSchema);
