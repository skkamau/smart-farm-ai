export const decreasingGroupEvents = new Set(["death", "culled", "sold", "harvested", "transferred_out", "missing"]);

export function groupQuantityDelta(eventType, quantity, currentQuantity) {
  const amount = Number(quantity);
  if (!Number.isInteger(amount) || amount < 0) throw new Error("Quantity must be a non-negative whole number");
  if (eventType !== "stock_correction" && amount < 1) throw new Error("Quantity must be greater than zero");
  if (eventType === "stock_correction") return amount - Number(currentQuantity);
  return decreasingGroupEvents.has(eventType) ? -amount : amount;
}

export function nextGroupQuantity(currentQuantity, eventType, quantity) {
  const next = Number(currentQuantity) + groupQuantityDelta(eventType, quantity, currentQuantity);
  if (next < 0) throw new Error("Quantity cannot become negative");
  return next;
}
