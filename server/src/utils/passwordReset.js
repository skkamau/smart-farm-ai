import crypto from "node:crypto";

export const resetTokenTtlMs = 30 * 60 * 1000;
export const resetCooldownMs = 60 * 1000;
export const genericResetMessage = "If an account exists with this email, a password reset link has been sent.";

export function createResetToken() {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, tokenHash: hashResetToken(token) };
}

export function hashResetToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

export function isStrongPassword(password) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password);
}

export function resetLinkFor(token) {
  const appUrl = (process.env.APP_URL || process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");
  return `${appUrl}/reset-password/${encodeURIComponent(token)}`;
}
