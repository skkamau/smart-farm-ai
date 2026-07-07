import jwt from "jsonwebtoken";

export function signToken(userId, sessionVersion = 0) {
  return jwt.sign({ userId, sessionVersion }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d"
  });
}
