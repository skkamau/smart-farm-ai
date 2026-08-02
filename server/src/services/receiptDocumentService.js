import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";

const BRAND = "#06452f";
const BRAND_DARK = "#013d2a";
const TEXT = "#17211d";
const MUTED = "#5f6b66";
const BORDER = "#d8dfda";
const SOFT = "#f3f7f4";
const PAGE = { width: 595.28, height: 841.89, margin: 42, footerTop: 785 };
const logoPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../client/public/brand/smart-farm-mark.png");

const number = (value) => Number(value || 0);
const round = (value) => Math.round((number(value) + Number.EPSILON) * 100) / 100;
const idText = (value) => String(value?._id || value || "");

export function receiptStatus(view) {
  if (view.voidedAt) return "Voided";
  if (view.remainingBalance <= 0) return "Paid";
  if (view.totalPaidToDate > 0) return "Partially Paid";
  return "Unpaid";
}

export function buildReceiptView({ receipt, sale, transaction, payment, user }) {
  const savedCustomerName = String(sale.customer || "").trim();
  const savedItems = Array.isArray(sale.items) && sale.items.length ? sale.items : [{
    description: sale.productName,
    quantity: sale.quantity,
    unit: sale.saleUnit,
    unitPrice: sale.unitPrice,
    total: sale.totalAmount
  }];
  const items = savedItems.map((item, index) => ({
    number: index + 1,
    description: String(item.description || item.productName || "Farm product"),
    quantity: number(item.quantity),
    unit: String(item.unit || item.saleUnit || "item"),
    unitPrice: number(item.unitPrice),
    total: number(item.total ?? item.totalAmount ?? number(item.quantity) * number(item.unitPrice))
  }));
  const subtotal = round(number(sale.subtotal) || items.reduce((sum, item) => sum + item.total, 0));
  const discount = round(sale.discountAmount);
  const additionalCharges = round(sale.additionalCharges);
  const tax = round(sale.taxAmount);
  const saleTotal = round(sale.totalAmount);
  const remainingBalance = round(receipt.remainingBalance);
  const totalPaidToDate = round(Math.max(0, saleTotal - remainingBalance));
  const amountReceived = round(receipt.amountReceived);
  const previousPayments = round(Math.max(0, totalPaidToDate - amountReceived));
  const view = {
    receiptNumber: receipt.receiptNumber,
    receiptDate: receipt.paymentDate,
    saleNumber: sale.saleNumber,
    currency: user.preferences?.currency || "KES",
    farm: {
      name: user.farmName || "Smart Farm",
      location: user.farmLocation || "",
      phone: user.phone || "",
      email: user.email || ""
    },
    customer: {
      name: !savedCustomerName || savedCustomerName.toLowerCase() === "walk-in customer" ? "Walk-in Customer" : savedCustomerName,
      phone: sale.customerPhone || "",
      email: sale.customerEmail || "",
      address: sale.customerAddress || ""
    },
    items,
    subtotal,
    discount,
    additionalCharges,
    tax,
    saleTotal,
    previousPayments,
    amountReceived,
    totalPaidToDate,
    remainingBalance,
    payment: {
      method: receipt.paymentMethod,
      reference: receipt.paymentReference || "",
      date: receipt.paymentDate,
      receivedBy: receipt.issuedBy?.name || user.name,
      paymentNumber: `PAY-${idText(receipt.paymentId).slice(-8).toUpperCase()}`,
      notes: payment?.notes || ""
    },
    notes: payment?.notes || sale.notes || "",
    voidedAt: receipt.voidedAt || null,
    voidReason: receipt.voidReason || "",
    voidedBy: receipt.voidedBy?.name || "",
    verificationReference: receipt.receiptNumber
  };
  view.status = receiptStatus(view);
  return view;
}

export function safeReceiptFilename(receiptNumber) {
  const safe = String(receiptNumber || "receipt").replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-");
  return `Smart-Farm-AI-Receipt-${safe}.pdf`;
}

function money(value, currency) {
  return `${currency} ${number(value).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function date(value, withTime = false) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-KE", withTime
    ? { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
}

function sectionTitle(doc, title, y) {
  doc.fillColor(BRAND).font("Helvetica-Bold").fontSize(9).text(title.toUpperCase(), PAGE.margin, y, { characterSpacing: 0.4 });
  doc.moveTo(PAGE.margin, y + 15).lineTo(PAGE.width - PAGE.margin, y + 15).lineWidth(0.7).strokeColor(BORDER).stroke();
  return y + 24;
}

function pageHeader(doc, view) {
  const left = PAGE.margin;
  const right = PAGE.width - PAGE.margin;
  if (fs.existsSync(logoPath)) doc.image(logoPath, left, 40, { fit: [54, 54] });
  doc.fillColor(BRAND_DARK).font("Helvetica-Bold").fontSize(17).text("Smart Farm AI", left + 66, 42, { width: 245 });
  doc.fillColor(TEXT).fontSize(11).text(view.farm.name, left + 66, 64, { width: 245 });
  let contactY = 80;
  for (const value of [view.farm.location, view.farm.phone && `Phone: ${view.farm.phone}`, view.farm.email && `Email: ${view.farm.email}`].filter(Boolean)) {
    doc.fillColor(MUTED).font("Helvetica").fontSize(8.5).text(value, left + 66, contactY, { width: 250 });
    contactY += 12;
  }
  doc.fillColor(BRAND_DARK).font("Helvetica-Bold").fontSize(22).text("RECEIPT", right - 205, 40, { width: 205, align: "right" });
  const meta = [
    [`Receipt #:`, view.receiptNumber],
    [`Date:`, date(view.receiptDate)],
    [`Sale #:`, view.saleNumber]
  ];
  let metaY = 70;
  for (const [label, value] of meta) {
    doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(8).text(label, right - 205, metaY, { width: 65, align: "right" });
    doc.fillColor(TEXT).font("Helvetica").text(String(value), right - 133, metaY, { width: 133, align: "right" });
    metaY += 13;
  }
  const badgeColors = { Paid: BRAND, "Partially Paid": "#a16207", Unpaid: "#64748b", Voided: "#991b1b" };
  const badgeWidth = Math.max(58, doc.widthOfString(view.status.toUpperCase()) + 18);
  doc.roundedRect(right - badgeWidth, 111, badgeWidth, 20, 3).fill(badgeColors[view.status] || BRAND);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8).text(view.status.toUpperCase(), right - badgeWidth, 117, { width: badgeWidth, align: "center" });
  doc.moveTo(left, 145).lineTo(right, 145).lineWidth(1.2).strokeColor(BRAND).stroke();
  return 163;
}

function customerBlock(doc, view, y) {
  y = sectionTitle(doc, "Customer Details", y);
  const lines = [view.customer.name || "Walk-in Customer"];
  if (view.customer.phone) lines.push(`Phone: ${view.customer.phone}`);
  if (view.customer.email) lines.push(`Email: ${view.customer.email}`);
  if (view.customer.address) lines.push(view.customer.address);
  const height = Math.max(48, 18 + lines.length * 13);
  doc.roundedRect(PAGE.margin, y, PAGE.width - PAGE.margin * 2, height, 4).fillAndStroke(SOFT, BORDER);
  lines.forEach((line, index) => {
    doc.fillColor(index === 0 ? TEXT : MUTED).font(index === 0 ? "Helvetica-Bold" : "Helvetica").fontSize(index === 0 ? 10 : 8.5)
      .text(line, PAGE.margin + 13, y + 12 + index * 13, { width: PAGE.width - PAGE.margin * 2 - 26 });
  });
  return y + height + 18;
}

const columns = [
  { key: "number", label: "No.", x: 42, width: 28, align: "center" },
  { key: "description", label: "Description", x: 70, width: 205, align: "left" },
  { key: "quantity", label: "Quantity", x: 275, width: 58, align: "right" },
  { key: "unit", label: "Unit", x: 333, width: 57, align: "center" },
  { key: "unitPrice", label: "Unit price", x: 390, width: 75, align: "right" },
  { key: "total", label: "Total", x: 465, width: 88, align: "right" }
];

function itemHeader(doc, y) {
  doc.rect(PAGE.margin, y, PAGE.width - PAGE.margin * 2, 25).fill(BRAND_DARK);
  columns.forEach((column) => doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8).text(column.label, column.x + 4, y + 9, { width: column.width - 8, align: column.align }));
  return y + 25;
}

function continuationHeader(doc, view) {
  doc.fillColor(BRAND_DARK).font("Helvetica-Bold").fontSize(12).text(view.farm.name, PAGE.margin, 42);
  doc.fillColor(MUTED).font("Helvetica").fontSize(8).text(`${view.receiptNumber} - continued`, PAGE.margin, 60);
  doc.moveTo(PAGE.margin, 75).lineTo(PAGE.width - PAGE.margin, 75).strokeColor(BORDER).stroke();
  return itemHeader(doc, 92);
}

function itemsTable(doc, view, y) {
  y = sectionTitle(doc, "Items Sold", y);
  y = itemHeader(doc, y);
  view.items.forEach((item) => {
    const rowValues = { ...item, unitPrice: money(item.unitPrice, view.currency), total: money(item.total, view.currency) };
    const descriptionHeight = doc.font("Helvetica").fontSize(8.5).heightOfString(item.description, { width: columns[1].width - 8 });
    const rowHeight = Math.max(29, descriptionHeight + 14);
    if (y + rowHeight > PAGE.footerTop - 30) {
      doc.addPage();
      y = continuationHeader(doc, view);
    }
    doc.rect(PAGE.margin, y, PAGE.width - PAGE.margin * 2, rowHeight).fillAndStroke(item.number % 2 === 0 ? SOFT : "#ffffff", BORDER);
    columns.forEach((column) => doc.fillColor(TEXT).font("Helvetica").fontSize(8.5).text(String(rowValues[column.key]), column.x + 4, y + 9, { width: column.width - 8, align: column.align }));
    y += rowHeight;
  });
  return y + 18;
}

function summaryBlock(doc, view, y) {
  const rows = [
    ["Subtotal", view.subtotal],
    ...(view.discount > 0 ? [["Discount", -view.discount]] : []),
    ...(view.additionalCharges > 0 ? [["Additional charges", view.additionalCharges]] : []),
    ...(view.tax > 0 ? [["Tax", view.tax]] : []),
    ["Sale Total", view.saleTotal, true],
    ...(view.previousPayments > 0 ? [["Previous payments", view.previousPayments]] : []),
    ["Amount received in this payment", view.amountReceived],
    ["Total paid to date", view.totalPaidToDate],
    ["Remaining balance", view.remainingBalance]
  ];
  const rowHeight = 20;
  const height = rows.length * rowHeight;
  if (y + height > PAGE.footerTop - 35) { doc.addPage(); y = 92; }
  const x = PAGE.width - PAGE.margin - 280;
  rows.forEach(([label, value, emphasis], index) => {
    const rowY = y + index * rowHeight;
    if (emphasis) doc.rect(x, rowY, 280, rowHeight).fill(BRAND_DARK);
    else doc.rect(x, rowY, 280, rowHeight).fillAndStroke(index % 2 ? "#ffffff" : SOFT, BORDER);
    doc.fillColor(emphasis ? "#ffffff" : TEXT).font(emphasis ? "Helvetica-Bold" : "Helvetica").fontSize(8.5).text(label, x + 10, rowY + 6.5, { width: 165 });
    doc.font("Helvetica-Bold").text(money(value, view.currency), x + 175, rowY + 6.5, { width: 95, align: "right" });
  });
  return y + height + 20;
}

function detailsBlock(doc, view, y) {
  const rows = [
    ["Payment method", view.payment.method],
    ...(view.payment.reference ? [["Reference", view.payment.reference]] : []),
    ["Payment date", date(view.payment.date, true)],
    ["Amount received", money(view.amountReceived, view.currency)],
    ["Received by", view.payment.receivedBy],
    ["Payment number", view.payment.paymentNumber]
  ];
  const needed = 44 + Math.ceil(rows.length / 2) * 31 + (view.notes ? 65 : 0) + (view.voidedAt ? 75 : 0);
  if (y + needed > PAGE.footerTop - 5) { doc.addPage(); y = 92; }
  y = sectionTitle(doc, "Payment Details", y);
  rows.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = PAGE.margin + column * 255;
    const rowY = y + row * 31;
    doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(7.5).text(label.toUpperCase(), x, rowY, { width: 235 });
    doc.fillColor(TEXT).font("Helvetica").fontSize(9).text(String(value), x, rowY + 12, { width: 235 });
  });
  y += Math.ceil(rows.length / 2) * 31 + 12;
  if (view.notes) {
    y = sectionTitle(doc, "Notes", y);
    const noteHeight = Math.max(35, doc.font("Helvetica").fontSize(9).heightOfString(view.notes, { width: PAGE.width - PAGE.margin * 2 - 20 }) + 18);
    doc.roundedRect(PAGE.margin, y, PAGE.width - PAGE.margin * 2, noteHeight, 4).fillAndStroke(SOFT, BORDER);
    doc.fillColor(TEXT).text(view.notes, PAGE.margin + 10, y + 10, { width: PAGE.width - PAGE.margin * 2 - 20 });
    y += noteHeight + 16;
  }
  if (view.voidedAt) {
    y = sectionTitle(doc, "Void Details", y);
    doc.roundedRect(PAGE.margin, y, PAGE.width - PAGE.margin * 2, 54, 4).fillAndStroke("#fff1f2", "#fecdd3");
    doc.fillColor("#991b1b").font("Helvetica-Bold").fontSize(9).text(`Reason: ${view.voidReason}`, PAGE.margin + 10, y + 10, { width: PAGE.width - PAGE.margin * 2 - 20 });
    doc.font("Helvetica").fontSize(8).text(`Voided ${date(view.voidedAt, true)}${view.voidedBy ? ` by ${view.voidedBy}` : ""}`, PAGE.margin + 10, y + 31);
  }
}

function decoratePages(doc, view) {
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    if (view.voidedAt) {
      doc.save().opacity(0.11).fillColor("#991b1b").font("Helvetica-Bold").fontSize(86)
        .rotate(-28, { origin: [PAGE.width / 2, PAGE.height / 2] })
        .text("VOID", 90, PAGE.height / 2 - 50, { width: PAGE.width - 180, align: "center" }).restore();
    }
    doc.moveTo(PAGE.margin, PAGE.footerTop).lineTo(PAGE.width - PAGE.margin, PAGE.footerTop).lineWidth(0.6).strokeColor(BORDER).stroke();
    doc.fillColor(TEXT).font("Helvetica-Bold").fontSize(8).text("Thank you for doing business with us.", PAGE.margin, PAGE.footerTop + 10, { width: 250 });
    doc.fillColor(MUTED).font("Helvetica").fontSize(7.5).text(`Generated securely by Smart Farm AI. Verification: ${view.verificationReference}`, PAGE.margin, PAGE.footerTop + 23, { width: 390 });
    doc.text(`Page ${index - range.start + 1} of ${range.count}`, PAGE.width - PAGE.margin - 85, PAGE.footerTop + 23, { width: 85, align: "right" });
  }
}

export function createReceiptPdf(view) {
  const doc = new PDFDocument({ size: "A4", margins: { top: PAGE.margin, right: PAGE.margin, bottom: 18, left: PAGE.margin }, bufferPages: true, info: { Title: `Receipt ${view.receiptNumber}`, Author: "Smart Farm AI", Subject: `Sale ${view.saleNumber}` } });
  let y = pageHeader(doc, view);
  y = customerBlock(doc, view, y);
  y = itemsTable(doc, view, y);
  y = summaryBlock(doc, view, y);
  detailsBlock(doc, view, y);
  decoratePages(doc, view);
  return doc;
}

export const receiptLogoPath = logoPath;
