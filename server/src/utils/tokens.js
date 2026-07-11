import jwt from "jsonwebtoken";

export function signToken(userId, sessionVersion = 0) {
  return jwt.sign({ userId, sessionVersion, purpose: "app" }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d"
  });
}

export function signAdminToken(userId, sessionVersion = 0) {
  return jwt.sign({ userId, sessionVersion, purpose: "admin" }, process.env.JWT_SECRET, {
    expiresIn: process.env.ADMIN_JWT_EXPIRES_IN || "2h",
    audience: "smart-farm-admin",
    issuer: "smart-farm-api"
  });
}
