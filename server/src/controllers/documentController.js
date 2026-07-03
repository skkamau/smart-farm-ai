import fs from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import Document from "../models/Document.js";

const entityTypes = new Set(["animal", "health", "vaccination", "crop", "transaction"]);

function validEntity(entityType, entityId) {
  return entityTypes.has(entityType) && mongoose.Types.ObjectId.isValid(entityId);
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

    const doc = await Document.create({
      user: req.user._id,
      entityType,
      entityId,
      originalName: req.file.originalname,
      storedName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url: `/uploads/${req.file.filename}`,
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
    await fs.rm(path.resolve("uploads", document.storedName), { force: true });
    res.json({ message: "Document deleted" });
  } catch (error) {
    next(error);
  }
}
