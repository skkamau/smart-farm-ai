import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ["user", "admin", "super_admin"], default: "user", index: true },
    accountStatus: { type: String, enum: ["active", "suspended"], default: "active", index: true },
    suspendedAt: { type: Date, default: null },
    suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    suspensionReason: { type: String, trim: true, default: "", maxlength: 500 },
    lastLoginAt: { type: Date, default: null },
    lastActiveAt: { type: Date, default: null, index: true },
    farmName: { type: String, default: "Smart Farm", trim: true },
    farmLocation: { type: String, trim: true, default: "" },
    farmType: { type: String, enum: ["crops", "livestock", "mixed", "other"], default: "mixed" },
    mainActivities: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    preferences: {
      theme: { type: String, enum: ["light", "dark", "system"], default: "system" },
      currency: { type: String, trim: true, default: "KES" },
      units: { type: String, enum: ["metric", "imperial", "mixed"], default: "metric" },
      notifications: {
        inventoryAlerts: { type: Boolean, default: true },
        animalHealthReminders: { type: Boolean, default: true },
        cropReminders: { type: Boolean, default: true }
      }
    },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
    passwordResetRequestedAt: { type: Date, select: false },
    passwordChangedAt: { type: Date },
    sessionVersion: { type: Number, default: 0 }
  },
  { timestamps: true }
);

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.matchPassword = function matchPassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

export default mongoose.model("User", userSchema);
