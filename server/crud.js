// Generic CRUD route factory with activity logging and admin-only delete.
import db from './db.js';
import { requireAuth, requireAdmin } from './auth.js';
import { logActivity } from './activity.js';

export function crudRouter(app, {
  base,            // e.g. '/api/meetings'
  table,           // e.g. 'meetings'
  entity,          // e.g. 'meeting'
  fields,          // array of writable column names
  orderBy = 'id DESC',
  label = (row) => `#${row.id}`,   // human label for activity log
  afterWrite,      // optional (row, action) hook
}) {
  const colList = fields.join(', ');

  app.get(base, requireAuth, (req, res) => {
    const rows = db.prepare(`SELECT * FROM ${table} ORDER BY ${orderBy}`).all();
    res.json(rows);
  });

  app.get(`${base}/:id`, requireAuth, (req, res) => {
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  });

  app.post(base, requireAuth, (req, res) => {
    const values = fields.map((f) => normalize(req.body?.[f]));
    const placeholders = fields.map(() => '?').join(', ');
    const info = db
      .prepare(`INSERT INTO ${table} (${colList}, created_by) VALUES (${placeholders}, ?)`)
      .run(...values, req.user.id);
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(info.lastInsertRowid);
    logActivity(req.user, 'create', entity, row.id, `Created ${entity} ${label(row)}`);
    if (afterWrite) afterWrite(row, 'create');
    res.status(201).json(row);
  });

  app.put(`${base}/:id`, requireAuth, (req, res) => {
    const existing = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const setClause = fields.map((f) => `${f} = ?`).join(', ');
    const values = fields.map((f) => normalize(req.body?.[f] !== undefined ? req.body[f] : existing[f]));
    const hasUpdatedAt = columnExists(table, 'updated_at');
    db.prepare(`UPDATE ${table} SET ${setClause}${hasUpdatedAt ? ", updated_at = datetime('now')" : ''} WHERE id = ?`)
      .run(...values, req.params.id);
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    logActivity(req.user, 'update', entity, row.id, `Updated ${entity} ${label(row)}`);
    if (afterWrite) afterWrite(row, 'update');
    res.json(row);
  });

  app.delete(`${base}/:id`, requireAuth, requireAdmin, (req, res) => {
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(req.params.id);
    logActivity(req.user, 'delete', entity, row.id, `Deleted ${entity} ${label(row)}`);
    if (afterWrite) afterWrite(row, 'delete');
    res.json({ ok: true });
  });
}

function normalize(v) {
  if (v === undefined || v === '') return null;
  return v;
}

const colCache = {};
function columnExists(table, col) {
  if (!colCache[table]) {
    colCache[table] = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  }
  return colCache[table].includes(col);
}
