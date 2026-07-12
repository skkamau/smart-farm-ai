import mongoose from "mongoose";

const adminActivityLogSchema = new mongoose.Schema(
  {
    actorUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    actorRole: { type: String, enum: ["user", "admin", "super_admin", "system"], default: "system" },
    action: {
      type: String,
      enum: [
        "admin_login_success",
        "admin_login_failed",
        "user_suspended",
        "user_reactivated",
        "user_role_changed",
        "report_status_changed",
        "record_deleted",
        "animal_status_changed"
      ],
      required: true,
      index: true
    },
    outcome: { type: String, enum: ["success", "failure"], default: "success", index: true },
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    targetType: { type: String, trim: true, maxlength: 80, default: "" },
    targetId: { type: String, trim: true, maxlength: 120, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

adminActivityLogSchema.index({ createdAt: -1 });
adminActivityLogSchema.index({ action: 1, createdAt: -1 });

export default mongoose.model("AdminActivityLog", adminActivityLogSchema);
