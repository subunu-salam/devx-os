// Authentication: login/logout, JWT httpOnly cookie, middleware, role guards.
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from './db.js';
import { logActivity } from './activity.js';

const JWT_SECRET = process.env.JWT_SECRET || 'devx-os-dev-secret-change-me';
const COOKIE_NAME = 'devx_token';
const isProd = process.env.NODE_ENV === 'production';

export function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.full_name },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function setCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, full_name, email, title, role, is_super FROM users WHERE id = ?').get(payload.id);
    if (!user) return res.status(401).json({ error: 'Session expired' });
    user.is_super = !!user.is_super;
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid session' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  next();
}

export function requireSuper(req, res, next) {
  if (!req.user?.is_super) return res.status(403).json({ error: 'Super admin only' });
  next();
}

export function registerAuthRoutes(app) {
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const user = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(String(email).trim());
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = signToken(user);
    setCookie(res, token);
    logActivity(user, 'login', 'auth', null, 'Signed in to DevX OS');
    res.json({ user: { id: user.id, full_name: user.full_name, email: user.email, title: user.title, role: user.role, is_super: !!user.is_super } });
  });

  app.post('/api/auth/logout', requireAuth, (req, res) => {
    logActivity(req.user, 'logout', 'auth', null, 'Signed out of DevX OS');
    res.clearCookie(COOKIE_NAME);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({ user: req.user });
  });

  app.post('/api/auth/change-password', requireAuth, (req, res) => {
    const { current_password, new_password } = req.body || {};
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    if (!bcrypt.compareSync(current_password || '', row.password_hash)) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    const hash = bcrypt.hashSync(new_password, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
    logActivity(req.user, 'update', 'auth', req.user.id, 'Changed account password');
    res.json({ ok: true });
  });
}
