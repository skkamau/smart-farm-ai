import Animal from "../models/Animal.js";

const mappings = {
  Healthy: { lifecycleStatus: "active", healthStatus: "healthy", reproductiveStatus: "unknown" },
  Sick: { lifecycleStatus: "active", healthStatus: "sick", reproductiveStatus: "unknown" },
  Pregnant: { lifecycleStatus: "active", healthStatus: "unknown", reproductiveStatus: "pregnant" },
  Sold: { lifecycleStatus: "sold", healthStatus: "unknown", reproductiveStatus: "unknown" },
  Transferred: { lifecycleStatus: "transferred", healthStatus: "unknown", reproductiveStatus: "unknown" },
  Archived: { lifecycleStatus: "archived", healthStatus: "unknown", reproductiveStatus: "unknown" },
  Deceased: { lifecycleStatus: "deceased", healthStatus: "unknown", reproductiveStatus: "unknown" }
};

export function legacyStatusMapping(status) {
  return mappings[status] || { lifecycleStatus: "active", healthStatus: "unknown", reproductiveStatus: "unknown" };
}

export async function migrateAnimalStatuses() {
  let migrated = 0;
  for (const [status, values] of Object.entries(mappings)) {
    const result = await Animal.updateMany(
      { status, $or: [{ lifecycleStatus: { $exists: false } }, { healthStatus: { $exists: false } }, { reproductiveStatus: { $exists: false } }] },
      { $set: values }
    );
    migrated += result.modifiedCount;
  }
  const fallback = await Animal.updateMany(
    { $or: [{ lifecycleStatus: { $exists: false } }, { healthStatus: { $exists: false } }, { reproductiveStatus: { $exists: false } }] },
    { $set: { lifecycleStatus: "active", healthStatus: "unknown", reproductiveStatus: "unknown" } }
  );
  migrated += fallback.modifiedCount;
  if (migrated) console.log(`Migrated ${migrated} animal status records`);
  return migrated;
}
