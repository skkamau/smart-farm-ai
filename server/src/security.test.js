import assert from "node:assert/strict";
import { validationResult } from "express-validator";
import jwt from "jsonwebtoken";
import { allowedOrigins, isLocalNetworkOrigin, validateEnv } from "./config/env.js";
import { publicUser } from "./controllers/authController.js";
import { createResetToken, hashResetToken, isStrongPassword } from "./utils/passwordReset.js";
import { buildHealthPayload, healthRules, normalizeHealthMedications } from "./controllers/healthController.js";
import User from "./models/User.js";
import { requireRole } from "./middleware/auth.js";
import { signAdminToken, signToken } from "./utils/tokens.js";
import { sanitizeAuditMetadata } from "./services/auditService.js";

async function healthValidationErrors(body) {
  const request = { body };
  await Promise.all(healthRules.map((rule) => rule.run(request)));
  return validationResult(request).array();
}

const originalEnv = { ...process.env };

try {
  assert.equal(isStrongPassword("weakpass"), false, "weak passwords must be rejected");
  assert.equal(isStrongPassword("StrongPass1!"), true, "strong passwords must be accepted");

  const reset = createResetToken();
  assert.equal(reset.token.length, 64, "raw reset token should be 32 random bytes encoded as hex");
  assert.equal(reset.tokenHash, hashResetToken(reset.token), "stored reset hash should match raw token hash");
  assert.notEqual(reset.token, reset.tokenHash, "raw reset tokens must not be stored directly");

  const healthPayload = buildHealthPayload({
    serviceCharge: 500,
    transportCost: 100,
    otherCost: 50,
    medications: [
      { medicationName: "Medicine A", dosage: "5 ml", medicineCharge: 200 },
      { medicationName: "Medicine B", dosage: "1 tablet", medicineCharge: 150 }
    ]
  });
  assert.equal(healthPayload.medicineCost, 350, "medicine cost should include every medication entry");
  assert.equal(healthPayload.totalCost, 1000, "health total should include service, medicine, transport, and other costs");
  assert.deepEqual(
    normalizeHealthMedications({ medication: "Legacy medicine", dosage: "2 ml", medicineCost: 75 }),
    [{ medicationName: "Legacy medicine", dosage: "2 ml", medicineCharge: 75 }],
    "legacy medication fields should map to the medication array"
  );
  const validHealthErrors = await healthValidationErrors({
    animal: "507f1f77bcf86cd799439011",
    condition: "Respiratory infection",
    diagnosis: "Bacterial infection",
    medications: [{ medicationName: "Medicine A", dosage: "5 ml", medicineCharge: 100 }],
    serviceCharge: 200,
    followUpDate: "2026-07-20"
  });
  assert.equal(validHealthErrors.length, 0, "a valid health record should pass server validation");
  const invalidHealthErrors = await healthValidationErrors({
    animal: "507f1f77bcf86cd799439011",
    condition: "Respiratory infection",
    diagnosis: "",
    medications: [{ medicationName: "", dosage: "", medicineCharge: -1 }],
    serviceCharge: "not-a-number",
    followUpDate: "not-a-date"
  });
  assert.equal(invalidHealthErrors.some((error) => error.path === "diagnosis"), true, "diagnosis must be required");
  assert.equal(invalidHealthErrors.some((error) => error.path === "medications[0].medicineCharge"), true, "medicine charges must be non-negative numbers");
  assert.equal(invalidHealthErrors.some((error) => error.path === "serviceCharge"), true, "service charges must be numeric");
  assert.equal(invalidHealthErrors.some((error) => error.path === "followUpDate"), true, "follow-up dates must be valid");

  process.env.NODE_ENV = "production";
  process.env.MONGODB_URI = "mongodb://example.invalid/smart-farm-ai";
  process.env.JWT_SECRET = "short";
  assert.throws(() => validateEnv(), /JWT_SECRET/, "short production JWT secrets must be rejected");

  process.env.JWT_SECRET = "a".repeat(32);
  const appToken = signToken("507f1f77bcf86cd799439011", 3);
  const appClaims = jwt.verify(appToken, process.env.JWT_SECRET);
  assert.equal(appClaims.purpose, "app", "normal sessions must be marked as app sessions");
  const adminToken = signAdminToken("507f1f77bcf86cd799439011", 4);
  const adminClaims = jwt.verify(adminToken, process.env.JWT_SECRET, { audience: "smart-farm-admin", issuer: "smart-farm-api" });
  assert.equal(adminClaims.purpose, "admin", "admin sessions must use a distinct purpose");
  assert.throws(() => jwt.verify(appToken, process.env.JWT_SECRET, { audience: "smart-farm-admin" }), "normal app tokens must not satisfy the admin audience");

  assert.equal(User.schema.path("password").options.select, false, "password hashes must be excluded from queries by default");
  assert.deepEqual(User.schema.path("role").enumValues, ["user", "admin", "super_admin"], "user roles must be constrained by the schema");
  assert.deepEqual(User.schema.path("accountStatus").enumValues, ["active", "suspended"], "account status must be constrained by the schema");
  const exposedUser = publicUser({ _id: "user-id", name: "Owner", email: "owner@example.test", password: "hash", role: "user", accountStatus: "active", farmName: "Farm" });
  assert.equal(Object.hasOwn(exposedUser, "password"), false, "public user responses must not expose password hashes");
  assert.equal(exposedUser.role, "user", "public user responses should expose only the safe role value");

  let roleNextCalled = false;
  requireRole("super_admin")({ admin: { role: "super_admin" } }, {}, () => { roleNextCalled = true; });
  assert.equal(roleNextCalled, true, "super-admin role guard should allow super-admins");
  let deniedStatus = 0;
  requireRole("super_admin")({ admin: { role: "admin" } }, { status(code) { deniedStatus = code; return this; }, json() {} }, () => {});
  assert.equal(deniedStatus, 403, "admin role guard must deny ordinary admins");
  const redactedAuditData = sanitizeAuditMetadata({ reason: "test", nested: { token: "secret-token", detail: "safe" }, passwordHash: "secret-hash" });
  assert.deepEqual(redactedAuditData, { reason: "test", nested: { detail: "safe" } }, "audit metadata must redact sensitive keys recursively");

  process.env.CLIENT_URL = "https://smart-farm-ai-two.vercel.app";
  process.env.ALLOWED_ORIGINS = "";
  assert.doesNotThrow(() => validateEnv(), "valid production env should pass");
  assert.equal(allowedOrigins().has("https://smart-farm-ai-two.vercel.app"), true, "production client URL should be allowed");
  assert.equal(allowedOrigins().has("https://smart-farm-ai-evil.vercel.app"), false, "arbitrary Vercel apps must not be allowed by CORS");
  assert.equal(isLocalNetworkOrigin("http://192.168.1.10:5174"), false, "local network origins must be disabled in production");

  process.env.NODE_ENV = "development";
  assert.equal(isLocalNetworkOrigin("http://192.168.1.10:5174"), true, "local network origins are allowed only in development");

  console.log("Security tests passed");
} finally {
  process.env = originalEnv;
}
