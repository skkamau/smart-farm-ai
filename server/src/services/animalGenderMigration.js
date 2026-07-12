import Animal from "../models/Animal.js";

export const unknownGenderFilter = {
  $or: [
    { gender: "Unknown" },
    { gender: "" },
    { gender: null },
    { gender: { $exists: false } }
  ]
};

export async function migrateUnknownAnimalGenders() {
  const result = await Animal.collection.updateMany(unknownGenderFilter, { $set: { gender: "Female" } });
  if (result.modifiedCount) console.log(`Migrated ${result.modifiedCount} unknown animal genders to Female`);
  return result.modifiedCount;
}
