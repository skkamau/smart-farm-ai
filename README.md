# Smart Farm AI - Phase 1

Phase 1 is a working full-stack farm management app with authentication, dashboard summaries, animal CRUD, crop CRUD, and income/expense tracking.

Phase 2 adds QR Code Animal Identification.

Phase 3 adds Health, Vet Records, and Vaccination Management.

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

## GitHub

This folder is ready to commit and push.

```bash
git init
git add .
git commit -m "Build Smart Farm AI phase 2"
gh repo create smart-farm-ai-phase-1 --private --source=. --remote=origin --push
```

If you prefer a public repo, replace `--private` with `--public`.
