import ProductionRecord from "../models/ProductionRecord.js";
import { addProductionToInventory } from "./productionInventoryService.js";

export async function migrateProductionInventory() {
  const records = await ProductionRecord.find({ status: "active", inventoryMovement: null }).select("+stockVersion");
  let linked = 0;
  for (const record of records) {
    try {
      const movement = await addProductionToInventory(record);
      if (movement) linked += 1;
    } catch (error) {
      console.error(`Production inventory migration skipped batch ${record.batchReference}: ${error.message}`);
    }
  }
  if (records.length) console.log(`Production inventory compatibility check linked ${linked} of ${records.length} batches`);
}
