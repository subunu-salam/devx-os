// Extended schema for DevX OS — Zoho Books (double-entry accounting) + Zoho CRM modules.
// Applied on top of the core tables in db.js. All statements are IF NOT EXISTS so this is
// safe to run on every boot, including an existing Render deploy.
import db from './db.js';

db.exec(`
/* ============================ ZOHO BOOKS ============================ */

/* Chart of Accounts — every posting hits an account here. */
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL,        -- asset | liability | equity | income | expense
  account_subtype TEXT,              -- e.g. bank, cash, accounts_receivable, current_asset, fixed_asset,
                                     -- accounts_payable, current_liability, tax, equity, income, other_income,
                                     -- cost_of_goods_sold, expense, other_expense
  description TEXT,
  is_system INTEGER NOT NULL DEFAULT 0,   -- 1 = built-in, cannot delete
  is_active INTEGER NOT NULL DEFAULT 1,
  opening_balance REAL DEFAULT 0,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

/* Contacts — customers and vendors (Zoho Books "Contacts"). */
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_type TEXT NOT NULL DEFAULT 'customer',   -- customer | vendor
  display_name TEXT NOT NULL,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  trn TEXT,                          -- UAE Tax Registration Number
  billing_address TEXT,
  payment_terms TEXT DEFAULT 'Due on Receipt',
  notes TEXT,
  opening_balance REAL DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

/* Items — products / services sold or purchased. */
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'service',   -- goods | service
  sku TEXT,
  description TEXT,
  sell_price REAL DEFAULT 0,
  cost_price REAL DEFAULT 0,
  tax_percent REAL DEFAULT 5,
  income_account_id INTEGER REFERENCES accounts(id),
  expense_account_id INTEGER REFERENCES accounts(id),
  unit TEXT,
  track_inventory INTEGER DEFAULT 0,
  opening_stock REAL DEFAULT 0,
  stock_on_hand REAL DEFAULT 0,
  reorder_level REAL DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

/* Journals — the double-entry backbone. Every financial document produces one journal
   with balanced lines. source_type/source_id link back to the originating document. */
CREATE TABLE IF NOT EXISTS journals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  journal_number TEXT,
  journal_date TEXT NOT NULL,
  reference TEXT,
  notes TEXT,
  source_type TEXT NOT NULL DEFAULT 'manual',  -- manual | invoice | bill | payment | expense | credit_note | opening
  source_id INTEGER,
  is_manual INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  journal_id INTEGER NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  debit REAL NOT NULL DEFAULT 0,
  credit REAL NOT NULL DEFAULT 0,
  description TEXT,
  contact_id INTEGER
);
CREATE INDEX IF NOT EXISTS idx_jl_account ON journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_jl_journal ON journal_lines(journal_id);
CREATE INDEX IF NOT EXISTS idx_j_source ON journals(source_type, source_id);

/* Estimates / Quotes. */
CREATE TABLE IF NOT EXISTS estimates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  estimate_number TEXT NOT NULL,
  contact_id INTEGER REFERENCES contacts(id),
  client_name TEXT NOT NULL,
  estimate_date TEXT NOT NULL,
  expiry_date TEXT,
  status TEXT NOT NULL DEFAULT 'Draft',   -- Draft | Sent | Accepted | Declined | Invoiced
  subtotal REAL NOT NULL DEFAULT 0,
  tax_percent REAL NOT NULL DEFAULT 5,
  tax REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'AED',
  notes TEXT,
  converted_invoice_id INTEGER,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS estimate_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  estimate_id INTEGER NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  item_id INTEGER,
  description TEXT,
  qty REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  amount REAL NOT NULL DEFAULT 0
);

/* Bills — vendor bills (Purchases). */
CREATE TABLE IF NOT EXISTS bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_number TEXT NOT NULL,
  contact_id INTEGER REFERENCES contacts(id),
  vendor_name TEXT NOT NULL,
  bill_date TEXT NOT NULL,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'Open',     -- Draft | Open | Paid | Partially Paid | Overdue | Cancelled
  subtotal REAL NOT NULL DEFAULT 0,
  tax_percent REAL NOT NULL DEFAULT 5,
  tax REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  amount_paid REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'AED',
  notes TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS bill_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  account_id INTEGER REFERENCES accounts(id),
  description TEXT,
  qty REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  amount REAL NOT NULL DEFAULT 0
);

/* Payments — received (from customers) and made (to vendors). */
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_number TEXT,
  payment_type TEXT NOT NULL,        -- received | made
  contact_id INTEGER REFERENCES contacts(id),
  party_name TEXT,
  payment_date TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  mode TEXT DEFAULT 'bank',          -- cash | card | cheque | bank
  deposit_account_id INTEGER REFERENCES accounts(id),   -- bank/cash account touched
  reference TEXT,
  notes TEXT,
  document_type TEXT,                -- invoice | bill (what it settles)
  document_id INTEGER,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

/* Credit Notes — reduce a customer's receivable. */
CREATE TABLE IF NOT EXISTS credit_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cn_number TEXT NOT NULL,
  contact_id INTEGER REFERENCES contacts(id),
  client_name TEXT NOT NULL,
  cn_date TEXT NOT NULL,
  invoice_id INTEGER,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'Open',
  subtotal REAL NOT NULL DEFAULT 0,
  tax_percent REAL NOT NULL DEFAULT 5,
  tax REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'AED',
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS credit_note_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  credit_note_id INTEGER NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
  description TEXT,
  qty REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  amount REAL NOT NULL DEFAULT 0
);

/* ============================ ZOHO CRM ============================ */

/* CRM Accounts — companies/organisations. */
CREATE TABLE IF NOT EXISTS crm_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  industry TEXT,
  website TEXT,
  phone TEXT,
  billing_city TEXT,
  employees TEXT,
  annual_revenue REAL,
  owner TEXT,
  description TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

/* CRM Contacts — people, optionally linked to a CRM account. */
CREATE TABLE IF NOT EXISTS crm_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT,
  last_name TEXT NOT NULL,
  account_name TEXT,
  title TEXT,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  lead_source TEXT,
  owner TEXT,
  description TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

/* Deals — opportunity pipeline. */
CREATE TABLE IF NOT EXISTS deals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  account_name TEXT,
  contact_name TEXT,
  amount REAL NOT NULL DEFAULT 0,
  stage TEXT NOT NULL DEFAULT 'Qualification',  -- Qualification|Needs Analysis|Proposal|Negotiation|Closed Won|Closed Lost
  probability INTEGER NOT NULL DEFAULT 10,
  closing_date TEXT,
  lead_source TEXT,
  owner TEXT,
  next_step TEXT,
  description TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

/* Tasks — activities across CRM. */
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject TEXT NOT NULL,
  related_to TEXT,                   -- free text: deal / contact / account name
  task_type TEXT DEFAULT 'Call',     -- Call | Email | Meeting | Follow-up | To-Do
  due_date TEXT,
  priority TEXT DEFAULT 'Normal',    -- Low | Normal | High
  status TEXT NOT NULL DEFAULT 'Open',  -- Open | In Progress | Completed | Deferred
  owner TEXT,
  notes TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

/* ============================ MORE ZOHO BOOKS MODULES ============================ */
db.exec(`
/* Sales Orders — confirmed customer orders (non-posting until invoiced). */
CREATE TABLE IF NOT EXISTS sales_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  so_number TEXT NOT NULL,
  contact_id INTEGER REFERENCES contacts(id),
  client_name TEXT NOT NULL,
  so_date TEXT NOT NULL,
  shipment_date TEXT,
  status TEXT NOT NULL DEFAULT 'Draft',   -- Draft | Confirmed | Closed | Invoiced
  subtotal REAL NOT NULL DEFAULT 0,
  tax_percent REAL DEFAULT 5,
  tax REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'AED',
  notes TEXT,
  converted_invoice_id INTEGER,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sales_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sales_order_id INTEGER NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  description TEXT, qty REAL NOT NULL DEFAULT 1, unit_price REAL NOT NULL DEFAULT 0, amount REAL NOT NULL DEFAULT 0
);

/* Purchase Orders — orders you send to vendors (non-posting until billed). */
CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  po_number TEXT NOT NULL,
  contact_id INTEGER REFERENCES contacts(id),
  vendor_name TEXT NOT NULL,
  po_date TEXT NOT NULL,
  delivery_date TEXT,
  status TEXT NOT NULL DEFAULT 'Draft',   -- Draft | Issued | Billed | Cancelled
  subtotal REAL NOT NULL DEFAULT 0,
  tax_percent REAL DEFAULT 5,
  tax REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'AED',
  notes TEXT,
  converted_bill_id INTEGER,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  account_id INTEGER REFERENCES accounts(id),
  description TEXT, qty REAL NOT NULL DEFAULT 1, unit_price REAL NOT NULL DEFAULT 0, amount REAL NOT NULL DEFAULT 0
);

/* Vendor Credits — credit from a vendor (reduces what you owe). */
CREATE TABLE IF NOT EXISTS vendor_credits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vc_number TEXT NOT NULL,
  contact_id INTEGER REFERENCES contacts(id),
  vendor_name TEXT NOT NULL,
  vc_date TEXT NOT NULL,
  bill_id INTEGER,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'Open',
  subtotal REAL NOT NULL DEFAULT 0,
  tax_percent REAL DEFAULT 5,
  tax REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'AED',
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS vendor_credit_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_credit_id INTEGER NOT NULL REFERENCES vendor_credits(id) ON DELETE CASCADE,
  account_id INTEGER REFERENCES accounts(id),
  description TEXT, qty REAL NOT NULL DEFAULT 1, unit_price REAL NOT NULL DEFAULT 0, amount REAL NOT NULL DEFAULT 0
);

/* Recurring Invoices — templates you generate real invoices from. */
CREATE TABLE IF NOT EXISTS recurring_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_name TEXT NOT NULL,
  contact_id INTEGER REFERENCES contacts(id),
  client_name TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'Monthly',   -- Weekly | Monthly | Quarterly | Yearly
  start_date TEXT,
  next_date TEXT,
  status TEXT NOT NULL DEFAULT 'Active',        -- Active | Paused | Stopped
  tax_percent REAL DEFAULT 5,
  subtotal REAL NOT NULL DEFAULT 0,
  tax REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  last_generated TEXT,
  generated_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS recurring_invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recurring_invoice_id INTEGER NOT NULL REFERENCES recurring_invoices(id) ON DELETE CASCADE,
  description TEXT, qty REAL NOT NULL DEFAULT 1, unit_price REAL NOT NULL DEFAULT 0, amount REAL NOT NULL DEFAULT 0
);
`);

/* Delivery Challans — goods sent to a customer (non-posting), convertible to invoice. */
db.exec(`
CREATE TABLE IF NOT EXISTS delivery_challans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dc_number TEXT NOT NULL,
  contact_id INTEGER REFERENCES contacts(id),
  client_name TEXT NOT NULL,
  dc_date TEXT NOT NULL,
  reference TEXT,
  challan_type TEXT DEFAULT 'Job Work',
  status TEXT NOT NULL DEFAULT 'Draft',   -- Draft | Delivered | Invoiced | Returned
  subtotal REAL NOT NULL DEFAULT 0,
  tax_percent REAL DEFAULT 5,
  tax REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'AED',
  notes TEXT,
  converted_invoice_id INTEGER,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS delivery_challan_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  delivery_challan_id INTEGER NOT NULL REFERENCES delivery_challans(id) ON DELETE CASCADE,
  description TEXT, qty REAL NOT NULL DEFAULT 1, unit_price REAL NOT NULL DEFAULT 0, amount REAL NOT NULL DEFAULT 0
);

/* Documents — files/receipts stored in the app. */
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  folder TEXT DEFAULT 'Files',
  notes TEXT,
  uploaded_by TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

/* Time Tracking — projects and timesheet entries. */
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact_id INTEGER REFERENCES contacts(id),
  customer_name TEXT,
  billing_method TEXT DEFAULT 'Based on Project Hours',  -- Fixed Cost | Based on Project Hours | Based on Staff Hours
  rate REAL DEFAULT 0,
  budget_hours REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Active',   -- Active | On Hold | Completed
  description TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  project_name TEXT,
  task TEXT,
  user_name TEXT,
  entry_date TEXT NOT NULL,
  hours REAL NOT NULL DEFAULT 0,
  billable INTEGER DEFAULT 1,
  billed INTEGER DEFAULT 0,
  notes TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

/* App settings — key/value (used by Transaction Locking, etc.) */
db.exec(`CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`);

/* leads → customer conversion link */
const leadCols = db.prepare('PRAGMA table_info(leads)').all().map((c) => c.name);
if (!leadCols.includes('converted_contact_id')) db.exec('ALTER TABLE leads ADD COLUMN converted_contact_id INTEGER');

/* items inventory columns for databases created before they existed */
const itemCols = db.prepare('PRAGMA table_info(items)').all().map((c) => c.name);
for (const [col, ddl] of [['unit', 'unit TEXT'], ['track_inventory', 'track_inventory INTEGER DEFAULT 0'],
  ['opening_stock', 'opening_stock REAL DEFAULT 0'], ['stock_on_hand', 'stock_on_hand REAL DEFAULT 0'],
  ['reorder_level', 'reorder_level REAL DEFAULT 0']]) {
  if (!itemCols.includes(col)) db.exec(`ALTER TABLE items ADD COLUMN ${ddl}`);
}

/* ---- Lightweight migrations for the existing invoices table ---- */
const invCols = db.prepare('PRAGMA table_info(invoices)').all().map((c) => c.name);
if (!invCols.includes('contact_id')) db.exec('ALTER TABLE invoices ADD COLUMN contact_id INTEGER');
if (!invCols.includes('amount_paid')) db.exec('ALTER TABLE invoices ADD COLUMN amount_paid REAL NOT NULL DEFAULT 0');

export default db;
