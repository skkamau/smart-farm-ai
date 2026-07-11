import UsageEvent, { usageFeatures } from "../models/UsageEvent.js";

const allowedFeatures = new Set(usageFeatures);

export async function recordUsage(req, res, next) {
  try {
    const feature = String(req.body.feature || "").trim();
    if (!allowedFeatures.has(feature)) return res.status(400).json({ message: "Invalid feature" });
    const now = new Date();
    const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    await UsageEvent.create({ user: req.user._id, feature, day });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
