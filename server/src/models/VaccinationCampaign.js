import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema(
  {
    targetType: { type: String, enum: ["individual", "group"], required: true },
    animal: { type: mongoose.Schema.Types.ObjectId, ref: "Animal", default: null },
    group: { type: mongoose.Schema.Types.ObjectId, ref: "AnimalGroup", default: null },
    quantityTreated: { type: Number, min: 0, default: 0 },
    completionStatus: { type: String, enum: ["scheduled", "completed", "missed", "postponed"], default: "scheduled" },
    completedDate: { type: Date, default: null },
    notes: { type: String, trim: true, maxlength: 1000, default: "" }
  },
  { timestamps: true }
);

const vaccinationCampaignSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    template: { type: mongoose.Schema.Types.ObjectId, ref: "VaccinationTemplate", default: null },
    scheduleName: { type: String, required: true, trim: true, maxlength: 160 },
    species: { type: String, required: true, trim: true, maxlength: 80, index: true },
    supportedSpecies: [{ type: String, trim: true, lowercase: true, maxlength: 80 }],
    customSpecies: { type: String, trim: true, maxlength: 100, default: "" },
    appliesToMultipleSpecies: { type: Boolean, default: false },
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
    firstVaccinationDate: { type: Date, default: null },
    scheduledDate: { type: Date, required: true, index: true },
    nextVaccinationDate: { type: Date, default: null },
    boosterDate: { type: Date, default: null },
    boosterInterval: { type: String, trim: true, maxlength: 120, default: "" },
    recurrence: { type: String, trim: true, maxlength: 120, default: "" },
    dose: { type: Number, min: 0, default: 0 },
    doseUnit: { type: String, trim: true, maxlength: 40, default: "ml" },
    administrationRoute: { type: String, trim: true, maxlength: 100, default: "" },
    vetName: { type: String, trim: true, maxlength: 160, default: "" },
    provider: { type: String, trim: true, maxlength: 160, default: "" },
    batchNumber: { type: String, trim: true, maxlength: 120, default: "" },
    expiryDate: { type: Date, default: null },
    vaccineCost: { type: Number, min: 0, default: 0 },
    serviceCharge: { type: Number, min: 0, default: 0 },
    transportCost: { type: Number, min: 0, default: 0 },
    otherCost: { type: Number, min: 0, default: 0 },
    costMode: { type: String, enum: ["total", "per_animal", "per_group"], default: "total" },
    totalCost: { type: Number, min: 0, default: 0 },
    paymentMethod: { type: String, trim: true, maxlength: 80, default: "" },
    reminderSettings: {
      enabled: { type: Boolean, default: true },
      daysBefore: { type: Number, min: 0, max: 365, default: 7 },
      onDueDate: { type: Boolean, default: true },
      afterDueIfIncomplete: { type: Boolean, default: true },
      boosterReminder: { type: Boolean, default: true },
      expiryReminder: { type: Boolean, default: true },
      followUpReminder: { type: Boolean, default: false }
    },
    status: {
      type: String,
      enum: ["scheduled", "due_soon", "overdue", "completed", "partially_completed", "cancelled", "missed"],
      default: "scheduled",
      index: true
    },
    assignments: { type: [assignmentSchema], validate: [(items) => items.length > 0, "Select at least one animal or group"] },
    financeTransaction: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null },
    previousCampaign: { type: mongoose.Schema.Types.ObjectId, ref: "VaccinationCampaign", default: null },
    inventorySourceTransaction: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null },
    inventoryDeductionTransaction: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null },
    inventoryQuantityUsed: { type: Number, min: 0, default: 0 },
    inventoryDeductedAt: { type: Date, default: null },
    notes: { type: String, trim: true, maxlength: 3000, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

vaccinationCampaignSchema.index({ user: 1, scheduledDate: 1, status: 1 });
vaccinationCampaignSchema.index({ user: 1, "assignments.animal": 1 });
vaccinationCampaignSchema.index({ user: 1, "assignments.group": 1 });

vaccinationCampaignSchema.pre("validate", function normalizeSupportedSpecies(next) {
  const values = this.supportedSpecies?.length ? this.supportedSpecies : [this.species];
  this.supportedSpecies = [...new Set(values.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean))];
  if (!this.species && this.supportedSpecies.length) this.species = this.supportedSpecies[0];
  next();
});

export default mongoose.model("VaccinationCampaign", vaccinationCampaignSchema);
