import dotenv from "dotenv";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";

dotenv.config();

const email = String(process.env.SUPER_ADMIN_EMAIL || "").trim().toLowerCase();
if (!email) {
  console.error("Set SUPER_ADMIN_EMAIL to the email of an existing registered account.");
  process.exit(1);
}

try {
  await connectDB();
  const existingSuperAdmin = await User.findOne({ role: "super_admin" });
  if (existingSuperAdmin && existingSuperAdmin.email !== email) {
    console.error("A super-admin already exists. Use the admin console for normal admin role management.");
    process.exitCode = 1;
  } else {
    const user = await User.findOne({ email });
    if (!user) {
      console.error("No registered account matches SUPER_ADMIN_EMAIL.");
      process.exitCode = 1;
    } else {
      user.role = "super_admin";
      user.accountStatus = "active";
      user.suspendedAt = null;
      user.suspendedBy = null;
      user.suspensionReason = "";
      user.sessionVersion = Number(user.sessionVersion || 0) + 1;
      await user.save();
      console.log(`Super-admin access granted to ${user.email}. Existing sessions were revoked.`);
    }
  }
} finally {
  const mongoose = await import("mongoose");
  await mongoose.default.disconnect();
}
