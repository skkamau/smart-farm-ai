import InventoryItem from "../models/InventoryItem.js";

const optionalKeyIndexes = [
  {
    name: "user_1_legacyKey_1",
    key: { user: 1, legacyKey: 1 },
    partialFilterExpression: { legacyKey: { $type: "string" } }
  },
  {
    name: "user_1_produceKey_1",
    key: { user: 1, produceKey: 1 },
    partialFilterExpression: { produceKey: { $type: "string" } }
  }
];

function usesRequiredFilter(index, expectedFilter) {
  return JSON.stringify(index.partialFilterExpression) === JSON.stringify(expectedFilter);
}

// Older releases used sparse unique indexes. MongoDB indexes explicit nulls in
// those indexes, so a user's second ordinary inventory item failed with E11000.
export async function migrateInventoryOptionalKeyIndexes() {
  const collection = InventoryItem.collection;
  const indexes = await collection.indexes();

  for (const expected of optionalKeyIndexes) {
    const existing = indexes.find((index) => index.name === expected.name);
    if (existing && !usesRequiredFilter(existing, expected.partialFilterExpression)) {
      await collection.dropIndex(existing.name);
    }
    await collection.createIndex(expected.key, {
      name: expected.name,
      unique: true,
      partialFilterExpression: expected.partialFilterExpression
    });
  }
}
