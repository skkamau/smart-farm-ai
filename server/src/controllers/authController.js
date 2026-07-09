import { body } from "express-validator";
import User from "../models/User.js";
import { sendPasswordChangedEmail, sendPasswordResetEmail } from "../services/mailService.js";
import { createResetToken, genericResetMessage, hashResetToken, isStrongPassword, resetCooldownMs, resetLinkFor, resetTokenTtlMs } from "../utils/passwordReset.js";
import { signToken } from "../utils/tokens.js";

const resetAttemptWindowMs = 15 * 60 * 1000;
const resetAttemptLimit = 5;
const resetAttempts = new Map();

function clientIp(req) {
  return req.ip || req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown";
}

function attemptKey(kind, value) {
  return `${kind}:${String(value || "").toLowerCase()}`;
}

function tooManyAttempts(key) {
  const now = Date.now();
  const entry = resetAttempts.get(key);
  if (!entry || entry.expiresAt <= now) {
    resetAttempts.set(key, { count: 1, expiresAt: now + resetAttemptWindowMs, lastAt: now });
    return false;
  }
  entry.count += 1;
  entry.lastAt = now;
  return entry.count > resetAttemptLimit;
}

function tooSoon(key) {
  const entry = resetAttempts.get(key);
  return entry && Date.now() - entry.lastAt < resetCooldownMs && entry.count > 1;
}

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  farmName: user.farmName,
  farmLocation: user.farmLocation || "",
  farmType: user.farmType || "mixed",
  mainActivities: user.mainActivities || "",
  phone: user.phone || "",
  preferences: {
    theme: user.preferences?.theme || "system",
    currency: user.preferences?.currency || "KES",
    units: user.preferences?.units || "metric",
    notifications: {
      inventoryAlerts: user.preferences?.notifications?.inventoryAlerts ?? true,
      animalHealthReminders: user.preferences?.notifications?.animalHealthReminders ?? true,
      cropReminders: user.preferences?.notifications?.cropReminders ?? true
    }
  }
});

export const registerRules = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
  body("password")
    .custom((value) => isStrongPassword(value))
    .withMessage("Password must be at least 8 characters and include uppercase, lowercase, number, and symbol"),
  body("farmName").optional().trim()
];

export const loginRules = [
  body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required")
];

export const forgotPasswordRules = [
  body("email").isEmail().normalizeEmail().withMessage("Valid email is required")
];

export const resetPasswordRules = [
  body("token").trim().notEmpty().withMessage("Reset token is required"),
  body("password")
    .custom((value) => isStrongPassword(value))
    .withMessage("Password must be at least 8 characters and include uppercase, lowercase, number, and symbol"),
  body("confirmPassword").custom((value, { req }) => value === req.body.password).withMessage("Passwords must match")
];

export const profileUpdateRules = [
  body("name").trim().notEmpty().withMessage("Owner name is required").isLength({ max: 120 }).withMessage("Owner name is too long"),
  body("farmName").trim().notEmpty().withMessage("Farm name is required").isLength({ max: 120 }).withMessage("Farm name is too long"),
  body("farmLocation").optional({ values: "falsy" }).trim().isLength({ max: 160 }).withMessage("Farm location is too long"),
  body("farmType").optional({ values: "falsy" }).isIn(["crops", "livestock", "mixed", "other"]).withMessage("Choose a valid farm type"),
  body("mainActivities").optional({ values: "falsy" }).trim().isLength({ max: 300 }).withMessage("Main animals/crops is too long"),
  body("phone").optional({ values: "falsy" }).trim().isLength({ max: 40 }).withMessage("Phone number is too long"),
  body("email").optional({ values: "falsy" }).isEmail().normalizeEmail().withMessage("Valid email is required"),
  body("preferences.theme").optional({ values: "falsy" }).isIn(["light", "dark", "system"]).withMessage("Choose a valid theme"),
  body("preferences.currency").optional({ values: "falsy" }).trim().isLength({ min: 2, max: 8 }).withMessage("Currency should be 2 to 8 characters"),
  body("preferences.units").optional({ values: "falsy" }).isIn(["metric", "imperial", "mixed"]).withMessage("Choose valid units"),
  body("preferences.notifications.inventoryAlerts").optional().isBoolean().toBoolean(),
  body("preferences.notifications.animalHealthReminders").optional().isBoolean().toBoolean(),
  body("preferences.notifications.cropReminders").optional().isBoolean().toBoolean()
];

export async function register(req, res, next) {
  try {
    const { name, email, password, farmName } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ message: "Email is already registered" });

    const user = await User.create({ name, email, password, farmName });
    res.status(201).json({ user: publicUser(user), token: signToken(user._id, user.sessionVersion) });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json({ user: publicUser(user), token: signToken(user._id, user.sessionVersion) });
  } catch (error) {
    next(error);
  }
}

export async function forgotPassword(req, res, next) {
  const email = req.body.email;
  const ip = clientIp(req);
  const ipKey = attemptKey("ip", ip);
  const emailKey = attemptKey("email", email);

  try {
    if (tooManyAttempts(ipKey) || tooManyAttempts(emailKey) || tooSoon(ipKey) || tooSoon(emailKey)) {
      console.warn("[auth] Password reset rate limited", { ip });
      return res.status(429).json({ message: "Too many reset attempts. Please wait and try again." });
    }

    const user = await User.findOne({ email }).select("+passwordResetRequestedAt +passwordResetTokenHash +passwordResetExpiresAt");
    if (!user) {
      console.info("[auth] Password reset requested for non-existing account", { ip });
      return res.json({ message: genericResetMessage });
    }

    if (user.passwordResetRequestedAt && Date.now() - user.passwordResetRequestedAt.getTime() < resetCooldownMs) {
      console.warn("[auth] Password reset email cooldown active", { userId: user._id, ip });
      return res.json({ message: genericResetMessage });
    }

    const { token, tokenHash } = createResetToken();
    user.passwordResetTokenHash = tokenHash;
    user.passwordResetExpiresAt = new Date(Date.now() + resetTokenTtlMs);
    user.passwordResetRequestedAt = new Date();
    await user.save();

    await sendPasswordResetEmail({ to: user.email, resetLink: resetLinkFor(token) }).catch(() => {
      console.warn("[auth] Password reset email failed", { userId: user._id, ip });
    });
    console.info("[auth] Password reset requested", { userId: user._id, ip });
    res.json({ message: genericResetMessage });
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const tokenHash = hashResetToken(req.body.token);
    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() }
    }).select("+password +passwordResetTokenHash +passwordResetExpiresAt");

    if (!user) {
      return res.status(400).json({ message: "This password reset link is invalid or has expired." });
    }

    if (await user.matchPassword(req.body.password)) {
      return res.status(400).json({ message: "Choose a new password that is different from your current password." });
    }

    user.password = req.body.password;
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
    user.passwordResetRequestedAt = undefined;
    user.passwordChangedAt = new Date();
    user.sessionVersion = Number(user.sessionVersion || 0) + 1;
    await user.save();

    sendPasswordChangedEmail({ to: user.email }).catch(() => {
      console.warn("[auth] Password changed email failed", { userId: user._id });
    });
    console.info("[auth] Password reset completed", { userId: user._id });
    res.json({ message: "Password reset successful. Please log in with your new password." });
  } catch (error) {
    next(error);
  }
}

export async function profile(req, res) {
  res.json({ user: publicUser(req.user) });
}

export async function updateProfile(req, res, next) {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "Profile not found" });

    if (req.body.email && req.body.email !== user.email) {
      const exists = await User.exists({ email: req.body.email, _id: { $ne: user._id } });
      if (exists) return res.status(409).json({ message: "Email is already registered" });
      user.email = req.body.email;
    }

    user.name = req.body.name;
    user.farmName = req.body.farmName;
    user.farmLocation = req.body.farmLocation || "";
    user.farmType = req.body.farmType || "mixed";
    user.mainActivities = req.body.mainActivities || "";
    user.phone = req.body.phone || "";
    user.preferences = {
      theme: req.body.preferences?.theme || user.preferences?.theme || "system",
      currency: req.body.preferences?.currency || user.preferences?.currency || "KES",
      units: req.body.preferences?.units || user.preferences?.units || "metric",
      notifications: {
        inventoryAlerts: req.body.preferences?.notifications?.inventoryAlerts ?? user.preferences?.notifications?.inventoryAlerts ?? true,
        animalHealthReminders: req.body.preferences?.notifications?.animalHealthReminders ?? user.preferences?.notifications?.animalHealthReminders ?? true,
        cropReminders: req.body.preferences?.notifications?.cropReminders ?? user.preferences?.notifications?.cropReminders ?? true
      }
    };

    await user.save();
    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
}
