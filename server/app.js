// DevX OS — Express app (shared by the Node server and the Vercel function).
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import './db.js';
import { registerAuthRoutes } from './auth.js';
import { registerRoutes } from './routes.js';
import { registerExtRoutes } from './routes_ext.js';
import { ensureSeed } from './seed.js';
import { loadAccountCache } from './accounting.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// One-time boot work (schema + seed + account cache). Cached so serverless
// cold starts run it once per instance and every request waits for it.
let readyPromise = null;
export function ready() {
  if (!readyPromise) {
    readyPromise = (async () => { await ensureSeed(); await loadAccountCache(); })()
      .catch((e) => { readyPromise = null; throw e; });
  }
  return readyPromise;
}

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(express.static(PUBLIC_DIR, { extensions: ['html', 'js'] }));
app.use(async (req, res, next) => {
  try { await ready(); next(); } catch (e) { console.error('Startup failed:', e); res.status(500).json({ error: 'Server failed to start' }); }
});

registerAuthRoutes(app);
registerRoutes(app);
registerExtRoutes(app);

// SPA fallback — only serve index.html for navigation requests, not missing assets/APIs
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || path.extname(req.path)) return next();
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

export default app;
