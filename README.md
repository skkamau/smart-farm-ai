# Smart Farm AI - Phase 1

Phase 1 is a working full-stack farm management app with authentication, dashboard summaries, animal CRUD, crop CRUD, and income/expense tracking.

Phase 2 adds QR Code Animal Identification.

Phase 3 adds Health, Vet Records, and Vaccination Management.

Phase 4 adds Breeding, Birth Records, and Family Tree.

Phase 5 adds Smart AI Recommendations and Farm Alerts using local rule-based logic.

Phase 6 adds Reports, Exports, and Farm Documents.

Advanced items from the full brief are intentionally not included yet: family trees, AI assistant, and advanced reports.

## Animal Groups and Batches - Phase 1

The Animals area now supports two tracking modes:

- **Individual Animal** keeps the existing tagged-animal workflow for cattle, goats, sheep, pigs, and selected high-value animals.
- **Animal Group / Batch** stores one record for a poultry flock, fish pond or tank, rabbit colony, bee colony, or another large group.

Create a group from **Animals > Add animals > Animal Group / Batch**. The server generates a stable category-aware ID such as `FLK-001`, `PND-001`, `TNK-001`, or `RBT-001` when an ID is not supplied.

Every quantity change is recorded as an immutable quantity event. Mortality, sales, harvests, transfers, additions, and stock corrections update the synchronized current quantity. The API rejects events that would create a negative balance and rejects repeated idempotency keys. Fish biomass is calculated as current estimated quantity multiplied by sampled average weight, converted to kilograms.

Each group has one QR code that opens its group profile. The profile includes overview, quantity calculation history, activity actions, and QR download/print controls.

This group-management delivery is deliberately limited to its first phase. Group health, inventory, finance, split/merge, and group-to-individual conversion are reserved for the next phases so existing individual-animal workflows remain stable.

## Stack

- React + Vite
- Tailwind CSS
- Node.js + Express
- MongoDB + Mongoose
- JWT authentication
- REST API

## Folder Structure

```text
Smart-Farm-AI-Phase-1/
  client/   React/Vite app
  server/   Express/MongoDB API
```

## Requirements

- Node.js 20+
- MongoDB running locally, or a MongoDB Atlas connection string

## Setup

1. Install dependencies:

```bash
npm run install:all
```

2. Create backend environment file:

```bash
cp server/.env.example server/.env
```

Update `server/.env` if your MongoDB URL differs.

3. Optional frontend environment:

```bash
cp client/.env.example client/.env
```

4. Seed sample data:

```bash
$env:SEED_USER_EMAIL="admin@smartfarm.local"
$env:SEED_USER_PASSWORD="Use-A-Strong-Password1!"
npm run seed
```

Use your own strong seed password and keep it private. The seed script will not print passwords to the terminal.

5. Run the full app:

```bash
npm run dev
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:5000`

## Available Scripts

```bash
npm run install:all   # install server and client dependencies
npm run dev           # run API and frontend together
npm run seed          # reset and seed MongoDB sample data
npm run build         # build frontend
npm start             # start backend only
```

## API Summary

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET/POST /api/animals`
- `GET /api/animals/:id`
- `GET /api/animals/qr/:qrCodeId`
- `PUT/DELETE /api/animals/:id`
- `GET/POST /api/crops`
- `PUT/DELETE /api/crops/:id`
- `GET/POST /api/transactions`
- `PUT/DELETE /api/transactions/:id`
- `GET/POST /api/health-records`
- `PUT/DELETE /api/health-records/:id`
- `GET/POST /api/vaccinations`
- `PUT/DELETE /api/vaccinations/:id`
- `GET/POST /api/breeding-records`
- `PUT/DELETE /api/breeding-records/:id`
- `GET/POST /api/birth-records`
- `PUT/DELETE /api/birth-records/:id`
- `GET /api/ai/recommendations`
- `GET /api/ai/alerts`
- `POST /api/ai/assistant`
- `GET /api/reports/:type/:format`
- `GET/POST /api/documents`
- `DELETE /api/documents/:id`
- `GET /api/dashboard`

All routes except register/login require a bearer token.

## QR Code Animal Identification

Every animal automatically receives:

- `qrCodeId`
- `qrCodeValue`

The QR value points to:

```text
{CLIENT_URL}/scan/{qrCodeId}
```

Set `CLIENT_URL` in `server/.env` to the frontend URL that users should open after scanning. For local development this is usually:

```text
CLIENT_URL=http://localhost:5173
```

Password reset emails also need the frontend URL and SMTP settings in `server/.env` or Render:

```bash
APP_URL=https://smart-farm-ai-two.vercel.app
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=smartfarm005ai@gmail.com
SMTP_PASSWORD=your_google_app_password
EMAIL_FROM="Smart Farm AI <smartfarm005ai@gmail.com>"
SUPPORT_EMAIL=smartfarm005ai@gmail.com
```

Use a Google App Password, never the normal Gmail password. Configure these values only in `server/.env` locally or Render Environment settings. The frontend may use `VITE_SUPPORT_EMAIL=smartfarm005ai@gmail.com`; it must never receive `SMTP_PASSWORD`. If SMTP is not configured, the API returns the same safe reset response but does not expose reset links or account existence.

Support requests are available under `Profile & Settings > Help & Support`. They are saved to MongoDB, shown in the admin Reports area, rate limited, deduplicated, and emailed to the configured `SUPPORT_EMAIL` when SMTP is available.

If Vite starts on another port because `5173` is busy, update `CLIENT_URL`, restart the API, and edit or reload animal records so QR links use the desired frontend URL.

### Use QR Features

1. Open `Animals`.
2. Click the eye button beside an animal.
3. Use the QR section to download the QR code as PNG or print the label.
4. Open `Scan QR` from the sidebar or mobile nav.
5. Allow camera access and scan a printed/generated animal QR code.
6. The scanner opens the matching animal profile.

Old animals without QR codes are repaired automatically when animal records are listed or opened.

## Health, Vet, and Vaccination Management

Phase 3 adds two protected record modules:

- `Health & Vet Records`
- `Vaccinations`

Use the sidebar on desktop, or mobile menu, to open each module.

Health records keep **Health Condition** separate from the veterinarian's free-text **Diagnosis**. Health Condition uses Healthy, Mild, Moderate, Serious, Critical, Recovering, Chronic, Stable, or Unknown and automatically updates the linked animal's shared health status. Symptoms and Diagnosis remain unrestricted text fields. Existing Condition / Disease records are migrated at server startup: status-like values become Health Condition values, while disease names are preserved as diagnoses without overwriting an existing diagnosis.

Vaccination records include animal, vaccine name, date given, next due date, vet name, batch number, status, and notes.

Vaccination status is automatically refreshed from `nextDueDate`:

- past due date: `overdue`
- today or future due date: `upcoming`
- no due date: existing/manual status, usually `completed`

Animal profiles now show:

- health history
- vet cases
- previous treatments
- vaccination history
- upcoming vaccinations
- overdue vaccinations

The dashboard now includes:

- sick animals
- upcoming vaccinations
- overdue vaccinations
- recent vet cases

## Breeding, Birth Records, and Family Tree

Phase 4 adds:

- breeding records for mating and pregnancy tracking
- birth records for mother, father, and offspring
- automatic parent/child linking when a birth record is created or updated
- family tree panels on animal profiles
- dashboard alerts for pregnant animals, expected births, recent births, and animals due for breeding

Use:

- `Breeding` to add mating records, pregnancy status, expected birth date, actual birth date, result, vet notes, and notes.
- `Births` to add birth records, number of offspring, offspring animal IDs, complications, vet notes, and notes.
- `Animals > View` to see parents, children, siblings, offspring count, breeding records, and birth records.

For family linking, create the newborn animals first in `Animals`, then select those animal IDs as offspring when creating the birth record.

## Smart AI Recommendations and Alerts

Phase 5 adds a local rule-based AI layer. It does not call OpenAI, Gemini, Ollama, or any paid API yet.

The backend service analyzes stored farm data and detects:

- overdue and upcoming vaccinations
- sick animals
- repeated vet cases
- pregnant animals close to expected birth
- animals due for breeding
- missing/abnormal weight data signals
- crops close to harvest
- high expenses
- low profit areas

Dashboard recommendations appear in `Smart AI Recommendations`.

Use:

- `Assistant` for chat-style farm questions.
- `Alerts` for automatic alert cards with type, priority, related item, message, suggested action, and created date.

Example assistant questions:

```text
Which animals need vaccines?
Which animals are sick?
Which crops are ready for harvest?
Show animals close to giving birth
How is my profit this month?
```

The AI code lives in `server/src/services/aiService.js` so a future LLM provider can be added as a separate adapter without replacing the rules.

## Reports, Exports, and Documents

Phase 6 adds a `Reports` page with export buttons for:

- animal reports
- health reports
- vaccination reports
- breeding reports
- birth reports
- crop reports
- financial reports
- AI recommendation reports

Export formats:

- PDF
- CSV
- Excel `.xlsx`

Animal PDF reports include the animal QR code image. Animal exports include basic details, QR link, parents, children, health/vaccination/breeding/birth counts, production placeholder, and notes.

Financial exports include total income, total expenses, profit/loss, expense categories, monthly summary, annual summary, and transaction rows.

Document uploads are available on:

- animal profiles
- health/vet record edit forms
- vaccination record edit forms
- crop record edit forms
- financial transaction edit forms

Allowed upload types include PDF, JPG, PNG, WEBP, CSV, XLSX, DOC, and DOCX. Maximum upload size is 5 MB. Uploaded files are stored in `server/uploads/`, and metadata is stored in MongoDB.

## Farm Finance Ledger

Finance is available from `More > Finance` and is organized into Overview, Transactions, Income, Expenses, Outstanding Payments, and Reports.

The shared income/expense transaction model stores amount, category, description, payment method, payment status, amount paid, outstanding amount, optional due date/reference, enterprise, linked farm record, source record, creator, reversal details, and payment history. Existing legacy fields remain readable for backward compatibility.

Automatic calculations include:

- income, expenses, and net profit/loss
- current-month income, expenses, and net result
- receivables and unpaid farm bills
- outstanding amount after partial payments
- category and enterprise profitability
- monthly income versus expenses
- inventory valuation from the separate stock-movement system

Payment method is descriptive only. This release does not create Cash, M-Pesa, Bank, Credit, or other payment accounts and does not calculate account balances or transfers.

Crop, vet/health, and vaccination costs can now be linked to real farm records:

- Crop expenses are entered from the Crops page and saved as linked Finance transactions.
- Health/vet charges are entered from Health records and synced to Finance.
- Vaccination costs are entered from Vaccinations and synced to Finance.
- Finance can filter by type, category, payment method, payment status, linked record, date, and search text.
- Source-generated transactions use stable source keys so updates reuse the same Finance record.
- Reversals remain visible in history and are excluded from profitability totals.
- Reports retain CSV, Excel, PDF, and printable output.
- Animal profiles show total health cost, vaccination cost, recent treatments, and follow-up reminders.

## Inventory And Stock Movements

Inventory is a separate module at `More > Inventory` and `/inventory`. It is not a Finance tab or Finance form.

Inventory provides Overview, Items, Stock movements, Alerts, and Reports. Item quantities are calculated from opening stock, purchases/additions, usage, and adjustments. Stock status and inventory value are calculated automatically rather than entered manually.

- Opening quantity creates one opening-stock movement and immediately becomes the displayed balance.
- Add Stock, Use Stock, Adjust Stock, View History, Edit Item, and Archive Item preserve a traceable stock ledger.
- Current, non-current, low-stock, out-of-stock, expired, and expiring-soon views are available.
- Stock usage may link to an animal, animal group, crop, or farm activity.
- Inventory valuation uses current quantity multiplied by weighted-average unit cost.
- A purchased-stock movement can optionally create one linked Finance expense.
- Editing that purchase updates the same Finance expense through its stable source key.
- Stock usage does not create another expense.
- Inventory CSV reports cover current stock, valuation, alerts, expiry, and movement history.
- Legacy inventory transactions are imported idempotently and remain available for backward compatibility.

## Secure Admin Console

The admin console is separate from the farm workspace:

```text
/admin/login
/admin/dashboard
/admin/users
/admin/reports
/admin/analytics
/admin/logs
```

Admin API routes use a short-lived admin-specific JWT and server-side role checks. A normal app token cannot access admin APIs. Supported roles are `user`, `admin`, and `super_admin`.

Admin capabilities include:

- account summaries and recent registrations
- searchable user and farm record counts
- user suspension and reactivation
- super-admin-only promotion to `admin`
- bug report and suggestion review
- privacy-friendly usage analytics
- security activity logs
- CSV exports for users, farms, reports, and analytics

Normal users can submit reports from `More > Report or Suggest`. Screenshot uploads support JPG, PNG, and WEBP files up to 5 MB.

### Create The First Super-Admin

1. Register the intended owner account through the normal signup page using a strong, unique password.
2. Open the Render service Shell for `smart-farm-ai-api`.
3. Run this one-time command, replacing the email with the registered owner account:

```bash
SUPER_ADMIN_EMAIL="owner@example.com" npm run create-super-admin
```

For local PowerShell from the project root:

```powershell
$env:SUPER_ADMIN_EMAIL="owner@example.com"
npm run create-super-admin --prefix server
Remove-Item Env:SUPER_ADMIN_EMAIL
```

The command only promotes an existing account, revokes its existing sessions, and refuses to create a different super-admin if one already exists. Do not store `SUPER_ADMIN_EMAIL` permanently in Render.

Optional admin session configuration:

```text
ADMIN_JWT_EXPIRES_IN=2h
```

Existing users require no destructive migration. MongoDB applies `role: user` and `accountStatus: active` defaults for new accounts, while admin queries treat older missing values as those safe defaults.

### Admin Data Retention And Upload Note

Usage events store only the account ID, an allowlisted feature name, and the UTC day. They expire automatically after 180 days. Audit logs never receive passwords, tokens, API keys, cookies, or secret environment values.

Screenshot files currently use the same local `server/uploads` storage as existing farm documents. On an ephemeral hosting filesystem, files can disappear after a restart; production should move uploads to private object storage before relying on long-term screenshot retention.

## Deceased Animal Records

Animal records can be marked **Deceased** from the add/edit animal form. A date of death is required; cause, custom cause, notes, veterinary confirmation, and supporting animal documents are optional. Deceased animals remain searchable and their profiles, QR codes, family links, health records, vaccinations, finance history, and exports remain available.

Deceased animals are excluded from active dashboard totals, breeding selectors, new vaccination scheduling, and vaccination reminders. Correcting a mistaken Deceased status requires an explicit confirmation and the original transition remains in the animal's `statusHistory`.

No manual database command is required. The server performs the backward-compatible status migration described below during startup.

## Shared Animal Statuses

The Animal document is the single source of truth for three independent status categories:

- `lifecycleStatus`: `active`, `sold`, `transferred`, `archived`, or `deceased`
- `healthStatus`: `healthy`, `sick`, `recovering`, `chronic`, `referred`, or `unknown`
- `reproductiveStatus`: `not_pregnant`, `pregnant`, `postpartum`, `nursing`, or `unknown`

Health records no longer store a recovery/case status. Health & Vet reads and edits the linked animal's current `healthStatus` through the ownership-protected animal status API. Pregnancy changes only reproductive status and never overwrites health or lifecycle state.

At API startup, an idempotent migration maps older mixed `status` values to the three fields. It only updates records where one or more normalized fields are missing, so rerunning it is safe. The legacy `status` property remains temporarily readable for backup compatibility but is no longer used by current dashboards, forms, reports, exports, QR profiles, reminders, or workflows.

## Vaccination Campaigns

Vaccination & Prevention supports Sheep, Goat, Cattle, Poultry, Pig, Rabbit, Fish, Dog, and custom multi-species schedules. The create form is organized into vaccination details, targets, date/dosage, costs/reminder, and notes. Template guidance never chooses animals, guesses a scheduled date, deducts inventory, or marks a campaign complete.

New schedules use one `VaccinationCampaign` with embedded target assignments. Each assignment links to either an owned `Animal` or `AnimalGroup`, stores its own completion status, and records a treated quantity for groups. Legacy `VaccinationRecord` documents remain readable and editable without migration.

Campaign status is calculated from assignment completion and the scheduled date. Completing some targets produces `partially_completed`; completing all produces `completed`. Upcoming and overdue campaigns appear on the Dashboard, Health page, Animal profiles, and Group profiles.

Campaign costs create or update one linked Finance transaction. New schedules use one additive campaign total and do not expose inventory deduction controls. Older campaigns retain booster, recurrence, provider, batch, expiry, historical date, and inventory-link values in a collapsed **Additional details** section.

The supplied sheep/goat programme is private to `samkinyanjuik@gmail.com`. Install or reconcile its ten editable templates with the one-time idempotent command below. The command stops if the account does not exist and never creates campaigns, finance records, inventory movements, or user accounts.

```bash
npm run seed:vaccination-templates --prefix server
```

## Production - Phases 1 And 2

Production is a separate farm workspace at `/production`. It records what the farm produces before sale and currently supports eggs, milk, crop harvests, fish harvests, and other produce. The form changes with the selected product type and calculates the sellable quantity on both the client and server.

```text
Sellable = produced - damaged - rejected - internal use - reserved - fed to young
```

Every record belongs to the signed-in user. The API verifies linked animals, animal groups, crops, fields, ponds, and fish groups against that same owner instead of trusting submitted IDs. Batch references are unique per user. Partial and full fish harvests require a confirmed fish count and create one idempotent group quantity event so the live group cannot be reduced twice.

Phase 2 links each active production batch to one reusable Produce item in Inventory. Only the calculated sellable quantity is added. The link is idempotent, so retries and server restarts cannot add the same batch twice. Existing Phase 1 records are reconciled automatically at server startup without changing their production history.

The **Available Produce** view is ordered by expiry date and shows the remaining quantity for each batch. A user can record household use, animal feed, farm input, seed, incubation, damage, spoilage, missing stock, donations, or another reason. These actions create traceable stock movements and never create Finance income. Produce can also be moved to a new storage location; the transfer is represented by paired, net-zero stock movements.

Production edits update the original Inventory addition instead of creating a duplicate. The sellable quantity cannot be reduced below stock already removed. Reversal keeps the historical record, removes untouched available stock, and refuses batches that already have linked use or loss movements. Fish harvest reversals also restore the linked group count once.

Produce sales, Finance income, payments, and receipts are intentionally excluded from Phase 2 and belong to Phase 3.

No migration or new environment variables are required. Existing animal, crop, Inventory, and Finance records are unchanged.

## GitHub

This folder is ready to commit and push.

```bash
git init
git add .
git commit -m "Build Smart Farm AI phase 2"
gh repo create smart-farm-ai-phase-1 --private --source=. --remote=origin --push
```

If you prefer a public repo, replace `--private` with `--public`.
