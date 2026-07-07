import express from "express";
import { forgotPassword, forgotPasswordRules, login, loginRules, profile, register, registerRules, resetPassword, resetPasswordRules } from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();

router.post("/register", registerRules, validate, register);
router.post("/login", loginRules, validate, login);
router.post("/forgot-password", forgotPasswordRules, validate, forgotPassword);
router.post("/reset-password", resetPasswordRules, validate, resetPassword);
router.get("/me", protect, profile);

export default router;
