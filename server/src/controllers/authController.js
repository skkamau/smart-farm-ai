import { body } from "express-validator";
import User from "../models/User.js";
import { signToken } from "../utils/tokens.js";

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  farmName: user.farmName
});

export const registerRules = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  body("farmName").optional().trim()
];

export const loginRules = [
  body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required")
];

export async function register(req, res, next) {
  try {
    const { name, email, password, farmName } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ message: "Email is already registered" });

    const user = await User.create({ name, email, password, farmName });
    res.status(201).json({ user: publicUser(user), token: signToken(user._id) });
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

    res.json({ user: publicUser(user), token: signToken(user._id) });
  } catch (error) {
    next(error);
  }
}

export async function profile(req, res) {
  res.json({ user: publicUser(req.user) });
}
