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
import VaccinationCampaign from "./models/VaccinationCampaign.js";
import VaccinationTemplate from "./models/VaccinationTemplate.js";
import Transaction from "./models/Transaction.js";
import FinanceAuditLog from "./models/FinanceAuditLog.js";
import { buildCampaignPayload, campaignRules } from "./controllers/vaccinationCampaignController.js";
import { calculateCampaignCost, canonicalSpecies, isSpeciesCompatible, resolveCampaignStatus, systemVaccinationTemplates } from "./services/vaccinationCampaignService.js";
import BirthRecord from "./models/BirthRecord.js";
import { birthRules, normalizeFather } from "./controllers/birthController.js";
import { calculateMovementLedger, calculateStockChange, classificationFor, inventoryStatus, weightedAverageCost } from "./controllers/inventoryController.js";
import { paymentState, resetFinanceRules } from "./controllers/transactionController.js";
import ProductionRecord from "./models/ProductionRecord.js";
import { calculateSellableQuantity, productionRules, removalRules, transferRules } from "./controllers/productionController.js";
import InventoryItem from "./models/InventoryItem.js";
import StockMovement from "./models/StockMovement.js";
import { outgoingReasons, productionProduceKey } from "./services/productionInventoryService.js";

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

async function campaignValidationErrors(body) {
  const request = { body };
  await Promise.all(campaignRules.map((rule) => rule.run(request)));
  return validationResult(request).array();
}

async function birthValidationErrors(body) {
  const request = { body };
  await Promise.all(birthRules.map((rule) => rule.run(request)));
  return validationResult(request).array();
}

async function financeResetValidationErrors(body) {
  const request = { body };
  await Promise.all(resetFinanceRules.map((rule) => rule.run(request)));
  return validationResult(request).array();
}

async function productionValidationErrors(body) {
  const request = { body };
  await Promise.all(productionRules.map((rule) => rule.run(request)));
  return validationResult(request).array();
}

async function rulesValidationErrors(rules, body) {
  const request = { body };
  await Promise.all(rules.map((rule) => rule.run(request)));
  return validationResult(request).array();
}

const originalEnv = { ...process.env };

try {
  assert.equal(calculateSellableQuantity({ quantityProduced: 320, quantityDamaged: 8, quantityUsedInternally: 12, quantityReserved: 30 }), 270, "egg production must calculate 270 sellable eggs");
  assert.equal(calculateSellableQuantity({ quantityProduced: 24, quantityFedToYoung: 5, quantityUsedInternally: 2, quantityRejected: 1 }), 16, "milk production must calculate 16 sellable litres");
  assert.throws(() => calculateSellableQuantity({ quantityProduced: 10, quantityDamaged: 11 }), /cannot exceed/, "production exclusions must never create negative sellable stock");
  assert.equal(ProductionRecord.schema.indexes().some(([fields, options]) => fields.user === 1 && fields.batchReference === 1 && options.unique), true, "production batch references must be unique per owner");
  assert.equal(ProductionRecord.schema.path("inventoryMovement").instance, "ObjectId", "production must link to its one inventory addition");
  assert.equal(ProductionRecord.schema.path("stockVersion").options.select, false, "production stock locks must not be exposed by default");
  assert.equal(InventoryItem.schema.indexes().some(([fields, options]) => fields.user === 1 && fields.produceKey === 1 && options.unique && options.sparse), true, "matching produce inventory items must be reused safely");
  assert.equal(StockMovement.schema.indexes().some(([fields, options]) => fields.user === 1 && fields.sourceKey === 1 && options.unique && options.sparse), true, "production stock movements must be idempotent per owner");
  assert.equal(StockMovement.schema.path("productionRecord").instance, "ObjectId", "stock movements must link back to production batches");
  assert.equal(productionProduceKey({ productName: " Table Eggs ", baseUnit: "egg" }), "table eggs::egg", "produce matching keys must be stable");
  assert.equal(outgoingReasons.has("spoiled"), true, "produce removal reasons must include spoilage");
  assert.equal((await rulesValidationErrors(removalRules, { reason: "spoiled", quantity: 2, movementDate: "2026-08-02", idempotencyKey: "removal-1" })).length, 0, "valid produce removals must pass validation");
  assert.equal((await rulesValidationErrors(removalRules, { reason: "sold", quantity: 2, idempotencyKey: "removal-2" })).length > 0, true, "Phase 2 must not treat produce sales as internal-use removals");
  assert.equal((await rulesValidationErrors(transferRules, { storageLocation: "Cold room A", movementDate: "2026-08-02", idempotencyKey: "transfer-1" })).length, 0, "valid storage transfers must pass validation");
  const validEggProduction = await productionValidationErrors({ productType: "eggs", productName: "Table Eggs", sourceType: "animal_group", sourceId: "507f1f77bcf86cd799439011", productionDate: "2026-08-02", quantityProduced: 320, baseUnit: "egg", quantityDamaged: 8, quantityUsedInternally: 12, quantityReserved: 30 });
  assert.equal(validEggProduction.length, 0, "valid egg production should pass validation");
  const invalidFishProduction = await productionValidationErrors({ productType: "fish_harvest", productName: "Tilapia", sourceType: "fish_group", sourceId: "507f1f77bcf86cd799439011", productionDate: "2026-08-02", quantityProduced: 20, baseUnit: "kilogram", fishHarvestType: "partial", fishHarvestCount: 0 });
  assert.equal(invalidFishProduction.length > 0, true, "partial fish harvests must include a confirmed removed count");
  let flockQuantity = 500;
  flockQuantity = nextGroupQuantity(flockQuantity, "death", 10);
  flockQuantity = nextGroupQuantity(flockQuantity, "sold", 100);
  assert.equal(flockQuantity, 390, "group quantity must reflect mortality and sales");
  assert.throws(() => nextGroupQuantity(5, "death", 6), /negative/, "group quantity must never become negative");
  assert.equal(nextGroupQuantity(390, "stock_correction", 400), 400, "stock correction must set the confirmed balance");
  assert.equal(calculateBiomass(4000, 250, "g"), 1000, "fish biomass must convert sampled grams to kilograms");
  assert.equal(AnimalGroup.schema.indexes().some(([fields, options]) => fields.user === 1 && fields.groupId === 1 && options.unique), true, "group IDs must be unique per owner");
  assert.equal(GroupQuantityEvent.schema.indexes().some(([fields, options]) => fields.idempotencyKey === 1 && options.unique), true, "quantity events must reject duplicate idempotency keys");
  assert.equal(canonicalSpecies("Chicken"), "poultry", "chickens must match poultry schedules");
  assert.equal(canonicalSpecies("Tilapia"), "fish", "tilapia groups must match fish preventive schedules");
  assert.equal(isSpeciesCompatible("poultry", "Chicken", "poultry"), true, "poultry groups must pass schedule compatibility");
  assert.equal(isSpeciesCompatible(["sheep", "goat"], "Goat"), true, "multi-species schedules must accept every supported species");
  assert.equal(isSpeciesCompatible("sheep", "Cattle"), false, "incompatible species must be rejected");
  const campaignAssignments = [{ targetType: "individual" }, { targetType: "individual" }, { targetType: "group", quantityTreated: 20 }];
  assert.equal(calculateCampaignCost({ vaccineCost: 100, serviceCharge: 50, costMode: "total" }, campaignAssignments), 150, "total campaign costs must be recorded once");
  assert.equal(calculateCampaignCost({ vaccineCost: 10, costMode: "per_animal" }, campaignAssignments), 220, "per-animal costs must include group quantities");
  assert.equal(resolveCampaignStatus({ scheduledDate: "2099-01-01", assignments: [{ completionStatus: "completed" }, { completionStatus: "scheduled" }] }), "partially_completed", "partial assignment completion must update campaign status");
  assert.equal(resolveCampaignStatus({ scheduledDate: "2020-01-01", assignments: [{ completionStatus: "scheduled" }] }), "overdue", "past incomplete campaigns must become overdue");
  assert.equal(systemVaccinationTemplates.some((template) => template.scheduleName.includes("PPR")), false, "private sheep and goat templates must not be exposed globally");
  assert.equal(VaccinationCampaign.schema.path("assignments").schema.path("completionStatus").enumValues.includes("postponed"), true, "campaign assignments must support postponed completion");
  assert.equal(VaccinationCampaign.schema.path("dateIssued").instance, "Date", "campaigns must store their date issued separately from the scheduled date");
  assert.equal(VaccinationTemplate.schema.path("supportedSpecies").instance, "Array", "templates must support one or more compatible species");
  assert.equal(Transaction.schema.path("vaccinationCampaign").instance, "ObjectId", "finance transactions must link to vaccination campaigns");
  const builtCampaign = buildCampaignPayload({ species: "goat", supportedSpecies: ["sheep", "goat"], vaccineCost: 100, serviceCharge: 20, costMode: "total", assignments: [{ targetType: "individual", animal: "507f1f77bcf86cd799439011" }] });
  assert.equal(builtCampaign.totalCost, 120, "campaign payload must calculate one finance total");
  assert.equal(builtCampaign.assignments[0].quantityTreated, 1, "individual assignments must represent one animal");
  assert.deepEqual(builtCampaign.supportedSpecies, ["sheep", "goat"], "campaign payloads must retain all supported species");
  const invalidCampaign = await campaignValidationErrors({ scheduleName: "", species: "cattle", supportedSpecies: [], vaccineName: "", diseasePrevented: "", scheduledDate: "bad", assignments: [] });
  assert.equal(invalidCampaign.some((error) => error.path === "scheduleName"), true, "campaign name must be required");
  assert.equal(invalidCampaign.some((error) => error.path === "scheduledDate"), true, "campaign dates must be valid");
  assert.equal(invalidCampaign.some((error) => error.path === "assignments"), true, "campaigns must select at least one target");
  assert.equal(isStrongPassword("weakpass"), false, "weak passwords must be rejected");
  assert.equal(isStrongPassword("StrongPass1!"), true, "strong passwords must be accepted");
  assert.equal(normalizeFather(""), null, "an unknown father must be stored as null");
  assert.equal(BirthRecord.schema.path("father").options.default, null, "birth records must support an unknown father");
  assert.equal(BirthRecord.schema.indexes().some(([fields, options]) => fields.user === 1 && fields.submissionKey === 1 && options.unique), true, "birth submissions must be idempotent per owner");
  assert.equal(Animal.schema.path("birthRecord").instance, "ObjectId", "offspring must reference their birth record");
  assert.equal(Animal.schema.path("birthWeight").instance, "Number", "offspring must store birth weight separately");
  const validUnknownFatherBirth = await birthValidationErrors({
    mother: "507f1f77bcf86cd799439011",
    father: null,
    birthDate: "2026-07-01",
    numberOfOffspring: 1,
    offspringMode: "create",
    newOffspring: [{ animalId: "OFF-001", species: "Goat", gender: "Unknown", birthWeight: 2.5, weightUnit: "kg", healthStatus: "unknown", lifecycleStatus: "active" }]
  });
  assert.equal(validUnknownFatherBirth.length, 0, "birth validation must allow an unknown father and inline offspring");
  const invalidBirthCount = await birthValidationErrors({ mother: "507f1f77bcf86cd799439011", birthDate: "2026-07-01", numberOfOffspring: 21 });
  assert.equal(invalidBirthCount.some((error) => error.path === "numberOfOffspring"), true, "individually tracked births must enforce a reasonable offspring limit");

  const reset = createResetToken();
  assert.equal(reset.token.length, 64, "raw reset token should be 32 random bytes encoded as hex");
  assert.equal(reset.tokenHash, hashResetToken(reset.token), "stored reset hash should match raw token hash");
  assert.notEqual(reset.token, reset.tokenHash, "raw reset tokens must not be stored directly");
  assert.equal(genericResetMessage, "If an account exists for this email, a password reset link has been sent.", "reset requests must use the non-enumerating response");
  assert.equal(defaultSupportEmail, "smartfarm005ai@gmail.com", "official support email must be consistent");
  assert.equal(smtpConfigured({ SMTP_HOST: "smtp.gmail.com", SMTP_USER: "support@example.test", SMTP_PASSWORD: "app-password" }), true, "SMTP_PASSWORD configuration must be supported");
  assert.equal(smtpConfigured({ SMTP_HOST: "smtp.gmail.com", SMTP_USER: "support@example.test" }), false, "partial SMTP configuration must not send mail");
  assert.equal(BugReport.schema.path("reportType").enumValues.includes("Payment issue"), true, "support reports must include payment issues");
  let stock = calculateStockChange(42, "purchase", 20);
  assert.equal(stock.newQuantity, 62, "stock purchases must increase opening quantity");
  stock = calculateStockChange(stock.newQuantity, "used", 10);
  assert.equal(stock.newQuantity, 52, "stock usage must reduce available quantity");
  stock = calculateStockChange(stock.newQuantity, "used", 5);
  assert.equal(stock.newQuantity, 47, "successive movements must preserve the running balance");
  assert.equal(inventoryStatus({ currentQuantity: 47, minimumStockLevel: 50 }), "Low stock", "minimum levels must trigger low stock");
  assert.equal(inventoryStatus({ currentQuantity: 0, minimumStockLevel: 50 }), "Out of stock", "zero balance must be out of stock");
  assert.equal(classificationFor("Equipment"), "equipment_asset", "equipment must remain separate from consumable stock");
  assert.equal(weightedAverageCost(42, 100, 20, 121), 106.7741935483871, "stock additions must use weighted-average unit cost");
  const inventoryLedger = calculateMovementLedger([
    { _id: "opening", type: "opening_stock", quantity: 42, unitCost: 100, balanceAfter: 42 },
    { _id: "purchase", type: "purchase", quantity: 20, unitCost: 121, balanceAfter: 62 },
    { _id: "used", type: "used", quantity: 10, unitCost: 0, balanceAfter: 52 },
    { _id: "counted", type: "adjustment", quantity: 5, unitCost: 0, balanceAfter: 47 }
  ]);
  assert.equal(inventoryLedger.currentQuantity, 47, "opening stock and every movement must produce one current quantity");
  assert.equal(inventoryLedger.rows[0].balanceAfter, 42, "opening quantity 42 must immediately display as 42");
  assert.equal(inventoryLedger.rows[3].quantityChange, -5, "stock counts must be represented as an adjustment");
  assert.equal(inventoryLedger.averageUnitCost, 106.7741935483871, "the stock ledger must retain weighted-average purchase cost");
  assert.throws(
    () => calculateMovementLedger([{ _id: "used", type: "used", quantity: 1, balanceAfter: 0 }]),
    /negative/,
    "stock movement history must never allow negative stock"
  );
  assert.deepEqual(paymentState(1000, 1000, "paid"), { amountPaid: 1000, amountOutstanding: 0, paymentStatus: "paid" }, "paid transactions must have no outstanding balance");
  assert.deepEqual(paymentState(1000, 400, "partially_paid"), { amountPaid: 400, amountOutstanding: 600, paymentStatus: "partially_paid" }, "partial payments must calculate their balance");
  assert.deepEqual(paymentState(1000, 0, "unpaid"), { amountPaid: 0, amountOutstanding: 1000, paymentStatus: "unpaid" }, "unpaid transactions must keep the full amount outstanding");
  assert.throws(() => paymentState(1000, 1001, "partially_paid"), /cannot exceed/, "payments must not exceed the transaction amount");
  assert.equal(Transaction.schema.path("sourceKey").options.default, undefined, "manual transactions must not share a null unique source key");
  assert.equal(Transaction.schema.path("payments").instance, "Array", "transactions must retain payment history");
  assert.equal(Boolean(Transaction.schema.path("accountBalance")), false, "Finance must not introduce payment account balances");
  const paidFinanceTransaction = new Transaction({
    user: "507f1f77bcf86cd799439011", createdBy: "507f1f77bcf86cd799439011",
    type: "income", financeSection: "Income", category: "Animal Sales", amount: 2500,
    description: "Goat sale", paymentStatus: "paid"
  });
  await paidFinanceTransaction.validate();
  assert.equal(paidFinanceTransaction.amountPaid, 2500, "paid transactions must synchronize amount paid before storage");
  assert.equal(paidFinanceTransaction.amountOutstanding, 0, "paid transactions must store no outstanding balance");
  assert.match(paidFinanceTransaction.transactionId, /^FIN-/, "new transactions must receive a stable transaction ID");
  assert.equal(paidFinanceTransaction.sourceKey, undefined, "manual transactions must not receive a duplicate-prevention source key");
  assert.equal((await financeResetValidationErrors({ confirmation: "RESET FINANCE" })).length, 0, "the exact Finance reset phrase must be accepted");
  assert.equal((await financeResetValidationErrors({ confirmation: "reset finance" })).length > 0, true, "an incorrect Finance reset phrase must be rejected");
  assert.equal(FinanceAuditLog.schema.path("action").enumValues.includes("reset"), true, "Finance resets must leave a safe audit event");

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
