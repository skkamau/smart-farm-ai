import mongoose from "mongoose";

const screenshotSchema = new mongoose.Schema(
  {
    originalName: { type: String, trim: true },
    storedName: { type: String, trim: true },
    mimeType: { type: String, trim: true },
    size: { type: Number, min: 0 }
  },
  { _id: false }
);

const bugReportSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reportType: {
      type: String,
      enum: ["Bug", "Suggestion", "Feature request", "Account issue", "Data issue", "Other"],
      required: true,
      index: true
    },
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 160 },
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 5000 },
    screenshot: { type: screenshotSchema, default: null },
    status: {
      type: String,
      enum: ["New", "Reviewing", "In progress", "Resolved", "Rejected"],
      default: "New",
      index: true
    },
    adminNotes: { type: String, trim: true, maxlength: 2000, default: "" },
    resolvedAt: { type: Date, default: null },
    lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
  },
  { timestamps: true }
);

bugReportSchema.index({ createdAt: -1 });
bugReportSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("BugReport", bugReportSchema);
