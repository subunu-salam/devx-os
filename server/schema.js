// Extended schema for DevX OS — Zoho Books (double-entry accounting) + Zoho CRM modules (Postgres).
import db from './db.js';
export default db;

export async function initExtSchema() {
  await db.exec(`
  /* ============================ ZOHO BOOKS ============================ */
  CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    code TEXT, name TEXT NOT NULL, account_type TEXT NOT NULL, account_subtype TEXT,
    description TEXT, is_system INTEGER NOT NULL DEFAULT 0, is_active INTEGER DEFAULT 1,
    opening_balance DOUBLE PRECISION DEFAULT 0, created_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    contact_type TEXT NOT NULL DEFAULT 'customer', display_name TEXT NOT NULL, company_name TEXT,
    email TEXT, phone TEXT, trn TEXT, billing_address TEXT,
    payment_terms TEXT DEFAULT 'Due on Receipt', notes TEXT,
    opening_balance DOUBLE PRECISION DEFAULT 0, is_active INTEGER DEFAULT 1, created_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS items (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL, item_type TEXT NOT NULL DEFAULT 'service', sku TEXT, description TEXT,
    sell_price DOUBLE PRECISION DEFAULT 0, cost_price DOUBLE PRECISION DEFAULT 0, tax_percent DOUBLE PRECISION DEFAULT 5,
    income_account_id INTEGER, expense_account_id INTEGER,
    unit TEXT, track_inventory INTEGER DEFAULT 0, opening_stock DOUBLE PRECISION DEFAULT 0,
    stock_on_hand DOUBLE PRECISION DEFAULT 0, reorder_level DOUBLE PRECISION DEFAULT 0,
    is_active INTEGER DEFAULT 1, created_by INTEGER, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS journals (
    id SERIAL PRIMARY KEY,
    journal_number TEXT, journal_date TEXT NOT NULL, reference TEXT, notes TEXT,
    source_type TEXT NOT NULL DEFAULT 'manual', source_id INTEGER, is_manual INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS journal_lines (
    id SERIAL PRIMARY KEY,
    journal_id INTEGER NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    debit DOUBLE PRECISION NOT NULL DEFAULT 0, credit DOUBLE PRECISION NOT NULL DEFAULT 0,
    description TEXT, contact_id INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_jl_account ON journal_lines(account_id);
  CREATE INDEX IF NOT EXISTS idx_jl_journal ON journal_lines(journal_id);
  CREATE INDEX IF NOT EXISTS idx_j_source ON journals(source_type, source_id);

  CREATE TABLE IF NOT EXISTS estimates (
    id SERIAL PRIMARY KEY,
    estimate_number TEXT NOT NULL, contact_id INTEGER, client_name TEXT NOT NULL,
    estimate_date TEXT NOT NULL, expiry_date TEXT, status TEXT NOT NULL DEFAULT 'Draft',
    subtotal DOUBLE PRECISION NOT NULL DEFAULT 0, tax_percent DOUBLE PRECISION DEFAULT 5,
    tax DOUBLE PRECISION NOT NULL DEFAULT 0, total DOUBLE PRECISION NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'AED', notes TEXT, converted_invoice_id INTEGER, created_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS estimate_items (
    id SERIAL PRIMARY KEY,
    estimate_id INTEGER NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
    item_id INTEGER, description TEXT, qty DOUBLE PRECISION NOT NULL DEFAULT 1,
    unit_price DOUBLE PRECISION NOT NULL DEFAULT 0, amount DOUBLE PRECISION NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS bills (
    id SERIAL PRIMARY KEY,
    bill_number TEXT NOT NULL, contact_id INTEGER, vendor_name TEXT NOT NULL,
    bill_date TEXT NOT NULL, due_date TEXT, status TEXT NOT NULL DEFAULT 'Open',
    subtotal DOUBLE PRECISION NOT NULL DEFAULT 0, tax_percent DOUBLE PRECISION DEFAULT 5,
    tax DOUBLE PRECISION NOT NULL DEFAULT 0, total DOUBLE PRECISION NOT NULL DEFAULT 0,
    amount_paid DOUBLE PRECISION NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'AED', notes TEXT,
    created_by INTEGER, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS bill_items (
    id SERIAL PRIMARY KEY,
    bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    account_id INTEGER, description TEXT, qty DOUBLE PRECISION NOT NULL DEFAULT 1,
    unit_price DOUBLE PRECISION NOT NULL DEFAULT 0, amount DOUBLE PRECISION NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    payment_number TEXT, payment_type TEXT NOT NULL, contact_id INTEGER, party_name TEXT,
    payment_date TEXT NOT NULL, amount DOUBLE PRECISION NOT NULL DEFAULT 0, mode TEXT DEFAULT 'bank',
    deposit_account_id INTEGER, reference TEXT, notes TEXT, document_type TEXT, document_id INTEGER,
    created_by INTEGER, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS credit_notes (
    id SERIAL PRIMARY KEY,
    cn_number TEXT NOT NULL, contact_id INTEGER, client_name TEXT NOT NULL, cn_date TEXT NOT NULL,
    invoice_id INTEGER, reason TEXT, status TEXT NOT NULL DEFAULT 'Open',
    subtotal DOUBLE PRECISION NOT NULL DEFAULT 0, tax_percent DOUBLE PRECISION DEFAULT 5,
    tax DOUBLE PRECISION NOT NULL DEFAULT 0, total DOUBLE PRECISION NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'AED', created_by INTEGER, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS credit_note_items (
    id SERIAL PRIMARY KEY,
    credit_note_id INTEGER NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
    description TEXT, qty DOUBLE PRECISION NOT NULL DEFAULT 1,
    unit_price DOUBLE PRECISION NOT NULL DEFAULT 0, amount DOUBLE PRECISION NOT NULL DEFAULT 0
  );

  /* ============================ ZOHO CRM ============================ */
  CREATE TABLE IF NOT EXISTS crm_accounts (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL, industry TEXT, website TEXT, phone TEXT, billing_city TEXT, employees TEXT,
    annual_revenue DOUBLE PRECISION, owner TEXT, description TEXT, created_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS crm_contacts (
    id SERIAL PRIMARY KEY,
    first_name TEXT, last_name TEXT NOT NULL, account_name TEXT, title TEXT, email TEXT, phone TEXT,
    mobile TEXT, lead_source TEXT, owner TEXT, description TEXT, created_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS deals (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL, account_name TEXT, contact_name TEXT, amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    stage TEXT NOT NULL DEFAULT 'Qualification', probability INTEGER NOT NULL DEFAULT 10,
    closing_date TEXT, lead_source TEXT, owner TEXT, next_step TEXT, description TEXT, created_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    subject TEXT NOT NULL, related_to TEXT, task_type TEXT DEFAULT 'Call', due_date TEXT,
    priority TEXT DEFAULT 'Normal', status TEXT NOT NULL DEFAULT 'Open', owner TEXT, notes TEXT,
    created_by INTEGER, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  /* ============================ MORE BOOKS MODULES ============================ */
  CREATE TABLE IF NOT EXISTS sales_orders (
    id SERIAL PRIMARY KEY,
    so_number TEXT NOT NULL, contact_id INTEGER, client_name TEXT NOT NULL, so_date TEXT NOT NULL,
    shipment_date TEXT, status TEXT NOT NULL DEFAULT 'Draft', subtotal DOUBLE PRECISION NOT NULL DEFAULT 0,
    tax_percent DOUBLE PRECISION DEFAULT 5, tax DOUBLE PRECISION NOT NULL DEFAULT 0, total DOUBLE PRECISION NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'AED', notes TEXT, converted_invoice_id INTEGER, created_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS sales_order_items (
    id SERIAL PRIMARY KEY, sales_order_id INTEGER NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    description TEXT, qty DOUBLE PRECISION NOT NULL DEFAULT 1, unit_price DOUBLE PRECISION NOT NULL DEFAULT 0, amount DOUBLE PRECISION NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS purchase_orders (
    id SERIAL PRIMARY KEY,
    po_number TEXT NOT NULL, contact_id INTEGER, vendor_name TEXT NOT NULL, po_date TEXT NOT NULL,
    delivery_date TEXT, status TEXT NOT NULL DEFAULT 'Draft', subtotal DOUBLE PRECISION NOT NULL DEFAULT 0,
    tax_percent DOUBLE PRECISION DEFAULT 5, tax DOUBLE PRECISION NOT NULL DEFAULT 0, total DOUBLE PRECISION NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'AED', notes TEXT, converted_bill_id INTEGER, created_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS purchase_order_items (
    id SERIAL PRIMARY KEY, purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    account_id INTEGER, description TEXT, qty DOUBLE PRECISION NOT NULL DEFAULT 1, unit_price DOUBLE PRECISION NOT NULL DEFAULT 0, amount DOUBLE PRECISION NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS vendor_credits (
    id SERIAL PRIMARY KEY,
    vc_number TEXT NOT NULL, contact_id INTEGER, vendor_name TEXT NOT NULL, vc_date TEXT NOT NULL,
    bill_id INTEGER, reason TEXT, status TEXT NOT NULL DEFAULT 'Open', subtotal DOUBLE PRECISION NOT NULL DEFAULT 0,
    tax_percent DOUBLE PRECISION DEFAULT 5, tax DOUBLE PRECISION NOT NULL DEFAULT 0, total DOUBLE PRECISION NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'AED', created_by INTEGER, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS vendor_credit_items (
    id SERIAL PRIMARY KEY, vendor_credit_id INTEGER NOT NULL REFERENCES vendor_credits(id) ON DELETE CASCADE,
    account_id INTEGER, description TEXT, qty DOUBLE PRECISION NOT NULL DEFAULT 1, unit_price DOUBLE PRECISION NOT NULL DEFAULT 0, amount DOUBLE PRECISION NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS recurring_invoices (
    id SERIAL PRIMARY KEY,
    profile_name TEXT NOT NULL, contact_id INTEGER, client_name TEXT NOT NULL, frequency TEXT NOT NULL DEFAULT 'Monthly',
    start_date TEXT, next_date TEXT, status TEXT NOT NULL DEFAULT 'Active', tax_percent DOUBLE PRECISION DEFAULT 5,
    subtotal DOUBLE PRECISION NOT NULL DEFAULT 0, tax DOUBLE PRECISION NOT NULL DEFAULT 0, total DOUBLE PRECISION NOT NULL DEFAULT 0,
    last_generated TEXT, generated_count INTEGER NOT NULL DEFAULT 0, notes TEXT, created_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS recurring_invoice_items (
    id SERIAL PRIMARY KEY, recurring_invoice_id INTEGER NOT NULL REFERENCES recurring_invoices(id) ON DELETE CASCADE,
    description TEXT, qty DOUBLE PRECISION NOT NULL DEFAULT 1, unit_price DOUBLE PRECISION NOT NULL DEFAULT 0, amount DOUBLE PRECISION NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS delivery_challans (
    id SERIAL PRIMARY KEY,
    dc_number TEXT NOT NULL, contact_id INTEGER, client_name TEXT NOT NULL, dc_date TEXT NOT NULL,
    reference TEXT, challan_type TEXT DEFAULT 'Job Work', status TEXT NOT NULL DEFAULT 'Draft',
    subtotal DOUBLE PRECISION NOT NULL DEFAULT 0, tax_percent DOUBLE PRECISION DEFAULT 5, tax DOUBLE PRECISION NOT NULL DEFAULT 0,
    total DOUBLE PRECISION NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'AED', notes TEXT,
    converted_invoice_id INTEGER, created_by INTEGER, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS delivery_challan_items (
    id SERIAL PRIMARY KEY, delivery_challan_id INTEGER NOT NULL REFERENCES delivery_challans(id) ON DELETE CASCADE,
    description TEXT, qty DOUBLE PRECISION NOT NULL DEFAULT 1, unit_price DOUBLE PRECISION NOT NULL DEFAULT 0, amount DOUBLE PRECISION NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL, file_url TEXT NOT NULL, file_type TEXT, folder TEXT DEFAULT 'Files', notes TEXT,
    uploaded_by TEXT, created_by INTEGER, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL, contact_id INTEGER, customer_name TEXT, billing_method TEXT DEFAULT 'Based on Project Hours',
    rate DOUBLE PRECISION DEFAULT 0, budget_hours DOUBLE PRECISION DEFAULT 0, status TEXT NOT NULL DEFAULT 'Active',
    description TEXT, created_by INTEGER, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS time_entries (
    id SERIAL PRIMARY KEY, project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    project_name TEXT, task TEXT, user_name TEXT, entry_date TEXT NOT NULL, hours DOUBLE PRECISION NOT NULL DEFAULT 0,
    billable INTEGER DEFAULT 1, billed INTEGER DEFAULT 0, notes TEXT, created_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY, value TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  `);
}
