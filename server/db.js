// SQLite database setup + schema for DevX OS
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// DATA_DIR is configurable so Render can point it at a persistent disk.
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..', 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const dbPath = path.join(DATA_DIR, 'devxos.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  title TEXT,
  role TEXT NOT NULL DEFAULT 'accountant',   -- 'admin' | 'accountant'
  is_super INTEGER NOT NULL DEFAULT 0,       -- 1 = super admin (manages users)
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS meetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_date TEXT NOT NULL,
  meeting_time TEXT,
  client_name TEXT NOT NULL,
  business_category TEXT,
  meeting_type TEXT NOT NULL DEFAULT 'Sales/Demo',
  meeting_mode TEXT NOT NULL DEFAULT 'In-Person',
  confirmed_by TEXT,
  status TEXT NOT NULL DEFAULT 'Pending',
  remarks TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_date TEXT NOT NULL,
  person TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Other Expense',
  other_details TEXT,
  amount REAL NOT NULL DEFAULT 0,
  description TEXT,
  receipt_url TEXT,
  month TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_date TEXT NOT NULL,
  type TEXT NOT NULL,                         -- 'credit' | 'debit'
  category TEXT,
  description TEXT,
  amount REAL NOT NULL DEFAULT 0,
  party TEXT,
  method TEXT,                                -- cash | card | cheque | bank
  reference TEXT,
  attachment_url TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT NOT NULL,
  client_name TEXT NOT NULL,
  issue_date TEXT NOT NULL,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'Draft',       -- Draft|Sent|Paid|Overdue|Cancelled
  subtotal REAL NOT NULL DEFAULT 0,
  tax_percent REAL NOT NULL DEFAULT 0,
  tax REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'AED',
  notes TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT,
  qty REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  amount REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  business_category TEXT,
  status TEXT NOT NULL DEFAULT 'New',          -- New|Interested|Follow-up|Won|Lost
  source TEXT,
  notes TEXT,
  next_action TEXT,
  next_action_date TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  user_name TEXT,
  action TEXT NOT NULL,                        -- login|logout|create|update|delete
  entity_type TEXT,
  entity_id INTEGER,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// --- Migrations for databases created before is_super existed (e.g. an existing Render deploy) ---
const userCols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
if (!userCols.includes('is_super')) {
  db.exec("ALTER TABLE users ADD COLUMN is_super INTEGER NOT NULL DEFAULT 0");
}
// Ensure the founder (Subunu) is the super admin.
db.prepare("UPDATE users SET is_super = 1 WHERE lower(email) = 'subinu@devxpert.ae'").run();

export default db;
