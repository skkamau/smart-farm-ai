import assert from "node:assert/strict";
import fs from "node:fs";
import { buildReceiptView, createReceiptPdf, receiptLogoPath, safeReceiptFilename } from "./services/receiptDocumentService.js";

const user = {
  name: "Farm Owner", email: "owner@example.test", farmName: "Green Valley Farm",
  farmLocation: "Nakuru, Kenya", phone: "+254700000000", preferences: { currency: "KES" }
};

function context(overrides = {}) {
  const sale = {
    saleNumber: "SALE-TEST-001", productName: "Table Eggs", quantity: 10, saleUnit: "egg",
    unitPrice: 15, totalAmount: 150, customer: "Walk-in Customer", customerPhone: "", notes: "",
    ...overrides.sale
  };
  const receipt = {
    receiptNumber: "RCPT-20260802-TEST0001", paymentId: "64ab00000000000000000001",
    amountReceived: 50, paymentDate: "2026-08-02T19:30:00.000Z", paymentMethod: "Cash",
    paymentReference: "", remainingBalance: 100, issuedBy: { name: "Farm Owner" },
    voidedAt: null, voidReason: "", voidedBy: null, ...overrides.receipt
  };
  return { receipt, sale, transaction: {}, payment: overrides.payment || null, user };
}

function pdfBuffer(view) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = createReceiptPdf(view);
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

assert.ok(fs.existsSync(receiptLogoPath), "Approved local Smart Farm AI logo must exist");
assert.equal(safeReceiptFilename("RCPT/unsafe:01"), "Smart-Farm-AI-Receipt-RCPT-unsafe-01.pdf");

const partial = buildReceiptView(context());
assert.equal(partial.status, "Partially Paid");
assert.equal(partial.previousPayments, 0);
assert.equal(partial.totalPaidToDate, 50);
assert.equal(partial.remainingBalance, 100);
assert.equal(partial.items.length, 1);
assert.equal(partial.items[0].total, 150);
assert.equal(partial.payment.reference, "");

const paid = buildReceiptView(context({ receipt: { amountReceived: 100, remainingBalance: 0 }, sale: { totalAmount: 150 } }));
assert.equal(paid.status, "Paid");
assert.equal(paid.previousPayments, 50);
assert.equal(paid.totalPaidToDate, 150);

const adjusted = buildReceiptView(context({ sale: {
  items: [
    { description: "Table Eggs", quantity: 10, unit: "egg", unitPrice: 15, total: 150 },
    { description: "Fresh Milk", quantity: 5, unit: "litre", unitPrice: 80, total: 400 }
  ], subtotal: 550, discountAmount: 25, additionalCharges: 15, taxAmount: 0, totalAmount: 540
}, receipt: { amountReceived: 300, remainingBalance: 240, paymentReference: "MPESA-001" }, payment: { notes: "Deposit payment" } }));
assert.equal(adjusted.items.length, 2);
assert.equal(adjusted.discount, 25);
assert.equal(adjusted.additionalCharges, 15);
assert.equal(adjusted.tax, 0);
assert.equal(adjusted.notes, "Deposit payment");
assert.equal(adjusted.payment.reference, "MPESA-001");

const voided = buildReceiptView(context({ receipt: {
  voidedAt: "2026-08-03T08:00:00.000Z", voidReason: "Payment reversed", voidedBy: { name: "Farm Owner" }
} }));
assert.equal(voided.status, "Voided");
assert.equal(voided.voidReason, "Payment reversed");
assert.equal(voided.voidedBy, "Farm Owner");

const longItems = Array.from({ length: 45 }, (_, index) => ({
  description: `Farm produce item ${index + 1} with a deliberately long description for page overflow verification`,
  quantity: index + 1, unit: "piece", unitPrice: 25, total: (index + 1) * 25
}));
const multiPage = buildReceiptView(context({ sale: { items: longItems, subtotal: 25875, totalAmount: 25875 }, receipt: { amountReceived: 1000, remainingBalance: 24875 } }));
const multiPageDoc = createReceiptPdf(multiPage);
assert.ok(multiPageDoc.bufferedPageRange().count > 1, "Long item tables should flow across PDF pages");
multiPageDoc.end();

for (const view of [partial, paid, adjusted, voided]) {
  const pdf = await pdfBuffer(view);
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  assert.ok(pdf.length > 5000, "Receipt PDF should contain the full styled document");
}

console.log("Receipt document tests passed");
