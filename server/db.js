// Postgres data layer for DevX OS.
// Provides a small better-sqlite3-style API (prepare().get/all/run, exec, transaction)
// on top of node-postgres, so the rest of the app reads almost the same — just async.
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { Pool } = pg;
// Return numeric types as JS numbers (COUNT(*) is bigint/int8, SUM(numeric) is numeric).
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));   // int8 / bigint
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));   // numeric / decimal
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Uploaded receipts/attachments still live on the local disk.
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..', 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('\n  DATABASE_URL is not set. DevX OS stores its data in Postgres so nothing resets.\n' +
    '  Set DATABASE_URL to your Neon (or other Postgres) connection string, e.g.\n' +
    '  postgresql://user:pass@host/dbname?sslmode=require\n');
  process.exit(1);
}
const isLocal = /localhost|127\.0\.0\.1/.test(DATABASE_URL);
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 10,
});

// During a transaction all queries route through this dedicated client.
let activeClient = null;
const runner = () => activeClient || pool;

// better-sqlite3 style "?" placeholders -> Postgres "$1, $2, ...".
function toPg(sql) { let i = 0; return sql.replace(/\?/g, () => '$' + (++i)); }
// Allow .get(a,b,c) OR .get([a,b,c]).
function flat(args) { return (args.length === 1 && Array.isArray(args[0])) ? args[0] : args; }

const NO_ID_TABLES = new Set(['settings']);

function prepare(sql) {
  const text = toPg(sql);
  const m = /^\s*insert\s+into\s+"?(\w+)"?/i.exec(sql);
  const isInsert = !!m;
  const hasReturning = /returning/i.test(sql);
  const needsReturn = isInsert && !hasReturning && !NO_ID_TABLES.has(m ? m[1].toLowerCase() : '');
  const runText = needsReturn ? text + ' RETURNING id' : text;
  return {
    async get(...args) { const r = await runner().query(text, flat(args)); return r.rows[0]; },
    async all(...args) { const r = await runner().query(text, flat(args)); return r.rows; },
    async run(...args) {
      const r = await runner().query(runText, flat(args));
      return { changes: r.rowCount, lastInsertRowid: r.rows[0]?.id };
    },
  };
}

async function exec(sql) { await runner().query(sql); }

// db.transaction(fn) -> async function that runs fn inside BEGIN/COMMIT (ROLLBACK on error).
function transaction(fn) {
  return async (...callArgs) => {
    const client = await pool.connect();
    const prev = activeClient;
    activeClient = client;
    try {
      await client.query('BEGIN');
      const result = await fn(...callArgs);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch {}
      throw e;
    } finally {
      activeClient = prev;
      client.release();
    }
  };
}

const db = { prepare, exec, transaction, pool };
export default db;

// ---------------- Core schema (Postgres) ----------------
export async function initCoreSchema() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      title TEXT,
      role TEXT NOT NULL DEFAULT 'accountant',
      is_super INTEGER NOT NULL DEFAULT 0,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS meetings (
      id SERIAL PRIMARY KEY,
      meeting_date TEXT NOT NULL, meeting_time TEXT, client_name TEXT NOT NULL,
      business_category TEXT, meeting_type TEXT NOT NULL DEFAULT 'Sales/Demo',
      meeting_mode TEXT NOT NULL DEFAULT 'In-Person', confirmed_by TEXT,
      status TEXT NOT NULL DEFAULT 'Pending', remarks TEXT, created_by INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY,
      expense_date TEXT NOT NULL, person TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'Other Expense',
      other_details TEXT, amount DOUBLE PRECISION NOT NULL DEFAULT 0, description TEXT,
      receipt_url TEXT, month TEXT, created_by INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS ledger_entries (
      id SERIAL PRIMARY KEY,
      entry_date TEXT NOT NULL, type TEXT NOT NULL, category TEXT, description TEXT,
      amount DOUBLE PRECISION NOT NULL DEFAULT 0, party TEXT, method TEXT, reference TEXT,
      attachment_url TEXT, created_by INTEGER, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      invoice_number TEXT NOT NULL, client_name TEXT NOT NULL, issue_date TEXT NOT NULL, due_date TEXT,
      status TEXT NOT NULL DEFAULT 'Draft', subtotal DOUBLE PRECISION NOT NULL DEFAULT 0,
      tax_percent DOUBLE PRECISION NOT NULL DEFAULT 0, tax DOUBLE PRECISION NOT NULL DEFAULT 0,
      total DOUBLE PRECISION NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'AED', notes TEXT,
      contact_id INTEGER, amount_paid DOUBLE PRECISION NOT NULL DEFAULT 0, created_by INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS invoice_items (
      id SERIAL PRIMARY KEY,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      description TEXT, qty DOUBLE PRECISION NOT NULL DEFAULT 1,
      unit_price DOUBLE PRECISION NOT NULL DEFAULT 0, amount DOUBLE PRECISION NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL, business_category TEXT, status TEXT NOT NULL DEFAULT 'New', source TEXT,
      notes TEXT, next_action TEXT, next_action_date TEXT, converted_contact_id INTEGER, created_by INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS activity_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER, user_name TEXT, action TEXT NOT NULL, entity_type TEXT, entity_id INTEGER,
      description TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await db.exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super INTEGER NOT NULL DEFAULT 0");
  await db.exec("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS contact_id INTEGER");
  await db.exec("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_paid DOUBLE PRECISION NOT NULL DEFAULT 0");
  await db.exec("ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_contact_id INTEGER");
  await db.prepare("UPDATE users SET is_super = 1 WHERE lower(email) = 'subinu@devxpert.ae'").run();
}
