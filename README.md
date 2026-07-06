# Smart Farm AI - Phase 1

Phase 1 is a working full-stack farm management app with authentication, dashboard summaries, animal CRUD, crop CRUD, and income/expense tracking.

Phase 2 adds QR Code Animal Identification.

Phase 3 adds Health, Vet Records, and Vaccination Management.

Phase 4 adds Breeding, Birth Records, and Family Tree.

Phase 5 adds Smart AI Recommendations and Farm Alerts using local rule-based logic.

Phase 6 adds Reports, Exports, and Farm Documents.

Advanced items from the full brief are intentionally not included yet: family trees, AI assistant, and advanced reports.

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
npm run seed
```

Seed login:

```text
Email: admin@smartfarm.local
Password: password123
```

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

Health records include animal, date, condition/disease, symptoms, diagnosis, treatment, medication, dosage, vet name, recovery status, and notes.

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

The Finance page is modeled around the Subukia goat shed workbook records instead of a generic accounting screen.

Finance is available from `More > Finance` in the bottom navigation. It includes these sections:

- Overview
- Income
- Expenses
- Construction
- Equipment
- Feed
- Fuel
- Consumables
- Cash & Savings
- Reports

Records support farm-style fields such as date, item, description, quantity, unit, unit cost, amount, payment method, quantity in, quantity out, balance, month, cash, savings, remarks, and notes.

Automatic calculations include:

- total cost from quantity and unit cost
- stock balance from quantity in minus quantity out
- income totals
- expense totals
- category totals
- monthly expense totals
- profit/loss summary

Crop, vet/health, and vaccination costs can now be linked to real farm records:

- Crop expenses are entered from the Crops page and saved as linked Finance transactions.
- Health/vet charges are entered from Health records and synced to Finance.
- Vaccination costs are entered from Vaccinations and synced to Finance.
- Finance can filter by crop, animal, category, payment method, and date.
- Animal profiles show total health cost, vaccination cost, recent treatments, and follow-up reminders.

## GitHub

This folder is ready to commit and push.

```bash
git init
git add .
git commit -m "Build Smart Farm AI phase 2"
gh repo create smart-farm-ai-phase-1 --private --source=. --remote=origin --push
```

If you prefer a public repo, replace `--private` with `--public`.
