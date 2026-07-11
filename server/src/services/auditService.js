import AdminActivityLog from "../models/AdminActivityLog.js";

const sensitiveKeys = /password|token|secret|apiKey|authorization|cookie/i;

function safeValue(value, depth = 0) {
  if (depth > 3 || value === null || value === undefined) return null;
  if (["number", "boolean"].includes(typeof value)) return value;
  if (typeof value === "string") return value.slice(0, 500);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => safeValue(item, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !sensitiveKeys.test(key))
        .slice(0, 20)
        .map(([key, item]) => [key, safeValue(item, depth + 1)])
    );
  }
  return String(value).slice(0, 500);
}

export function sanitizeAuditMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return safeValue(value) || {};
}

export async function logActivity({ actorUser = null, actorRole = "system", action, outcome = "success", targetUser = null, targetType = "", targetId = "", metadata = {} }) {
  try {
    await AdminActivityLog.create({
      actorUser,
      actorRole: ["user", "admin", "super_admin", "system"].includes(actorRole) ? actorRole : "system",
      action,
      outcome,
      targetUser,
      targetType: String(targetType || "").slice(0, 80),
      targetId: String(targetId || "").slice(0, 120),
      metadata: sanitizeAuditMetadata(metadata)
    });
  } catch (error) {
    console.warn("[audit] Activity log write failed", { action, error: error.message });
  }
}
