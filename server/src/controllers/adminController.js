import fs from "node:fs";
import path from "node:path";
import { body } from "express-validator";
import BugReport from "../models/BugReport.js";
import User from "../models/User.js";
import { adminAnalyticsData, adminDashboardData, adminExportRows, adminLogsData, adminReportsData, adminUserDetail, adminUsersData } from "../services/adminService.js";
import { logActivity } from "../services/auditService.js";
import { sendCsv } from "../services/reportService.js";
import { signAdminToken } from "../utils/tokens.js";

const adminRoles = ["admin", "super_admin"];
const reportStatuses = ["New", "Reviewing", "In progress", "Resolved", "Rejected"];
const uploadRoot = path.resolve("uploads");

function safeAdmin(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role, accountStatus: user.accountStatus || "active" };
}

function storedFilePath(storedName) {
  const resolved = path.resolve(uploadRoot, storedName);
  if (!resolved.startsWith(`${uploadRoot}${path.sep}`)) throw new Error("Invalid stored file path");
  return resolved;
}

export const adminLoginRules = [
  body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required")
];

export const userStatusRules = [
  body("status").isIn(["active", "suspended"]).withMessage("Choose active or suspended"),
  body("reason").optional({ values: "falsy" }).trim().isLength({ max: 500 }).withMessage("Reason is too long")
];

export const userRoleRules = [
  body("role").isIn(["user", "admin"]).withMessage("Role must be user or admin")
];

export const reportUpdateRules = [
  body("status").isIn(reportStatuses).withMessage("Choose a valid report status"),
  body("adminNotes").optional({ values: "falsy" }).trim().isLength({ max: 2000 }).withMessage("Admin notes are too long")
];

export async function adminLogin(req, res, next) {
  try {
    const user = await User.findOne({ email: req.body.email }).select("+password");
    const knownAdmin = user && adminRoles.includes(user.role);
    const validPassword = user ? await user.matchPassword(req.body.password) : false;
    if (!knownAdmin || !validPassword) {
      if (knownAdmin) await logActivity({ actorUser: user._id, actorRole: user.role, action: "admin_login_failed", outcome: "failure", targetUser: user._id, metadata: { reason: "invalid_credentials" } });
      return res.status(401).json({ message: "Invalid admin credentials" });
    }
    if (user.accountStatus === "suspended") {
      await logActivity({ actorUser: user._id, actorRole: user.role, action: "admin_login_failed", outcome: "failure", targetUser: user._id, metadata: { reason: "account_suspended" } });
      return res.status(403).json({ message: "Account suspended" });
    }
    user.lastLoginAt = new Date();
    user.lastActiveAt = user.lastLoginAt;
    await user.save();
    await logActivity({ actorUser: user._id, actorRole: user.role, action: "admin_login_success", targetUser: user._id });
    res.json({ admin: safeAdmin(user), token: signAdminToken(user._id, user.sessionVersion) });
  } catch (error) {
    next(error);
  }
}

export function adminMe(req, res) {
  res.json({ admin: safeAdmin(req.admin) });
}

export async function getAdminDashboard(req, res, next) {
  try { res.json(await adminDashboardData()); } catch (error) { next(error); }
}

export async function getAdminUsers(req, res, next) {
  try { res.json(await adminUsersData(req.query)); } catch (error) { next(error); }
}

export async function getAdminUser(req, res, next) {
  try {
    const user = await adminUserDetail(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) { next(error); }
}

export async function updateUserStatus(req, res, next) {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: "User not found" });
    if (String(target._id) === String(req.admin._id)) return res.status(400).json({ message: "You cannot suspend or reactivate your own admin account" });
    if (target.role === "super_admin") return res.status(403).json({ message: "Super-admin accounts cannot be managed here" });
    if (req.admin.role === "admin" && target.role !== "user") return res.status(403).json({ message: "Only a super-admin can manage admin accounts" });

    const status = req.body.status;
    target.accountStatus = status;
    target.suspendedAt = status === "suspended" ? new Date() : null;
    target.suspendedBy = status === "suspended" ? req.admin._id : null;
    target.suspensionReason = status === "suspended" ? String(req.body.reason || "").trim() : "";
    target.sessionVersion = Number(target.sessionVersion || 0) + 1;
    await target.save();
    await logActivity({ actorUser: req.admin._id, actorRole: req.admin.role, action: status === "suspended" ? "user_suspended" : "user_reactivated", targetUser: target._id, targetType: "user", targetId: target._id, metadata: status === "suspended" ? { reason: target.suspensionReason } : {} });
    res.json({ message: status === "suspended" ? "User suspended" : "User reactivated", user: safeAdmin(target) });
  } catch (error) { next(error); }
}

export async function updateUserRole(req, res, next) {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: "User not found" });
    if (String(target._id) === String(req.admin._id)) return res.status(400).json({ message: "You cannot change your own role" });
    if (target.role === "super_admin") return res.status(403).json({ message: "Super-admin roles are managed only by the bootstrap process" });
    const previousRole = target.role || "user";
    target.role = req.body.role;
    target.sessionVersion = Number(target.sessionVersion || 0) + 1;
    await target.save();
    await logActivity({ actorUser: req.admin._id, actorRole: req.admin.role, action: "user_role_changed", targetUser: target._id, targetType: "user", targetId: target._id, metadata: { previousRole, newRole: target.role } });
    res.json({ message: "User role updated", user: safeAdmin(target) });
  } catch (error) { next(error); }
}

export async function getAdminReports(req, res, next) {
  try { res.json(await adminReportsData(req.query)); } catch (error) { next(error); }
}

export async function updateAdminReport(req, res, next) {
  try {
    const report = await BugReport.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });
    const previousStatus = report.status;
    report.status = req.body.status;
    report.adminNotes = String(req.body.adminNotes || "").trim();
    report.resolvedAt = report.status === "Resolved" ? new Date() : null;
    report.lastUpdatedBy = req.admin._id;
    await report.save();
    await logActivity({ actorUser: req.admin._id, actorRole: req.admin.role, action: "report_status_changed", targetUser: report.user, targetType: "bug_report", targetId: report._id, metadata: { previousStatus, newStatus: report.status } });
    res.json(await report.populate("user", "name email farmName"));
  } catch (error) { next(error); }
}

export async function downloadAdminScreenshot(req, res, next) {
  try {
    const report = await BugReport.findById(req.params.id);
    if (!report?.screenshot?.storedName) return res.status(404).json({ message: "Screenshot not found" });
    const filePath = storedFilePath(report.screenshot.storedName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "Screenshot file is no longer available" });
    res.download(filePath, report.screenshot.originalName || "report-screenshot");
  } catch (error) { next(error); }
}

export async function getAdminAnalytics(req, res, next) {
  try { res.json(await adminAnalyticsData()); } catch (error) { next(error); }
}

export async function getAdminLogs(req, res, next) {
  try { res.json(await adminLogsData(req.query)); } catch (error) { next(error); }
}

export async function exportAdminCsv(req, res, next) {
  try {
    const rows = await adminExportRows(req.params.type);
    if (!rows) return res.status(400).json({ message: "Unsupported admin export" });
    sendCsv(res, `smart-farm-admin-${req.params.type}-${new Date().toISOString().slice(0, 10)}`, rows);
  } catch (error) { next(error); }
}
