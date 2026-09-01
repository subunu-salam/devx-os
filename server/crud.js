// Generic CRUD route factory with activity logging and admin-only delete (Postgres, async).
import db from './db.js';
import { requireAuth, requireAdmin } from './auth.js';
import { logActivity } from './activity.js';

const colCache = {};
async function columnExists(table, col) {
  if (!colCache[table]) {
    const rows = await db.prepare('SELECT column_name FROM information_schema.columns WHERE table_name = ?').all(table);
    colCache[table] = rows.map((r) => r.column_name);
  }
  return colCache[table].includes(col);
}

function normalize(v) { return (v === undefined || v === '') ? null : v; }

// Wrap an async handler so rejections become clean 500s instead of crashing.
const h = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
  console.error('route error:', e.message);
  if (!res.headersSent) res.status(500).json({ error: e.message });
});

export function crudRouter(app, {
  base, table, entity, fields, orderBy = 'id DESC',
  label = (row) => `#${row.id}`, afterWrite,
}) {
  const colList = fields.join(', ');

  app.get(base, requireAuth, h(async (req, res) => {
    res.json(await db.prepare(`SELECT * FROM ${table} ORDER BY ${orderBy}`).all());
  }));

  app.get(`${base}/:id`, requireAuth, h(async (req, res) => {
    const row = await db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  }));

  app.post(base, requireAuth, h(async (req, res) => {
    const values = fields.map((f) => normalize(req.body?.[f]));
    const placeholders = fields.map(() => '?').join(', ');
    const info = await db.prepare(`INSERT INTO ${table} (${colList}, created_by) VALUES (${placeholders}, ?)`)
      .run(...values, req.user.id);
    const row = await db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(info.lastInsertRowid);
    logActivity(req.user, 'create', entity, row.id, `Created ${entity} ${label(row)}`);
    if (afterWrite) await afterWrite(row, 'create');
    res.status(201).json(row);
  }));

  app.put(`${base}/:id`, requireAuth, h(async (req, res) => {
    const existing = await db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const setClause = fields.map((f) => `${f} = ?`).join(', ');
    const values = fields.map((f) => normalize(req.body?.[f] !== undefined ? req.body[f] : existing[f]));
    const hasUpdatedAt = await columnExists(table, 'updated_at');
    await db.prepare(`UPDATE ${table} SET ${setClause}${hasUpdatedAt ? ', updated_at = now()' : ''} WHERE id = ?`)
      .run(...values, req.params.id);
    const row = await db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    logActivity(req.user, 'update', entity, row.id, `Updated ${entity} ${label(row)}`);
    if (afterWrite) await afterWrite(row, 'update');
    res.json(row);
  }));

  app.delete(`${base}/:id`, requireAuth, requireAdmin, h(async (req, res) => {
    const row = await db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    await db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(req.params.id);
    logActivity(req.user, 'delete', entity, row.id, `Deleted ${entity} ${label(row)}`);
    if (afterWrite) await afterWrite(row, 'delete');
    res.json({ ok: true });
  }));
}

export { h };
