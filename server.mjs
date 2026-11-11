// server.mjs — Production server for Render (and any Node host).
//
// WHY THIS FILE EXISTS
// --------------------
// This project is a Vite SPA + Vercel Serverless Functions in /api/*.js.
// Vercel runs those functions automatically, so the site worked there
// with no server at all.
//
// Render Web Services do NOT run Vercel functions and do NOT serve a
// build folder by themselves. A Web Service must be a long-running
// process listening on $PORT. Without this file Render had nothing to
// start (package.json had no "start" script), so deploys failed /
// health-checks timed out, and /api/* would 404 even if it started.
//
// This zero-dependency server (Node built-ins only):
//   1. Serves the Vite build output in dist/ (static files + SPA fallback)
//   2. Runs the EXISTING /api/*.js handlers unchanged by adapting
//      Node's req/res to the Vercel req/res shape they expect
//      (req.query, req.body, res.status().json(), res.setHeader(), ...)
//   3. Listens on 0.0.0.0:$PORT (Render injects $PORT)
//
// Vercel is unaffected: it ignores this file and keeps using /api/*
// as serverless functions.
//
// Required environment variables (set them in Render Dashboard →
// Environment, copied from Vercel → Settings → Environment Variables):
//   NEXT_PUBLIC_SUPABASE_URL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY
//   SUPABASE_SERVICE_ROLE_KEY   (server-only, never expose in frontend)
// Without the first two, api/db-client.js throws
// "supabaseUrl is required" at import time — handlers are therefore
// imported lazily per-request below, so the static site still loads
// and /api/* returns a clear 503 JSON instead of crashing the server.

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'dist');
const PORT = Number(process.env.PORT) || 10000;
const HOST = '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.map': 'application/json; charset=utf-8',
};

// ---------------------------------------------------------------------------
// API routing: URL path -> existing Vercel handler file.
// Helper modules (db-client, db-wake, owner-access, runtime-env) are
// intentionally NOT routes.
// ---------------------------------------------------------------------------
const API_ROUTES = new Map([
  ['/api/site', './api/site.js'],
  ['/api/posts', './api/posts.js'],
  ['/api/work', './api/work.js'],
  ['/api/owner', './api/owner.js'],
  ['/api/subscribe', './api/subscribe.js'],
]);

function apiHandlerFor(pathname) {
  if (API_ROUTES.has(pathname)) return { file: API_ROUTES.get(pathname), catchAll: null };
  // /api/studio-auth/auth/v1/token  ->  api/studio-auth/[...path].js
  // Vercel passes the remainder as req.query.path = ['auth', 'v1', 'token']
  const prefix = '/api/studio-auth/';
  if (pathname.startsWith(prefix)) {
    const rest = pathname.slice(prefix.length).split('/').filter(Boolean);
    return { file: './api/studio-auth/[...path].js', catchAll: rest };
  }
  if (pathname === '/api/studio-auth') {
    return { file: './api/studio-auth/[...path].js', catchAll: [] };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Vercel-style response adapter
// ---------------------------------------------------------------------------
class VercelRes {
  constructor(nodeRes) {
    this.nodeRes = nodeRes;
    this.statusCode = 200;
  }
  setHeader(name, value) {
    this.nodeRes.setHeader(name, value);
    return this;
  }
  getHeader(name) {
    return this.nodeRes.getHeader(name);
  }
  status(code) {
    this.statusCode = code;
    this.nodeRes.statusCode = code;
    return this;
  }
  json(value) {
    if (!this.nodeRes.hasHeader('Content-Type')) {
      this.nodeRes.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    this.nodeRes.end(JSON.stringify(value));
    return this;
  }
  send(value) {
    this.nodeRes.end(value);
    return this;
  }
  end(chunk) {
    this.nodeRes.end(chunk);
    return this;
  }
}

function sendJson(nodeRes, status, value) {
  nodeRes.statusCode = status;
  nodeRes.setHeader('Content-Type', 'application/json; charset=utf-8');
  nodeRes.setHeader('Cache-Control', 'no-store');
  nodeRes.end(JSON.stringify(value));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  const type = req.headers['content-type'] || '';
  if (type.includes('application/json')) {
    try {
      return JSON.parse(raw);
    } catch {
      const err = new Error('Request body is not valid JSON.');
      err.status = 400;
      throw err;
    }
  }
  return raw;
}

async function handleApi(req, res, pathname, searchParams) {
  const route = apiHandlerFor(pathname);
  if (!route) return sendJson(res, 404, { error: 'API route not found.' });

  // Build the Vercel-shaped req object the handlers expect.
  const query = {};
  for (const [key, value] of searchParams.entries()) {
    query[key] = value;
  }
  if (route.catchAll !== null) query.path = route.catchAll;

  let body;
  try {
    body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
      ? await readBody(req)
      : undefined;
  } catch (err) {
    return sendJson(res, err.status || 400, { error: err.message });
  }

  const vercelReq = {
    method: req.method,
    headers: req.headers,
    query,
    body,
    url: req.url,
  };
  const vercelRes = new VercelRes(res);

  try {
    // Lazy import: api/db-client.js calls createClient() at module load and
    // throws "supabaseUrl is required" when env vars are missing. Importing
    // here (inside try/catch) keeps the static site alive and returns a
    // clear 503 for /api instead of crashing the whole process.
    const mod = await import(route.file);
    const handler = mod.default;
    if (typeof handler !== 'function') {
      return sendJson(res, 500, { error: 'API handler is not a function.' });
    }
    await handler(vercelReq, vercelRes);
    if (!res.writableEnded) res.end();
  } catch (err) {
    console.error(`[api] ${req.method} ${pathname} failed:`, err?.message || err);
    if (!res.writableEnded) {
      const missingEnv =
        !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      sendJson(
        res,
        503,
        missingEnv
          ? {
              error:
                'Backend is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Render Environment settings (copy them from Vercel).',
            }
          : { error: 'The backend is unavailable. Please try again.' },
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Static file serving + SPA fallback
// ---------------------------------------------------------------------------
async function serveFile(res, filePath) {
  const data = await readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  // Vite hashes files in /assets/* — safe to cache forever.
  if (filePath.includes(`${path.sep}assets${path.sep}`)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (ext === '.html') {
    res.setHeader('Cache-Control', 'no-cache');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }
  res.end(data);
}

async function handleStatic(req, res, pathname) {
  // Prevent directory traversal.
  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  const candidate = path.join(DIST, safePath);

  try {
    const info = await stat(candidate);
    if (info.isFile()) return serveFile(res, candidate);
    if (info.isDirectory()) {
      const index = path.join(candidate, 'index.html');
      try {
        await stat(index);
        return serveFile(res, index);
      } catch {
        /* fall through to SPA fallback */
      }
    }
  } catch {
    /* not found — fall through */
  }

  // Missing file with an extension (e.g. /assets/missing.js) → real 404,
  // so broken asset links are visible instead of silently getting HTML.
  if (path.extname(pathname)) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('Not found');
  }

  // SPA fallback: /, /posts, /posts/:slug, /work, /owner, ...
  // (vite.config.ts also pre-generates dist/<route>/index.html for known
  // routes; this covers everything else, including future routes.)
  try {
    return serveFile(res, path.join(DIST, 'index.html'));
  } catch {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(
      'Frontend build not found. Run "npm run build" first — on Render set Build Command to "npm install && npm run build".',
    );
  }
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = decodeURIComponent(url.pathname);

    if (pathname === '/healthz') {
      return sendJson(res, 200, { ok: true });
    }
    if (pathname === '/api' || pathname.startsWith('/api/')) {
      return handleApi(req, res, pathname, url.searchParams);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405;
      return res.end('Method not allowed');
    }
    return handleStatic(req, res, pathname);
  } catch (err) {
    console.error('[server] unhandled error:', err);
    if (!res.writableEnded) sendJson(res, 500, { error: 'Internal server error.' });
  }
});

server.listen(PORT, HOST, async () => {
  console.log(`dogboy server listening on http://${HOST}:${PORT}`);
  try {
    await stat(path.join(DIST, 'index.html'));
  } catch {
    console.warn(
      'WARNING: dist/index.html not found. The frontend has not been built — run "npm run build" (Render Build Command: "npm install && npm run build").',
    );
  }
  const missing = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']
    .filter((key) => !process.env[key]);
  if (missing.length) {
    console.warn(
      `WARNING: missing environment variables: ${missing.join(', ')}. ` +
        'Copy them from Vercel (Settings → Environment Variables) into Render (Dashboard → Environment). ' +
        'The site will load, but login / posts / owner features will return 503 until they are set.',
    );
  }
});
