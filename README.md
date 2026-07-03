# Smart Farm AI - Phase 1

Phase 1 is a working full-stack farm management app with authentication, dashboard summaries, animal CRUD, crop CRUD, and income/expense tracking.

Advanced items from the full brief are intentionally not included yet: QR codes, family trees, AI assistant, reports, and advanced health records.

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
- `PUT/DELETE /api/animals/:id`
- `GET/POST /api/crops`
- `PUT/DELETE /api/crops/:id`
- `GET/POST /api/transactions`
- `PUT/DELETE /api/transactions/:id`
- `GET /api/dashboard`

All routes except register/login require a bearer token.

## GitHub

This folder is ready to commit and push.

```bash
git init
git add .
git commit -m "Build Smart Farm AI phase 1"
gh repo create smart-farm-ai-phase-1 --private --source=. --remote=origin --push
```

If you prefer a public repo, replace `--private` with `--public`.
