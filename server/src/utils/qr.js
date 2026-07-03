import { randomUUID } from "node:crypto";

export function buildQrValue(qrCodeId) {
  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
  return `${clientUrl.replace(/\/$/, "")}/scan/${qrCodeId}`;
}

export async function ensureAnimalQr(animal) {
  if (!animal.qrCodeId) {
    animal.qrCodeId = `QR-${randomUUID()}`;
  }

  const currentValue = buildQrValue(animal.qrCodeId);
  if (animal.qrCodeValue !== currentValue) {
    animal.qrCodeValue = currentValue;
  }

  if (animal.isModified?.("qrCodeId") || animal.isModified?.("qrCodeValue")) {
    await animal.save();
  }

  return animal;
}

export function extractQrCodeId(rawValue = "") {
  const value = String(rawValue).trim();
  if (!value) return "";

  const scanMatch = value.match(/\/scan\/([^/?#]+)/i);
  if (scanMatch?.[1]) return decodeURIComponent(scanMatch[1]);

  return value;
}
