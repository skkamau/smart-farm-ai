import express from "express";
import {
  adminLogin, adminLoginRules, adminMe, downloadAdminScreenshot, exportAdminCsv, getAdminAnalytics,
  getAdminDashboard, getAdminLogs, getAdminReports, getAdminUser, getAdminUsers, reportUpdateRules,
  updateAdminReport, updateUserRole, updateUserStatus, userRoleRules, userStatusRules
} from "../controllers/adminController.js";
import { protectAdmin, requireRole } from "../middleware/auth.js";
import { adminApiLimiter, adminLoginLimiter } from "../middleware/rateLimits.js";
import { validate } from "../middleware/validate.js";
import { mongoIdParam } from "../middleware/validators.js";

const router = express.Router();

router.post("/auth/login", adminLoginLimiter, adminLoginRules, validate, adminLogin);
router.use(protectAdmin, adminApiLimiter);
router.get("/me", adminMe);
router.get("/dashboard", getAdminDashboard);
router.get("/users", getAdminUsers);
router.get("/users/:id", mongoIdParam(), validate, getAdminUser);
router.patch("/users/:id/status", mongoIdParam(), userStatusRules, validate, updateUserStatus);
router.patch("/users/:id/role", requireRole("super_admin"), mongoIdParam(), userRoleRules, validate, updateUserRole);
router.get("/reports", getAdminReports);
router.patch("/reports/:id", mongoIdParam(), reportUpdateRules, validate, updateAdminReport);
router.get("/reports/:id/screenshot", mongoIdParam(), validate, downloadAdminScreenshot);
router.get("/analytics", getAdminAnalytics);
router.get("/logs", getAdminLogs);
router.get("/exports/:type", exportAdminCsv);

export default router;
