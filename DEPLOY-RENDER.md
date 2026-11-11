# Deploying dogboy on Render — what was wrong & how to fix it

## What was wrong (3 errors stacked on top of each other)

Your site worked on **Vercel** but failed on **Render** because the two
platforms work completely differently:

| | Vercel (worked ✅) | Render Web Service (failed ❌) |
|---|---|---|
| Static files (`dist/`) | Served automatically | **Not served** — needs a server process |
| `/api/*.js` files | Run automatically as Serverless Functions | **Never run** — Render has no serverless functions |
| Process to start | None needed | **Must listen on `$PORT`** — your `package.json` had no `start` script, so Render had nothing to run |
| Env vars | Already set in Vercel dashboard | **Not copied** — `api/db-client.js` throws `supabaseUrl is required` without them |

So on Render you likely saw one of these:
- `Missing script: "start"` / process exits immediately / health-check timeout
  → no server existed to start.
- Site loads but login / posts / owner dashboard broken
  → `/api/*` returned 404 or HTML instead of running your functions.
- `/api` returns 500 `supabaseUrl is required`
  → Supabase env vars were never added on Render.

## What I fixed in this repo

1. **`server.mjs`** (new) — a zero-dependency Node server that:
   - serves the Vite build in `dist/` (with SPA fallback for `/posts`, `/work`, `/owner`, …)
   - runs your **existing** `api/*.js` handlers unchanged (adapts Node `req/res` → Vercel `req/res`)
   - listens on `0.0.0.0:$PORT` as Render requires
   - imports API handlers lazily, so missing env vars give a clear `503`
     instead of crashing the whole site
2. **`package.json`** — added `"start": "node server.mjs"` and `"engines": { "node": ">=20" }`
3. **`render.yaml`** (new) — Render Blueprint with the correct build/start commands
4. **`.env.example`** (new) — lists every env var the app needs

Vercel still works exactly as before — it ignores `server.mjs` and keeps
using `/api/*` as serverless functions. You can deploy to both.

## Steps to deploy on Render (5 minutes)

### 1. Push this fixed code to GitHub
Commit & push `server.mjs`, `package.json`, `render.yaml`, `.env.example`,
and this file. (Or upload the fixed ZIP and replace the repo contents.)

### 2. Create the right kind of service
Render Dashboard → **New → Web Service** → select this repo.

> ⚠️ **Web Service, NOT Static Site.** A Static Site cannot run your
> `/api/*.js` backend (login, posts, owner dashboard, subscribe).

### 3. Set these exact commands (Settings)
```
Build Command:   npm install && npm run build
Start Command:   npm start
Health Check Path: /healthz
```
(If you used the Blueprint/`render.yaml`, these are already set.)

### 4. Add your environment variables (Environment tab)
Copy them from **Vercel → your project → Settings → Environment Variables**
(or Supabase Dashboard → Project Settings → API):

| Key | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → API → `anon` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API → `service_role` key (server-only!) |

### 5. Deploy
Click **Deploy**. When it's live, check:
- `https://<your-service>.onrender.com/` — homepage loads
- `https://<your-service>.onrender.com/healthz` — returns `{"ok":true}`
- `https://<your-service>.onrender.com/api/site` — returns site JSON
  (if it returns the "Backend is not configured" 503, step 4 is missing)

## Local test (optional)
```bash
npm install
npm run build
npm start          # then open http://localhost:10000
```
