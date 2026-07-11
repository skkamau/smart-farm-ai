# Smart Farm AI Security Audit Report

Date: 2026-07-09

## Scope

Reviewed the Smart Farm AI React/Vite frontend and Node/Express/MongoDB backend, including authentication, password reset, API routes, document uploads, exports, backup import/export, database ownership checks, environment variables, CORS, security headers, rate limiting, validation, logging, and dependency audit output.

## Executive Summary

The audit found several real production risks in the backend API. The highest-risk issues were overly broad CORS rules, publicly served uploaded documents, missing ownership checks on linked finance/document records, weak request validation on IDs and filters, spreadsheet formula injection in CSV/XLSX exports, and unsafe backup import behavior.

These issues were fixed directly in code. The app now has stricter environment validation, safer CORS, secure headers, route rate limiting, authenticated document downloads, stronger input validation, ownership checks for linked records, safer exports, safer backup import behavior, and no published default seed password.

## Issues Found and Fixed

### High: Uploaded documents were publicly accessible

- Location: `server/src/server.js`, `server/src/controllers/documentController.js`, `server/src/routes/documentRoutes.js`, `client/src/components/DocumentManager.jsx`
- Risk: Uploaded vet receipts, lab results, crop photos, or finance documents could be accessed directly if someone knew or guessed the `/uploads/...` file path.
- Fix: Removed public static serving of `/uploads`. Added authenticated `GET /api/documents/:id/download` route that verifies the document belongs to the logged-in user before download. Updated the frontend to download documents through the protected API.

### High: Linked finance records could reference another user's farm data

- Location: `server/src/controllers/transactionController.js`
- Risk: A user could create or update a finance record linked to another user's crop, animal, health record, or vaccination record if they knew an ID.
- Fix: Added server-side ownership checks for `crop`, `animal`, `healthRecord`, and `vaccinationRecord` before creating or updating finance transactions.

### High: CORS allowed broad Vercel preview patterns

- Location: `server/src/server.js`, `server/src/config/env.js`, `render.yaml`
- Risk: Broad origin patterns could allow unintended Vercel apps to call the production API from a browser.
- Fix: Replaced wildcard-style Vercel matching with a strict allowlist from `ALLOWED_ORIGINS`, `CLIENT_URL`, known production app URLs, and local development URLs only outside production.

### Medium: Missing rate limiting on sensitive routes

- Location: `server/src/middleware/rateLimits.js`, `server/src/server.js`, `server/src/routes/authRoutes.js`, `server/src/routes/documentRoutes.js`, `server/src/routes/reportRoutes.js`
- Risk: Login, signup, password reset, uploads, and backup endpoints were easier to abuse with brute force or spam.
- Fix: Added global API rate limiting plus stricter limiters for login, signup, password reset, uploads, and backup import/export.

### Medium: Weak signup password policy

- Location: `server/src/controllers/authController.js`, `server/src/models/User.js`
- Risk: New users could create weaker passwords.
- Fix: Signup now requires at least 8 characters with uppercase, lowercase, number, and symbol. The User model minimum was raised to 8 characters.

### Medium: Password reset logs could reveal user emails

- Location: `server/src/controllers/authController.js`, `server/src/services/mailService.js`
- Risk: Logs could collect sensitive account identifiers or reset details.
- Fix: Removed email addresses from password reset rate-limit/nonexistent-account logs and removed development logging of raw reset links.

### Medium: ID and query validation gaps

- Location: `server/src/middleware/validators.js`, route files under `server/src/routes`, `server/src/controllers/transactionController.js`
- Risk: Invalid or object-shaped input could trigger unsafe database queries, noisy errors, or CastError leakage.
- Fix: Added reusable MongoDB ObjectId validators and applied them to route params and key query parameters. Added finance body validation for linked IDs, finance sections, source, and dates.

### Medium: Spreadsheet formula injection in exports

- Location: `server/src/services/reportService.js`
- Risk: Exported CSV/XLSX cells beginning with `=`, `+`, `-`, or `@` could execute formulas when opened in spreadsheet software.
- Fix: Added spreadsheet-safe escaping for CSV and Excel exports.

### Medium: Backup import could import unsafe references and document metadata

- Location: `server/src/services/reportService.js`, `server/src/routes/reportRoutes.js`
- Risk: Imported JSON backup data could include stale or cross-user object references. Document metadata could point at files that were not actually uploaded.
- Fix: Backup import now strips unsafe reference fields, caps each imported collection to 1,000 rows, requires confirmation, ignores document metadata import, and assigns records to the current user.

### Medium: Insecure upload validation

- Location: `server/src/middleware/upload.js`, `server/src/middleware/error.js`
- Risk: MIME-only upload checks are easier to bypass, and upload errors could return confusing server errors.
- Fix: Uploads now require both an allowed MIME type and allowed file extension. Unsupported and oversized files return safe 400-level errors.

### Low: Sensitive or noisy error messages

- Location: `server/src/middleware/error.js`
- Risk: Production errors could expose internal details.
- Fix: Production 500 errors now return a generic message, CastErrors return `Invalid identifier`, and 404 responses no longer echo the requested URL.

### Low: Animal search regex safety

- Location: `server/src/controllers/animalController.js`
- Risk: Raw regex search input could cause inefficient or unexpected matching.
- Fix: Search text is escaped and length-limited before being used in regex queries.

### Low: Missing environment validation

- Location: `server/src/config/env.js`, `server/src/server.js`
- Risk: Production could start with missing database or weak JWT secrets.
- Fix: Startup now requires `MONGODB_URI` and `JWT_SECRET`; production requires a JWT secret of at least 32 characters.

### Low: Predictable seed account password was documented

- Location: `README.md`, `server/src/seed.js`
- Risk: A published default login could be reused accidentally in a real deployment.
- Fix: Removed the default seed password from documentation and code. The seed script now requires `SEED_USER_PASSWORD`, validates password strength, and does not print the password.

## Files Modified

- `client/src/components/DocumentManager.jsx`
- `README.md`
- `render.yaml`
- `server/package.json`
- `server/src/config/env.js`
- `server/src/controllers/animalController.js`
- `server/src/controllers/authController.js`
- `server/src/controllers/cropController.js`
- `server/src/controllers/documentController.js`
- `server/src/controllers/transactionController.js`
- `server/src/controllers/weatherController.js`
- `server/src/middleware/error.js`
- `server/src/middleware/rateLimits.js`
- `server/src/middleware/upload.js`
- `server/src/middleware/validate.js`
- `server/src/middleware/validators.js`
- `server/src/models/User.js`
- `server/src/routes/animalRoutes.js`
- `server/src/routes/authRoutes.js`
- `server/src/routes/birthRoutes.js`
- `server/src/routes/breedingRoutes.js`
- `server/src/routes/cropRoutes.js`
- `server/src/routes/documentRoutes.js`
- `server/src/routes/healthRoutes.js`
- `server/src/routes/reportRoutes.js`
- `server/src/routes/transactionRoutes.js`
- `server/src/routes/vaccinationRoutes.js`
- `server/src/routes/weatherRoutes.js`
- `server/src/security.test.js`
- `server/src/seed.js`
- `server/src/server.js`
- `server/src/services/mailService.js`
- `server/src/services/reportService.js`

## Verification Commands Run

- `npm test` in `server`
  - Result: Passed. `Security tests passed`.
- `npm run build` in `client`
  - Result: Passed. Vite production build completed.
  - Note: Vite warns that one JavaScript bundle is larger than 500 kB.
- `Get-ChildItem -Path server/src -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }`
  - Result: Passed. No JavaScript syntax errors reported.
- Sensitive-string scan for obvious committed secrets/default credentials
  - Result: No real secrets found. Only deployment placeholder examples remain in `DEPLOYMENT.md`.
- `npm audit --omit=dev --json` in `client`
  - Result: Passed. 0 production vulnerabilities.
- `npm audit --omit=dev --json` in `server`
  - Result: 2 moderate production vulnerability entries through `exceljs` -> `uuid`.

## Remaining Risks

1. `exceljs` currently depends on a vulnerable `uuid` range according to `npm audit`.
   - Severity: Moderate.
   - Current impact: Used for server-side Excel export generation.
   - Why not changed now: The available audit fix suggests changing `exceljs` to `3.4.0`, which is a semver-major change and a downgrade from `4.4.0`. That could break exports. Safer next step is to test a replacement export library or vendor a patched export path.

2. Auth tokens are still stored in browser local storage.
   - Severity: Medium.
   - Risk: If an XSS issue is introduced later, tokens could be stolen.
   - Recommended next step: Move authentication to secure, HttpOnly, SameSite cookies and add CSRF protection for cookie-based writes.

3. CAPTCHA/bot protection is not implemented.
   - Severity: Low to Medium.
   - Current mitigation: Rate limiting and password reset cooldowns are now in place.
   - Recommended next step: Add CAPTCHA or Turnstile after repeated failed login/reset attempts.

4. The audit did not include dynamic penetration testing against a deployed production environment.
   - Severity: Informational.
   - Recommended next step: After deployment, test the real Vercel and Render URLs with production environment variables.

5. Backup import now skips document metadata.
   - Severity: Low.
   - Reason: A JSON backup does not contain the actual uploaded files, so restoring document metadata alone could create broken or misleading records.
   - Recommended next step: Build a ZIP-based backup that includes metadata and document files together.

## Recommended Next Steps

1. Set production `ALLOWED_ORIGINS` on Render to the exact Vercel frontend domains only.
2. Rotate `JWT_SECRET` if it was ever shared or committed, and make sure it is at least 32 random characters.
3. Add a real email provider and confirm `APP_URL` points to the production frontend for password reset links.
4. Replace or isolate `exceljs` to remove the remaining `uuid` audit warning.
5. Plan a follow-up auth hardening phase to move tokens from local storage to HttpOnly cookies.
6. Run a live production smoke test after deploying these changes.

## Admin System Addendum - 2026-07-11

The owner admin console adds server-enforced roles (`user`, `admin`, `super_admin`), account suspension, short-lived admin-specific JWTs, admin-login rate limiting, user/report management, privacy-friendly analytics, CSV exports, and application-level audit events. Normal app tokens do not satisfy the admin token audience or purpose, and only `super_admin` can grant or remove the `admin` role.

Additional safeguards include default password-hash exclusion, session revocation after suspension or role changes, recursive audit metadata redaction, allowlisted analytics features with 180-day TTL retention, and image-only report screenshots with file, field, and part limits.

Remaining admin risks:

- Admin bearer tokens are kept in browser session storage and remain exposed if a same-origin XSS vulnerability is introduced. A future release should consider secure, HttpOnly, SameSite cookies with CSRF protection.
- Multi-factor authentication is not yet available for admin accounts. Add MFA before supporting a larger operations team or highly sensitive deployments.
- Screenshot and document uploads use local disk storage. Render's ephemeral filesystem can discard files after restarts; private object storage with signed downloads is recommended.
- Audit logs are application-level records in the primary database. High-assurance deployments should forward them to append-only external log storage with alerting.
