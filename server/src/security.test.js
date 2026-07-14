import assert from "node:assert/strict";
import { validationResult } from "express-validator";
import jwt from "jsonwebtoken";
import { allowedOrigins, isLocalNetworkOrigin, validateEnv } from "./config/env.js";
import { publicUser } from "./controllers/authController.js";
import { createResetToken, genericResetMessage, hashResetToken, isStrongPassword } from "./utils/passwordReset.js";
import { buildHealthPayload, conditionToAnimalHealth, healthRules, normalizeHealthMedications } from "./controllers/healthController.js";
import User from "./models/User.js";
import Animal from "./models/Animal.js";
import HealthRecord from "./models/HealthRecord.js";
import { animalRules } from "./controllers/animalController.js";
import { legacyStatusMapping } from "./services/animalStatusMigration.js";
import { unknownGenderFilter } from "./services/animalGenderMigration.js";
import { migrateLegacyConditionValue } from "./services/healthConditionMigration.js";
import { requireRole } from "./middleware/auth.js";
import { signAdminToken, signToken } from "./utils/tokens.js";
import { sanitizeAuditMetadata } from "./services/auditService.js";
import { defaultSupportEmail, smtpConfigured } from "./services/mailService.js";
import BugReport from "./models/BugReport.js";
import AnimalGroup, { calculateBiomass } from "./models/AnimalGroup.js";
import GroupQuantityEvent from "./models/GroupQuantityEvent.js";
import { nextGroupQuantity } from "./services/groupQuantityService.js";

async function healthValidationErrors(body) {
  const request = { body };
  await Promise.all(healthRules.map((rule) => rule.run(request)));
  return validationResult(request).array();
}

async function animalValidationErrors(body) {
  const request = { body };
  await Promise.all(animalRules.map((rule) => rule.run(request)));
  return validationResult(request).array();
}

const originalEnv = { ...process.env };

try {
  let flockQuantity = 500;
  flockQuantity = nextGroupQuantity(flockQuantity, "death", 10);
  flockQuantity = nextGroupQuantity(flockQuantity, "sold", 100);
  assert.equal(flockQuantity, 390, "group quantity must reflect mortality and sales");
  assert.throws(() => nextGroupQuantity(5, "death", 6), /negative/, "group quantity must never become negative");
  assert.equal(nextGroupQuantity(390, "stock_correction", 400), 400, "stock correction must set the confirmed balance");
  assert.equal(calculateBiomass(4000, 250, "g"), 1000, "fish biomass must convert sampled grams to kilograms");
  assert.equal(AnimalGroup.schema.indexes().some(([fields, options]) => fields.user === 1 && fields.groupId === 1 && options.unique), true, "group IDs must be unique per owner");
  assert.equal(GroupQuantityEvent.schema.indexes().some(([fields, options]) => fields.idempotencyKey === 1 && options.unique), true, "quantity events must reject duplicate idempotency keys");
  assert.equal(isStrongPassword("weakpass"), false, "weak passwords must be rejected");
  assert.equal(isStrongPassword("StrongPass1!"), true, "strong passwords must be accepted");

  const reset = createResetToken();
  assert.equal(reset.token.length, 64, "raw reset token should be 32 random bytes encoded as hex");
  assert.equal(reset.tokenHash, hashResetToken(reset.token), "stored reset hash should match raw token hash");
  assert.notEqual(reset.token, reset.tokenHash, "raw reset tokens must not be stored directly");
  assert.equal(genericResetMessage, "If an account exists for this email, a password reset link has been sent.", "reset requests must use the non-enumerating response");
  assert.equal(defaultSupportEmail, "smartfarm005ai@gmail.com", "official support email must be consistent");
  assert.equal(smtpConfigured({ SMTP_HOST: "smtp.gmail.com", SMTP_USER: "support@example.test", SMTP_PASSWORD: "app-password" }), true, "SMTP_PASSWORD configuration must be supported");
  assert.equal(smtpConfigured({ SMTP_HOST: "smtp.gmail.com", SMTP_USER: "support@example.test" }), false, "partial SMTP configuration must not send mail");
  assert.equal(BugReport.schema.path("reportType").enumValues.includes("Payment issue"), true, "support reports must include payment issues");

  process.env.NODE_ENV = "development";
  process.env.MONGODB_URI = "mongodb://example.invalid/smart-farm-ai";
  process.env.JWT_SECRET = "a".repeat(32);
  process.env.SMTP_HOST = "smtp.gmail.com";
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASSWORD;
  delete process.env.SMTP_PASS;
  assert.throws(() => validateEnv(), /configured together/, "partial SMTP configuration must fail fast");
  delete process.env.SMTP_HOST;

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
    healthCondition: "moderate",
    diagnosis: "Bacterial infection",
    medications: [{ medicationName: "Medicine A", dosage: "5 ml", medicineCharge: 100 }],
    serviceCharge: 200,
    followUpDate: "2026-07-20"
  });
  assert.equal(validHealthErrors.length, 0, "a valid health record should pass server validation");
  const invalidHealthErrors = await healthValidationErrors({
    animal: "507f1f77bcf86cd799439011",
    healthCondition: "invalid",
    diagnosis: "",
    medications: [{ medicationName: "", dosage: "", medicineCharge: -1 }],
    serviceCharge: "not-a-number",
    followUpDate: "not-a-date"
  });
  assert.equal(invalidHealthErrors.some((error) => error.path === "healthCondition"), true, "health condition must use the supported shared status mapping");
  assert.equal(invalidHealthErrors.some((error) => error.path === "diagnosis"), true, "diagnosis must be required");
  assert.equal(invalidHealthErrors.some((error) => error.path === "medications[0].medicineCharge"), true, "medicine charges must be non-negative numbers");
  assert.equal(invalidHealthErrors.some((error) => error.path === "serviceCharge"), true, "service charges must be numeric");
  assert.equal(invalidHealthErrors.some((error) => error.path === "followUpDate"), true, "follow-up dates must be valid");

  assert.equal(Animal.schema.path("status").enumValues.includes("Deceased"), true, "animal status must support Deceased");
  assert.deepEqual(Animal.schema.path("lifecycleStatus").enumValues, ["active", "sold", "transferred", "archived", "deceased"], "lifecycle statuses must be constrained");
  assert.deepEqual(Animal.schema.path("healthStatus").enumValues, ["healthy", "sick", "recovering", "chronic", "referred", "unknown"], "health statuses must be constrained");
  assert.deepEqual(Animal.schema.path("reproductiveStatus").enumValues, ["not_pregnant", "pregnant", "postpartum", "nursing", "unknown"], "reproductive statuses must be constrained");
  assert.equal(Animal.schema.path("gender").defaultValue, "Female", "new animals should default to Female");
  assert.equal(unknownGenderFilter.$or.length, 4, "gender migration must include unknown, blank, null, and missing values");
  assert.equal(HealthRecord.schema.path("recoveryStatus"), undefined, "health records must not store duplicate recovery status");
  assert.deepEqual(HealthRecord.schema.path("healthCondition").enumValues, ["healthy", "mild", "moderate", "serious", "critical", "recovering", "chronic", "stable", "unknown"], "health conditions must be constrained");
  assert.deepEqual(conditionToAnimalHealth, { healthy: "healthy", mild: "sick", moderate: "sick", serious: "sick", critical: "sick", recovering: "recovering", chronic: "chronic", stable: "healthy", unknown: "unknown" }, "health conditions must map consistently to animal health status");
  assert.deepEqual(migrateLegacyConditionValue("Healthy"), { healthCondition: "healthy", diagnosis: "" }, "legacy health labels should become health conditions");
  assert.deepEqual(migrateLegacyConditionValue("Sick"), { healthCondition: "moderate", diagnosis: "" }, "legacy Sick records should map to a condition severity");
  assert.deepEqual(migrateLegacyConditionValue("Mastitis"), { healthCondition: "unknown", diagnosis: "Mastitis" }, "legacy disease names should move into diagnosis");
  assert.deepEqual(migrateLegacyConditionValue("Foot Rot", "Confirmed infection"), { healthCondition: "unknown", diagnosis: "Confirmed infection" }, "migration must not overwrite an existing diagnosis");
  assert.deepEqual(legacyStatusMapping("Healthy"), { lifecycleStatus: "active", healthStatus: "healthy", reproductiveStatus: "unknown" });
  assert.deepEqual(legacyStatusMapping("Sick"), { lifecycleStatus: "active", healthStatus: "sick", reproductiveStatus: "unknown" });
  assert.deepEqual(legacyStatusMapping("Pregnant"), { lifecycleStatus: "active", healthStatus: "unknown", reproductiveStatus: "pregnant" });
  assert.deepEqual(legacyStatusMapping("Deceased"), { lifecycleStatus: "deceased", healthStatus: "unknown", reproductiveStatus: "unknown" });
  const missingDeathDate = await animalValidationErrors({ animalId: "G-001", species: "Goat", status: "Deceased" });
  assert.equal(missingDeathDate.some((error) => error.path === "dateOfDeath"), true, "deceased animals must require a date of death");
  const invalidDeathStatus = await animalValidationErrors({ animalId: "G-001", species: "Goat", status: "Dead" });
  assert.equal(invalidDeathStatus.some((error) => error.path === "status"), true, "invalid animal statuses must be rejected");
  const invalidDeathCause = await animalValidationErrors({ animalId: "G-001", species: "Goat", status: "Deceased", dateOfDeath: "2026-07-12", causeOfDeath: "Unlisted" });
  assert.equal(invalidDeathCause.some((error) => error.path === "causeOfDeath"), true, "invalid death causes must be rejected");
  const validFemaleGender = await animalValidationErrors({ animalId: "G-003", species: "Goat", gender: "Female" });
  assert.equal(validFemaleGender.some((error) => error.path === "gender"), false, "Female must remain a valid animal gender");
  const invalidUnknownGender = await animalValidationErrors({ animalId: "G-004", species: "Goat", gender: "Unknown" });
  assert.equal(invalidUnknownGender.some((error) => error.path === "gender"), true, "new Unknown animal genders must be rejected");
  const otherWithoutDetail = new Animal({ user: "507f1f77bcf86cd799439011", animalId: "G-002", species: "Goat", status: "Deceased", dateOfDeath: new Date(), causeOfDeath: "Other" });
  const otherCauseError = await otherWithoutDetail.validate().then(() => null).catch((error) => error);
  assert.equal(Boolean(otherCauseError?.errors?.customCauseOfDeath), true, "Other death causes must include custom details");

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
