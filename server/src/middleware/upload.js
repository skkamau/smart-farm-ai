import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import multer from "multer";

const uploadDir = path.resolve("uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const allowedTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);
const allowedExtensions = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp", ".csv", ".xlsx", ".doc", ".docx"]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${randomUUID()}${extension}`);
  }
});

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!allowedTypes.has(file.mimetype) || !allowedExtensions.has(extension)) {
      const error = new Error("Unsupported file type");
      error.statusCode = 400;
      return cb(error);
    }
    cb(null, true);
  }
});

const bugScreenshotTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const bugScreenshotExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export const bugScreenshotUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 3, parts: 4, fieldSize: 10 * 1024 },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!bugScreenshotTypes.has(file.mimetype) || !bugScreenshotExtensions.has(extension)) {
      const error = new Error("Screenshot must be a JPG, PNG, or WEBP image");
      error.statusCode = 400;
      return cb(error);
    }
    cb(null, true);
  }
});
