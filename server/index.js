// DevX OS — Express server entry point.
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import './db.js';
import { registerAuthRoutes } from './auth.js';
import { registerRoutes } from './routes.js';
import { ensureSeed } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Seed the database on first boot (idempotent).
ensureSeed();

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// Static frontend assets first
app.use(express.static(PUBLIC_DIR, { extensions: ['html', 'js'] }));

// API routes
registerAuthRoutes(app);
registerRoutes(app);

// SPA fallback — only serve index.html for navigation requests, not missing assets/APIs
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || path.extname(req.path)) {
    return next();
  }
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  DevX OS running → http://localhost:${PORT}\n`);
});
