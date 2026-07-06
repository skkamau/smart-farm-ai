# Smart Farm AI Deployment Guide

This app deploys as three parts:

- Frontend: Vercel
- Backend API: Render
- Database: MongoDB Atlas

## 1. MongoDB Atlas

Create a free MongoDB Atlas cluster, then copy the connection string.

Use a database user with a strong password. In Network Access, allow Render to connect. For a simple first deployment, you can temporarily allow `0.0.0.0/0`, then tighten this later.

Connection string format:

```text
mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/smart-farm-ai?retryWrites=true&w=majority
```

## 2. Deploy Backend on Render

1. Go to Render.
2. Create a new Blueprint or Web Service from GitHub repo `skkamau/smart-farm-ai`.
3. If using Blueprint, Render will read `render.yaml`.
4. Set these environment variables:

```text
MONGODB_URI=your MongoDB Atlas connection string
CLIENT_URL=your Vercel frontend URL, for example https://smart-farm-ai.vercel.app
JWT_SECRET=Render can generate this from render.yaml
JWT_EXPIRES_IN=7d
NODE_ENV=production
```

Backend health check:

```text
https://YOUR-RENDER-SERVICE.onrender.com/api/health
```

## 3. Deploy Frontend on Vercel

1. Go to Vercel.
2. Import GitHub repo `skkamau/smart-farm-ai`.
3. Set root directory to:

```text
client
```

4. Vercel should detect Vite automatically.
5. Add this environment variable:

```text
VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com/api
```

Build command:

```text
npm run build
```

Output directory:

```text
dist
```

## 4. Update Render After Vercel Deploys

After Vercel gives you the final frontend URL, go back to Render and set:

```text
CLIENT_URL=https://YOUR-VERCEL-APP.vercel.app
```

Redeploy the backend.

This is important for:

- login CORS
- QR code profile links
- phone access

## 5. Seed Data

For production, do not seed test data unless you want demo records online.

If you do want demo data, run the seed command from Render Shell:

```bash
npm run seed
```

## 6. Notes

- GitHub stores code only; it does not run the app.
- Uploaded files on Render may not be permanent unless you add persistent storage or move uploads to cloud storage later.
- Keep `.env` private. Do not commit it.
