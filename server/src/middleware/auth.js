import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function protect(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.purpose === "admin") {
      return res.status(401).json({ message: "Use an app session for this route" });
    }
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(401).json({ message: "User no longer exists" });
    }

    if (user.accountStatus === "suspended") {
      return res.status(403).json({ message: "Account suspended. Contact support for assistance." });
    }

    const tokenSessionVersion = Number(decoded.sessionVersion ?? 0);
    if (tokenSessionVersion !== Number(user.sessionVersion || 0)) {
      return res.status(401).json({ message: "Session expired. Please log in again." });
    }

    const activityCutoff = Date.now() - 15 * 60 * 1000;
    if (!user.lastActiveAt || user.lastActiveAt.getTime() < activityCutoff) {
      user.lastActiveAt = new Date();
      await User.updateOne({ _id: user._id }, { $set: { lastActiveAt: user.lastActiveAt } });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export async function protectAdmin(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Admin authentication required" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      audience: "smart-farm-admin",
      issuer: "smart-farm-api"
    });
    if (decoded.purpose !== "admin") return res.status(401).json({ message: "Invalid admin session" });

    const user = await User.findById(decoded.userId).select("-password");
    if (!user || !["admin", "super_admin"].includes(user.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }
    if (user.accountStatus === "suspended") {
      return res.status(403).json({ message: "Account suspended" });
    }
    if (Number(decoded.sessionVersion ?? 0) !== Number(user.sessionVersion || 0)) {
      return res.status(401).json({ message: "Admin session expired. Please log in again." });
    }

    req.user = user;
    req.admin = user;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired admin session" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => roles.includes(req.admin?.role)
    ? next()
    : res.status(403).json({ message: "Insufficient admin permissions" });
}
