import fs from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import Document from "../models/Document.js";
import Animal from "../models/Animal.js";
import Crop from "../models/Crop.js";
import HealthRecord from "../models/HealthRecord.js";
import Transaction from "../models/Transaction.js";
import VaccinationRecord from "../models/VaccinationRecord.js";

const entityTypes = new Set(["animal", "health", "vaccination", "crop", "transaction"]);
const uploadRoot = path.resolve("uploads");
const entityModels = {
  animal: Animal,
  health: HealthRecord,
  vaccination: VaccinationRecord,
  crop: Crop,
  transaction: Transaction
};

function validEntity(entityType, entityId) {
  return entityTypes.has(entityType) && mongoose.Types.ObjectId.isValid(entityId);
}

function safeDownloadName(name) {
  return String(name || "document")
    .replace(/[\\/:*?"<>|\r\n]+/g, "_")
    .slice(0, 180);
}

function storedFilePath(storedName) {
  const resolved = path.resolve(uploadRoot, storedName);
  if (!resolved.startsWith(`${uploadRoot}${path.sep}`)) throw new Error("Invalid stored file path");
  return resolved;
}

async function assertEntityOwnership(user, entityType, entityId) {
  const Model = entityModels[entityType];
  if (!Model) return false;
  return Boolean(await Model.exists({ _id: entityId, user }));
}

export async function listDocuments(req, res, next) {
  try {
    const { entityType, entityId } = req.query;
    if (!validEntity(entityType, entityId)) return res.status(400).json({ message: "Valid entity type and id are required" });
    const documents = await Document.find({ user: req.user._id, entityType, entityId }).sort({ createdAt: -1 });
    res.json(documents);
  } catch (error) {
    next(error);
  }
}

export async function uploadDocument(req, res, next) {
  try {
    const { entityType, entityId, notes = "" } = req.body;
    if (!validEntity(entityType, entityId)) return res.status(400).json({ message: "Valid entity type and id are required" });
    if (!req.file) return res.status(400).json({ message: "File is required" });
    if (!(await assertEntityOwnership(req.user._id, entityType, entityId))) {
      await fs.rm(storedFilePath(req.file.filename), { force: true });
      return res.status(404).json({ message: "Linked record not found" });
    }

    const doc = await Document.create({
      user: req.user._id,
      entityType,
      entityId,
      originalName: req.file.originalname,
      storedName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url: `/api/documents/download`,
      notes
    });
    res.status(201).json(doc);
  } catch (error) {
    next(error);
  }
}

export async function deleteDocument(req, res, next) {
  try {
    const document = await Document.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!document) return res.status(404).json({ message: "Document not found" });
    await fs.rm(storedFilePath(document.storedName), { force: true });
    res.json({ message: "Document deleted" });
  } catch (error) {
    next(error);
  }
}

export async function downloadDocument(req, res, next) {
  try {
    const document = await Document.findOne({
      $or: [
        mongoose.Types.ObjectId.isValid(req.params.id) ? { _id: req.params.id } : null,
        { storedName: req.params.id }
      ].filter(Boolean),
      user: req.user._id
    });
    if (!document) return res.status(404).json({ message: "Document not found" });
    const filePath = storedFilePath(document.storedName);
    res.download(filePath, safeDownloadName(document.originalName));
  } catch (error) {
    next(error);
  }
}
