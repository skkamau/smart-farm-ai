import express from "express";
import { forgotPassword, forgotPasswordRules, login, loginRules, profile, register, registerRules, resetPassword, resetPasswordRules } from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";
import { authLimiter, loginLimiter, passwordResetLimiter } from "../middleware/rateLimits.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();

router.post("/register", authLimiter, registerRules, validate, register);
router.post("/login", loginLimiter, loginRules, validate, login);
router.post("/forgot-password", passwordResetLimiter, forgotPasswordRules, validate, forgotPassword);
router.post("/reset-password", passwordResetLimiter, resetPasswordRules, validate, resetPassword);
router.get("/me", protect, profile);

export default router;
