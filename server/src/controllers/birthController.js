import mongoose from "mongoose";
import { body } from "express-validator";
import Animal from "../models/Animal.js";
import BirthRecord from "../models/BirthRecord.js";

const MAX_OFFSPRING = 20;
const population = [
  { path: "mother", select: "animalId name species breed gender" },
  { path: "father", select: "animalId name species breed gender" },
  { path: "offspring", select: "animalId name species breed gender dateOfBirth birthWeight weightUnit healthStatus lifecycleStatus birthRecord" }
];

export const birthRules = [
  body("mother").isMongoId().withMessage("Mother is required"),
  body("father").optional({ nullable: true, checkFalsy: true }).isMongoId().withMessage("Choose a valid father or Unknown"),
  body("birthDate").isISO8601().toDate().withMessage("Enter a valid birth date").custom((value) => {
    if (new Date(value) > new Date()) throw new Error("Birth date cannot be in the future");
    return true;
  }),
  body("numberOfOffspring").isInt({ min: 1, max: MAX_OFFSPRING }).withMessage(`Number of offspring must be between 1 and ${MAX_OFFSPRING}`),
  body("offspringMode").optional().isIn(["create", "link"]).withMessage("Choose how offspring records should be added"),
  body("offspring").optional().isArray().withMessage("Linked offspring must be a list"),
  body("offspring.*").optional().isMongoId().withMessage("Choose valid offspring animals"),
  body("newOffspring").optional().isArray().withMessage("New offspring must be a list"),
  body("newOffspring.*.animalId").optional().trim().notEmpty().withMessage("Every offspring needs an animal ID"),
  body("newOffspring.*.species").optional().trim().notEmpty().withMessage("Every offspring needs a species"),
  body("newOffspring.*.gender").optional().isIn(["Male", "Female", "Unknown"]).withMessage("Choose a valid offspring sex"),
  body("newOffspring.*.birthWeight").optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }).withMessage("Birth weight must be zero or greater"),
  body("newOffspring.*.weightUnit").optional().isIn(["kg", "g", "lb"]).withMessage("Choose a valid weight unit"),
  body("newOffspring.*.healthStatus").optional().isIn(["healthy", "sick", "recovering", "chronic", "referred", "unknown"]).withMessage("Choose a valid health status"),
  body("newOffspring.*.lifecycleStatus").optional().isIn(["active", "sold", "transferred", "archived", "deceased"]).withMessage("Choose a valid lifecycle status"),
  body("submissionKey").optional().trim().isLength({ min: 8, max: 100 }).withMessage("Invalid submission key")
];

export function normalizeFather(value) {
  return value ? value : null;
}

function payload(source) {
  return {
    mother: source.mother,
    father: normalizeFather(source.father),
    fatherKnown: Boolean(source.father),
    birthDate: source.birthDate,
    numberOfOffspring: Number(source.numberOfOffspring),
    offspringMode: source.offspringMode || "link",
    offspring: Array.isArray(source.offspring) ? source.offspring.filter(Boolean) : [],
    newOffspring: Array.isArray(source.newOffspring) ? source.newOffspring : [],
    birthComplications: source.birthComplications || "",
    vetNotes: source.vetNotes || "",
    notes: source.notes || "",
    submissionKey: source.submissionKey || undefined
  };
}

function withSession(query, session) {
  return session ? query.session(session) : query;
}

function id(value) {
  return String(value?._id || value || "");
}

function uniqueIds(values) {
  return [...new Set((values || []).filter(Boolean).map(id))];
}

function exactCaseInsensitive(value) {
  const escaped = String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}$`, "i");
}

async function existingAnimalId(user, values, session) {
  const ids = values.map((value) => String(value).trim()).filter(Boolean);
  if (!ids.length) return null;
  return withSession(Animal.exists({ user, $or: ids.map((animalId) => ({ animalId: exactCaseInsensitive(animalId) })) }), session);
}

async function loadParents(user, data, session) {
  const ids = [data.mother, data.father].filter(Boolean);
  const parents = await withSession(Animal.find({ user, _id: { $in: ids } }), session);
  const mother = parents.find((animal) => id(animal) === id(data.mother));
  const father = data.father ? parents.find((animal) => id(animal) === id(data.father)) : null;
  if (!mother || (data.father && !father)) throw Object.assign(new Error("One or more parent animals were not found"), { statusCode: 404 });
  if (father && id(mother) === id(father)) throw Object.assign(new Error("Mother and father cannot be the same animal"), { statusCode: 400 });
  if (mother.gender === "Male") throw Object.assign(new Error("The selected mother must be female"), { statusCode: 400 });
  if (father?.gender === "Female") throw Object.assign(new Error("The selected father must be male"), { statusCode: 400 });
  if (father && mother.species.trim().toLowerCase() !== father.species.trim().toLowerCase()) {
    throw Object.assign(new Error("Mother and father must be the same species"), { statusCode: 400 });
  }
  return { mother, father };
}

function validateNewOffspring(data, mother) {
  if (data.newOffspring.length !== data.numberOfOffspring) {
    throw Object.assign(new Error("Number of offspring must match the offspring records provided"), { statusCode: 400 });
  }
  const animalIds = data.newOffspring.map((animal) => String(animal.animalId || "").trim().toLowerCase());
  if (new Set(animalIds).size !== animalIds.length) throw Object.assign(new Error("Offspring animal IDs must be unique"), { statusCode: 409 });
  for (const animal of data.newOffspring) {
    if (String(animal.species || "").trim().toLowerCase() !== mother.species.trim().toLowerCase()) {
      throw Object.assign(new Error("Every offspring must be the same species as the mother"), { statusCode: 400 });
    }
  }
}

async function validateExistingOffspring(user, data, mother, recordId, session) {
  const offspringIds = uniqueIds(data.offspring);
  if (offspringIds.length !== data.numberOfOffspring) {
    throw Object.assign(new Error("Number of offspring must match the linked animal records"), { statusCode: 400 });
  }
  if (offspringIds.includes(id(mother)) || (data.father && offspringIds.includes(id(data.father)))) {
    throw Object.assign(new Error("A parent cannot also be linked as offspring"), { statusCode: 400 });
  }
  const animals = await withSession(Animal.find({ user, _id: { $in: offspringIds } }), session);
  if (animals.length !== offspringIds.length) throw Object.assign(new Error("One or more offspring animals were not found"), { statusCode: 404 });
  for (const animal of animals) {
    if (animal.species.trim().toLowerCase() !== mother.species.trim().toLowerCase()) {
      throw Object.assign(new Error(`${animal.animalId} is not the same species as the mother`), { statusCode: 400 });
    }
    if (animal.birthRecord && id(animal.birthRecord) !== id(recordId)) {
      throw Object.assign(new Error(`${animal.animalId} is already linked to another birth record`), { statusCode: 409 });
    }
    if (animal.dateOfBirth && new Date(animal.dateOfBirth) > new Date(data.birthDate).setHours(23, 59, 59, 999)) {
      throw Object.assign(new Error(`${animal.animalId} has a birth date after this birth record`), { statusCode: 400 });
    }
  }
  return offspringIds;
}

function newAnimalPayload(item, data, record, user) {
  const birthWeight = item.birthWeight === "" || item.birthWeight == null ? null : Number(item.birthWeight);
  const deceased = item.lifecycleStatus === "deceased";
  return {
    user,
    animalId: String(item.animalId).trim(),
    name: item.name || "",
    species: String(item.species).trim(),
    breed: item.breed || "",
    gender: item.gender || "Unknown",
    dateOfBirth: data.birthDate,
    weight: birthWeight || 0,
    birthWeight,
    weightUnit: item.weightUnit || "kg",
    healthStatus: deceased ? "unknown" : item.healthStatus || "unknown",
    lifecycleStatus: item.lifecycleStatus || "active",
    status: deceased ? "Deceased" : item.healthStatus === "healthy" ? "Healthy" : item.healthStatus === "sick" ? "Sick" : "Healthy",
    dateOfDeath: deceased ? data.birthDate : null,
    causeOfDeath: deceased ? "Birth complications" : "",
    distinguishingMarks: item.distinguishingMarks || "",
    notes: item.notes || "",
    mother: data.mother,
    father: data.father,
    birthRecord: record._id
  };
}

async function syncFamily(user, previous, record, session) {
  const previousOffspring = uniqueIds(previous?.offspring);
  const currentOffspring = uniqueIds(record.offspring);
  const removed = previousOffspring.filter((offspringId) => !currentOffspring.includes(offspringId));
  const oldMother = id(previous?.mother);
  const oldFather = id(previous?.father);
  const motherId = id(record.mother);
  const fatherId = id(record.father);
  const options = session ? { session } : {};

  if (removed.length) {
    await Animal.updateMany(
      { user, _id: { $in: removed }, birthRecord: record._id },
      { $set: { birthRecord: null, mother: null, father: null } },
      options
    );
  }
  for (const parentId of uniqueIds([oldMother, oldFather])) {
    const toRemove = parentId !== motherId && parentId !== fatherId ? previousOffspring : removed;
    if (toRemove.length) await Animal.updateOne({ user, _id: parentId }, { $pull: { children: { $in: toRemove } } }, options);
  }
  if (!currentOffspring.length) return;
  await Animal.updateMany(
    { user, _id: { $in: currentOffspring } },
    { $set: { mother: motherId, father: fatherId || null, birthRecord: record._id } },
    options
  );
  await Animal.updateOne(
    { user, _id: motherId },
    { $addToSet: { children: { $each: currentOffspring } }, $set: { reproductiveStatus: "postpartum" } },
    options
  );
  if (fatherId) await Animal.updateOne({ user, _id: fatherId }, { $addToSet: { children: { $each: currentOffspring } } }, options);
}

async function createOperation(user, data, session, cleanup) {
  const { mother } = await loadParents(user, data, session);
  const recordValues = {
    user,
    mother: data.mother,
    father: data.father,
    fatherKnown: Boolean(data.father),
    birthDate: data.birthDate,
    numberOfOffspring: data.numberOfOffspring,
    offspring: [],
    birthComplications: data.birthComplications,
    vetNotes: data.vetNotes,
    notes: data.notes,
    submissionKey: data.submissionKey
  };
  const [record] = await BirthRecord.create([recordValues], session ? { session } : undefined);
  cleanup.recordId = record._id;

  if (data.offspringMode === "create") {
    validateNewOffspring(data, mother);
    const lowerIds = data.newOffspring.map((animal) => String(animal.animalId).trim());
    const duplicate = await existingAnimalId(user, lowerIds, session);
    if (duplicate) throw Object.assign(new Error("One or more offspring animal IDs already exist"), { statusCode: 409 });
    const created = await Animal.create(data.newOffspring.map((animal) => newAnimalPayload(animal, data, record, user)), session ? { session } : undefined);
    cleanup.animalIds = created.map((animal) => animal._id);
    record.offspring = cleanup.animalIds;
  } else {
    record.offspring = await validateExistingOffspring(user, data, mother, record._id, session);
  }
  await record.save(session ? { session } : undefined);
  await syncFamily(user, null, record, session);
  return record;
}

async function rollbackCreate(user, cleanup) {
  if (cleanup.recordId) {
    await Animal.updateMany({ user, birthRecord: cleanup.recordId }, { $set: { birthRecord: null, mother: null, father: null } }).catch(() => {});
    await Animal.updateMany({ user }, { $pull: { children: { $in: cleanup.animalIds || [] } } }).catch(() => {});
    await BirthRecord.deleteOne({ _id: cleanup.recordId, user }).catch(() => {});
  }
  if (cleanup.animalIds?.length) await Animal.deleteMany({ user, _id: { $in: cleanup.animalIds } }).catch(() => {});
}

async function updateOperation(user, recordId, data, session, cleanup) {
  const record = await withSession(BirthRecord.findOne({ _id: recordId, user }), session);
  if (!record) throw Object.assign(new Error("Birth record not found"), { statusCode: 404 });
  const previous = {
    mother: record.mother,
    father: record.father,
    fatherKnown: record.fatherKnown,
    birthDate: record.birthDate,
    numberOfOffspring: record.numberOfOffspring,
    offspring: [...record.offspring],
    birthComplications: record.birthComplications,
    vetNotes: record.vetNotes,
    notes: record.notes
  };
  cleanup.previous = previous;
  const { mother } = await loadParents(user, data, session);
  let offspringIds;
  if (data.offspringMode === "create" && data.newOffspring.length) {
    validateNewOffspring(data, mother);
    const duplicate = await existingAnimalId(user, data.newOffspring.map((animal) => animal.animalId), session);
    if (duplicate) throw Object.assign(new Error("One or more offspring animal IDs already exist"), { statusCode: 409 });
    const created = await Animal.create(data.newOffspring.map((animal) => newAnimalPayload(animal, data, record, user)), session ? { session } : undefined);
    cleanup.animalIds = created.map((animal) => animal._id);
    offspringIds = cleanup.animalIds;
  } else {
    offspringIds = await validateExistingOffspring(user, data, mother, record._id, session);
  }
  Object.assign(record, {
    mother: data.mother,
    father: data.father,
    fatherKnown: Boolean(data.father),
    birthDate: data.birthDate,
    numberOfOffspring: data.numberOfOffspring,
    offspring: offspringIds,
    birthComplications: data.birthComplications,
    vetNotes: data.vetNotes,
    notes: data.notes
  });
  cleanup.attempted = { mother: record.mother, father: record.father, offspring: [...record.offspring] };
  await record.save(session ? { session } : undefined);
  await syncFamily(user, previous, record, session);
  return record;
}

async function rollbackUpdate(user, recordId, cleanup) {
  if (!cleanup.previous) return;
  const record = await BirthRecord.findOne({ _id: recordId, user }).catch(() => null);
  if (record) {
    const attempted = cleanup.attempted || { mother: record.mother, father: record.father, offspring: [...record.offspring] };
    Object.assign(record, cleanup.previous);
    await record.save().catch(() => {});
    await syncFamily(user, attempted, record).catch(() => {});
  }
  if (cleanup.animalIds?.length) await Animal.deleteMany({ user, _id: { $in: cleanup.animalIds } }).catch(() => {});
}

function transactionUnsupported(error) {
  return /Transaction numbers are only allowed|does not support transactions|replica set member/i.test(error?.message || "");
}

export async function listBirthRecords(req, res, next) {
  try {
    const query = { user: req.user._id };
    if (req.query.animal) query.$or = [{ mother: req.query.animal }, { father: req.query.animal }, { offspring: req.query.animal }];
    const records = await BirthRecord.find(query).populate(population).sort({ birthDate: -1 });
    res.json(records);
  } catch (error) { next(error); }
}

export async function createBirthRecord(req, res, next) {
  const data = payload(req.body);
  const user = req.user._id;
  try {
    if (data.submissionKey) {
      const existing = await BirthRecord.findOne({ user, submissionKey: data.submissionKey }).populate(population);
      if (existing) return res.status(200).json(existing);
    }
    let record;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => { record = await createOperation(user, data, session, {}); });
    } catch (error) {
      if (!transactionUnsupported(error)) throw error;
      const cleanup = {};
      try { record = await createOperation(user, data, null, cleanup); }
      catch (fallbackError) { await rollbackCreate(user, cleanup); throw fallbackError; }
    } finally { await session.endSession(); }
    res.status(201).json(await record.populate(population));
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "An offspring ID or this birth submission already exists" });
    next(error);
  }
}

export async function updateBirthRecord(req, res, next) {
  const data = payload(req.body);
  const user = req.user._id;
  try {
    let record;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => { record = await updateOperation(user, req.params.id, data, session, {}); });
    } catch (error) {
      if (!transactionUnsupported(error)) throw error;
      const cleanup = {};
      try { record = await updateOperation(user, req.params.id, data, null, cleanup); }
      catch (fallbackError) { await rollbackUpdate(user, req.params.id, cleanup); throw fallbackError; }
    } finally { await session.endSession(); }
    res.json(await record.populate(population));
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "One or more offspring animal IDs already exist" });
    next(error);
  }
}

export async function deleteBirthRecord(req, res, next) {
  try {
    const record = await BirthRecord.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!record) return res.status(404).json({ message: "Birth record not found" });
    res.json({ message: "Birth record deleted" });
  } catch (error) { next(error); }
}
