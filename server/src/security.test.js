import assert from "node:assert/strict";
import { allowedOrigins, isLocalNetworkOrigin, validateEnv } from "./config/env.js";
import { createResetToken, hashResetToken, isStrongPassword } from "./utils/passwordReset.js";

const originalEnv = { ...process.env };

try {
  assert.equal(isStrongPassword("weakpass"), false, "weak passwords must be rejected");
  assert.equal(isStrongPassword("StrongPass1!"), true, "strong passwords must be accepted");

  const reset = createResetToken();
  assert.equal(reset.token.length, 64, "raw reset token should be 32 random bytes encoded as hex");
  assert.equal(reset.tokenHash, hashResetToken(reset.token), "stored reset hash should match raw token hash");
  assert.notEqual(reset.token, reset.tokenHash, "raw reset tokens must not be stored directly");

  process.env.NODE_ENV = "production";
  process.env.MONGODB_URI = "mongodb://example.invalid/smart-farm-ai";
  process.env.JWT_SECRET = "short";
  assert.throws(() => validateEnv(), /JWT_SECRET/, "short production JWT secrets must be rejected");

  process.env.JWT_SECRET = "a".repeat(32);
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
