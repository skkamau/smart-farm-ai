import InventoryItem from "../models/InventoryItem.js";
import StockMovement from "../models/StockMovement.js";
import Transaction from "../models/Transaction.js";
import { classificationFor } from "../controllers/inventoryController.js";

const inventorySections = ["Equipment", "Feed", "Fuel", "Consumables"];

function categoryFor(section, record) {
  if (section === "Equipment") return "Equipment";
  if (section === "Feed") return "Feed";
  if (section === "Fuel") return "Fuel";
  const category = String(record.category || "").toLowerCase();
  if (category.includes("medicine")) return "Medicine";
  if (category.includes("vaccine")) return "Vaccine";
  if (category.includes("fertilizer")) return "Fertilizer";
  if (category.includes("seed")) return "Seed";
  return "Farm supplies";
}

function inferQuantity(records) {
  const latest = records[0];
  const latestBalance = Number(latest.balance);
  const movementTotal = records.reduce((sum, record) => sum + Number(record.quantityIn || 0) - Number(record.quantityOut || 0), 0);
  const explicitQuantity = records.reduce((max, record) => Math.max(max, Number(record.quantity || 0)), 0);
  // Legacy forms sometimes saved balance=0 even when quantity held the real opening stock.
  if (latestBalance > 0) return latestBalance;
  if (movementTotal > 0) return movementTotal;
  return explicitQuantity;
}

export async function migrateLegacyInventory() {
  const records = await Transaction.find({
    financeSection: { $in: inventorySections },
    item: { $type: "string", $ne: "" },
    source: { $ne: "inventory" }
  }).sort({ transactionDate: -1, createdAt: -1 });

  const groups = new Map();
  for (const record of records) {
    const key = `${record.user}:${record.financeSection}:${record.item.trim().toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }

  let migrated = 0;
  for (const [legacyKey, group] of groups) {
    const latest = group[0];
    const currentQuantity = Math.max(0, inferQuantity(group));
    const unitCost = Number(latest.unitCost || (currentQuantity > 0 ? latest.amount / currentQuantity : 0) || 0);
    let item;
    try {
      item = await InventoryItem.findOneAndUpdate(
        { user: latest.user, legacyKey },
        {
          $setOnInsert: {
            name: latest.item.trim(),
            category: categoryFor(latest.financeSection, latest),
            classification: classificationFor(categoryFor(latest.financeSection, latest)),
            unit: latest.unit || "units",
            openingQuantity: currentQuantity,
            currentQuantity,
            minimumStockLevel: Number(latest.minimumStockLevel || 0),
            averageUnitCost: Math.max(0, unitCost),
            storageLocation: latest.storageLocation || "",
            supplier: latest.supplierVendor || "",
            expiryDate: latest.expiryDate || null,
            notes: latest.notes || latest.remarks || latest.description || "",
            legacyTransactionIds: group.map((record) => record._id)
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      await StockMovement.updateOne(
        { user: latest.user, item: item._id, type: "migration" },
        {
          $setOnInsert: {
            quantity: currentQuantity,
            quantityChange: currentQuantity,
            balanceAfter: currentQuantity,
            movementDate: latest.transactionDate || latest.createdAt,
            unitCost: Math.max(0, unitCost),
            supplier: latest.supplierVendor || "",
            notes: "Imported from the previous inventory system",
            createdBy: latest.user
          }
        },
        { upsert: true }
      );
      migrated += 1;
    } catch (error) {
      console.error("Legacy inventory migration skipped a record group", { legacyKey, message: error.message });
    }
  }
  if (migrated) console.log(`Inventory compatibility check completed for ${migrated} legacy item groups`);
}
