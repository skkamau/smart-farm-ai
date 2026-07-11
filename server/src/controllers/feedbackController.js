import fs from "node:fs/promises";
import path from "node:path";
import BugReport from "../models/BugReport.js";

const reportTypes = new Set(["Bug", "Suggestion", "Feature request", "Account issue", "Data issue", "Other"]);
const uploadRoot = path.resolve("uploads");

function storedFilePath(storedName) {
  const resolved = path.resolve(uploadRoot, storedName);
  if (!resolved.startsWith(`${uploadRoot}${path.sep}`)) throw new Error("Invalid stored file path");
  return resolved;
}

async function removeUploadedFile(file) {
  if (file?.filename) await fs.rm(storedFilePath(file.filename), { force: true });
}

export async function createBugReport(req, res, next) {
  try {
    const reportType = String(req.body.reportType || "").trim();
    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim();
    if (!reportTypes.has(reportType)) {
      await removeUploadedFile(req.file);
      return res.status(400).json({ message: "Choose a valid report type" });
    }
    if (title.length < 3 || title.length > 160) {
      await removeUploadedFile(req.file);
      return res.status(400).json({ message: "Title must be between 3 and 160 characters" });
    }
    if (description.length < 10 || description.length > 5000) {
      await removeUploadedFile(req.file);
      return res.status(400).json({ message: "Description must be between 10 and 5000 characters" });
    }

    const report = await BugReport.create({
      user: req.user._id,
      reportType,
      title,
      description,
      screenshot: req.file ? {
        originalName: req.file.originalname,
        storedName: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size
      } : null
    });
    res.status(201).json(report);
  } catch (error) {
    await removeUploadedFile(req.file).catch(() => {});
    next(error);
  }
}

export async function listOwnBugReports(req, res, next) {
  try {
    const reports = await BugReport.find({ user: req.user._id })
      .select("reportType title description screenshot status createdAt updatedAt")
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(reports);
  } catch (error) {
    next(error);
  }
}

export async function downloadOwnScreenshot(req, res, next) {
  try {
    const report = await BugReport.findOne({ _id: req.params.id, user: req.user._id });
    if (!report?.screenshot?.storedName) return res.status(404).json({ message: "Screenshot not found" });
    res.download(storedFilePath(report.screenshot.storedName), report.screenshot.originalName || "report-screenshot");
  } catch (error) {
    next(error);
  }
}
