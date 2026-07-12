import HealthRecord from "../models/HealthRecord.js";

const recognized = new Set(["healthy", "mild", "moderate", "serious", "critical", "recovering", "chronic", "stable", "unknown"]);

export function migrateLegacyConditionValue(condition, diagnosis = "") {
  const original = String(condition || "").trim();
  const normalized = original.toLowerCase();
  if (recognized.has(normalized)) return { healthCondition: normalized, diagnosis: String(diagnosis || "").trim() };
  if (normalized === "sick") return { healthCondition: "moderate", diagnosis: String(diagnosis || "").trim() };
  return {
    healthCondition: "unknown",
    diagnosis: String(diagnosis || "").trim() || original
  };
}

export async function migrateHealthConditions() {
  const records = await HealthRecord.collection.find({ healthCondition: { $exists: false } }, { projection: { condition: 1, diagnosis: 1 } }).toArray();
  if (!records.length) return 0;
  const operations = records.map((record) => ({
    updateOne: {
      filter: { _id: record._id, healthCondition: { $exists: false } },
      update: { $set: migrateLegacyConditionValue(record.condition, record.diagnosis) }
    }
  }));
  const result = await HealthRecord.collection.bulkWrite(operations, { ordered: false });
  if (result.modifiedCount) console.log(`Migrated ${result.modifiedCount} health condition records`);
  return result.modifiedCount;
}
