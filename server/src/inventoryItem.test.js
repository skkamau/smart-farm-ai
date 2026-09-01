import assert from "node:assert/strict";
import dotenv from "dotenv";
import mongoose from "mongoose";
import InventoryItem from "./models/InventoryItem.js";
import User from "./models/User.js";
import { migrateInventoryOptionalKeyIndexes } from "./services/inventoryIndexMigration.js";

dotenv.config();
await mongoose.connect(process.env.MONGODB_URI);
await migrateInventoryOptionalKeyIndexes();
let user;

try {
  const stamp = Date.now();
  user = await User.create({
    name: "Inventory Schema Test",
    email: `inventory-schema-${stamp}@example.invalid`,
    password: "TempPass1!",
    farmName: "Inventory Test Farm"
  });
  const base = { user: user._id, category: "Feed", classification: "consumable", unit: "kg" };
  const first = await InventoryItem.create({ ...base, name: `Test feed one ${stamp}` });
  const second = await InventoryItem.create({ ...base, name: `Test feed two ${stamp}` });
  assert.equal(first.legacyKey, undefined);
  assert.equal(first.produceKey, undefined);
  assert.equal(second.legacyKey, undefined);
  assert.equal(second.produceKey, undefined);
  console.log("Inventory optional key regression test passed");
} finally {
  if (user) {
    await InventoryItem.deleteMany({ user: user._id });
    await User.deleteOne({ _id: user._id });
  }
  await mongoose.disconnect();
}
