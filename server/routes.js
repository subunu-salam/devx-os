// Registers all API routes.
import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import db from './db.js';
import { UPLOAD_DIR } from './db.js';
import { requireAuth, requireAdmin, requireSuper } from './auth.js';
import { logActivity } from './activity.js';
import { crudRouter } from './crud.js';
import { postJournal, deleteJournalsFor, idByCode, CODES, profitAndLoss, arAging, apAging, vatSummary, balanceSheet, expenseCategoryToCode, nextNumber } from './accounting.js';
import { postInvoiceJournal } from './routes_ext.js';

// ---- File uploads (receipts / attachments) ----
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${Math.round(Math.random() * 1e6)}_${safe}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

export function registerRoutes(app) {
  // Serve uploaded files (auth-protected)
  app.get('/uploads/:name', requireAuth, (req, res) => {
    const p = path.join(UPLOAD_DIR, path.basename(req.params.name));
    if (!fs.existsSync(p)) return res.status(404).send('Not found');
    res.sendFile(p);
  });

  app.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    res.json({ url: `/uploads/${req.file.filename}`, name: req.file.originalname });
  });

  // ---- Standard CRUD resources ----
  crudRouter(app, {
    base: '/api/meetings', table: 'meetings', entity: 'meeting',
    fields: ['meeting_date', 'meeting_time', 'client_name', 'business_category', 'meeting_type', 'meeting_mode', 'confirmed_by', 'status', 'remarks'],
    orderBy: 'meeting_date DESC, id DESC',
    label: (r) => r.client_name,
  });

  crudRouter(app, {
    base: '/api/expenses', table: 'expenses', entity: 'expense',
    fields: ['expense_date', 'person', 'category', 'other_details', 'amount', 'description', 'receipt_url', 'month'],
    orderBy: 'expense_date DESC, id DESC',
    label: (r) => `${r.category} — AED ${r.amount}`,
    afterWrite: (row, action) => postExpenseJournal(row, action),
  });

  crudRouter(app, {
    base: '/api/ledger', table: 'ledger_entries', entity: 'ledger entry',
    fields: ['entry_date', 'type', 'category', 'description', 'amount', 'party', 'method', 'reference', 'attachment_url'],
    orderBy: 'entry_date DESC, id DESC',
    label: (r) => `${r.type} AED ${r.amount}`,
  });

  crudRouter(app, {
    base: '/api/leads', table: 'leads', entity: 'lead',
    fields: ['name', 'business_category', 'status', 'source', 'notes', 'next_action', 'next_action_date'],
    orderBy: 'id DESC',
    label: (r) => r.name,
  });

  // ---- Invoices (with line items) ----
  app.get('/api/invoices', requireAuth, (req, res) => {
    const rows = db.prepare('SELECT * FROM invoices ORDER BY id DESC').all();
    res.json(rows);
  });

  app.get('/api/invoices/:id', requireAuth, (req, res) => {
    const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Not found' });
    inv.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(inv.id);
    res.json(inv);
  });

  app.post('/api/invoices', requireAuth, (req, res) => {
    const b = req.body || {};
    const items = Array.isArray(b.items) ? b.items : [];
    const subtotal = items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.unit_price || 0), 0);
    const taxPercent = Number(b.tax_percent || 0);
    const tax = +(subtotal * taxPercent / 100).toFixed(2);
    const total = +(subtotal + tax).toFixed(2);
    const number = b.invoice_number || nextInvoiceNumber();
    const info = db.prepare(`
      INSERT INTO invoices (invoice_number, client_name, contact_id, issue_date, due_date, status, subtotal, tax_percent, tax, total, currency, notes, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      number, b.client_name || 'Client', b.contact_id || null, b.issue_date || today(), b.due_date || null,
      b.status || 'Draft', subtotal, taxPercent, tax, total, b.currency || 'AED', b.notes || null, req.user.id);
    const invId = info.lastInsertRowid;
    const insItem = db.prepare('INSERT INTO invoice_items (invoice_id, description, qty, unit_price, amount) VALUES (?,?,?,?,?)');
    for (const it of items) {
      const amount = +(Number(it.qty || 0) * Number(it.unit_price || 0)).toFixed(2);
      insItem.run(invId, it.description || '', Number(it.qty || 0), Number(it.unit_price || 0), amount);
    }
    const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invId);
    inv.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(invId);
    postInvoiceJournal(inv, req.user);   // post to the double-entry ledger (unless Draft/Cancelled)
    logActivity(req.user, 'create', 'invoice', invId, `Created invoice ${number} for ${inv.client_name}`);
    res.status(201).json(inv);
  });

  app.put('/api/invoices/:id', requireAuth, (req, res) => {
    const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Not found' });
    const b = req.body || {};
    // Status-only quick update (Mark Sent / Mark Paid)
    if (b.status && Object.keys(b).length <= 2) {
      const wasPosted = inv.status !== 'Draft' && inv.status !== 'Cancelled';
      const nowPosted = b.status !== 'Draft' && b.status !== 'Cancelled';
      db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run(b.status, inv.id);
      // Ensure the invoice's AR journal exists when it becomes a live invoice, and is removed if voided.
      if (!wasPosted && nowPosted) postInvoiceJournal({ ...inv, status: b.status }, req.user);
      if (wasPosted && !nowPosted) deleteJournalsFor('invoice', inv.id);

      // Mark Paid → record a real payment: Dr Bank, Cr Accounts Receivable.
      if (b.status === 'Paid' && (inv.amount_paid || 0) < inv.total - 0.005) {
        const bal = +(inv.total - (inv.amount_paid || 0)).toFixed(2);
        const number = payNumber();
        const info = db.prepare(`INSERT INTO payments
          (payment_number, payment_type, contact_id, party_name, payment_date, amount, mode, deposit_account_id, reference, document_type, document_id, created_by)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
          number, 'received', inv.contact_id || null, inv.client_name, today(), bal, 'bank', idByCode(CODES.BANK), inv.invoice_number, 'invoice', inv.id, req.user.id);
        postJournal({ journal_date: today(), reference: number, notes: `Payment for ${inv.invoice_number}`, source_type: 'payment', source_id: info.lastInsertRowid },
          [{ code: CODES.BANK, debit: bal, credit: 0, description: inv.client_name },
           { code: CODES.AR, debit: 0, credit: bal, description: inv.client_name, contact_id: inv.contact_id }], req.user);
        db.prepare('UPDATE invoices SET amount_paid = total WHERE id = ?').run(inv.id);
      }
      const updated = db.prepare('SELECT * FROM invoices WHERE id = ?').get(inv.id);
      logActivity(req.user, 'update', 'invoice', inv.id, `Marked invoice ${inv.invoice_number} as ${b.status}`);
      return res.json(updated);
    }
    const items = Array.isArray(b.items) ? b.items : null;
    let subtotal = inv.subtotal, tax = inv.tax, total = inv.total;
    if (items) {
      subtotal = items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.unit_price || 0), 0);
    }
    const taxPercent = b.tax_percent !== undefined ? Number(b.tax_percent) : inv.tax_percent;
    tax = +(subtotal * taxPercent / 100).toFixed(2);
    total = +(subtotal + tax).toFixed(2);
    db.prepare(`UPDATE invoices SET client_name=?, issue_date=?, due_date=?, status=?, subtotal=?, tax_percent=?, tax=?, total=?, notes=? WHERE id=?`).run(
      b.client_name ?? inv.client_name, b.issue_date ?? inv.issue_date, b.due_date ?? inv.due_date,
      b.status ?? inv.status, subtotal, taxPercent, tax, total, b.notes ?? inv.notes, inv.id);
    if (items) {
      db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(inv.id);
      const insItem = db.prepare('INSERT INTO invoice_items (invoice_id, description, qty, unit_price, amount) VALUES (?,?,?,?,?)');
      for (const it of items) {
        const amount = +(Number(it.qty || 0) * Number(it.unit_price || 0)).toFixed(2);
        insItem.run(inv.id, it.description || '', Number(it.qty || 0), Number(it.unit_price || 0), amount);
      }
    }
    const updated = db.prepare('SELECT * FROM invoices WHERE id = ?').get(inv.id);
    updated.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(inv.id);
    // Re-post the AR journal to reflect edited amounts / status.
    deleteJournalsFor('invoice', inv.id);
    postInvoiceJournal(updated, req.user);
    logActivity(req.user, 'update', 'invoice', inv.id, `Updated invoice ${inv.invoice_number}`);
    res.json(updated);
  });

  app.delete('/api/invoices/:id', requireAuth, requireAdmin, (req, res) => {
    const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Not found' });
    deleteJournalsFor('invoice', inv.id);
    db.prepare('DELETE FROM payments WHERE document_type = ? AND document_id = ?').run('invoice', inv.id);
    db.prepare('DELETE FROM invoices WHERE id = ?').run(inv.id);
    logActivity(req.user, 'delete', 'invoice', inv.id, `Deleted invoice ${inv.invoice_number}`);
    res.json({ ok: true });
  });

  // ---- Activity logs (admin only) ----
  app.get('/api/activity', requireAuth, requireAdmin, (req, res) => {
    const rows = db.prepare('SELECT * FROM activity_logs ORDER BY id DESC LIMIT 500').all();
    res.json(rows);
  });

  // ---- Team members (names only — used for dropdowns; NO credentials exposed) ----
  app.get('/api/users', requireAuth, (req, res) => {
    const rows = db.prepare('SELECT id, full_name, title, role FROM users ORDER BY id').all();
    res.json(rows);
  });

  // ---- User management — SUPER ADMIN ONLY (full credentials + edit/reset password) ----
  app.get('/api/admin/users', requireAuth, requireSuper, (req, res) => {
    res.json(db.prepare('SELECT id, full_name, email, title, role, is_super, created_at FROM users ORDER BY id').all());
  });

  app.put('/api/admin/users/:id', requireAuth, requireSuper, (req, res) => {
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!u) return res.status(404).json({ error: 'Not found' });
    const b = req.body || {};
    if (b.new_password !== undefined && b.new_password !== '') {
      if (String(b.new_password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(b.new_password, 10), u.id);
      logActivity(req.user, 'update', 'user', u.id, `Reset password for ${u.full_name}`);
    }
    db.prepare('UPDATE users SET full_name = ?, title = ?, role = ? WHERE id = ?').run(
      b.full_name ?? u.full_name, b.title ?? u.title, b.role ?? u.role, u.id);
    logActivity(req.user, 'update', 'user', u.id, `Updated team member ${b.full_name ?? u.full_name}`);
    res.json(db.prepare('SELECT id, full_name, email, title, role, is_super FROM users WHERE id = ?').get(u.id));
  });

  // ---- Dashboard summary ----
  app.get('/api/dashboard', requireAuth, (req, res) => {
    const month = today().slice(0, 7);
    const q = (sql, ...a) => db.prepare(sql).get(...a);
    const totalMeetings = q('SELECT COUNT(*) n FROM meetings').n;
    const monthMeetings = q("SELECT COUNT(*) n FROM meetings WHERE substr(meeting_date,1,7)=?", month).n;
    const completed = q("SELECT COUNT(*) n FROM meetings WHERE status='Completed'").n;
    const pending = q("SELECT COUNT(*) n FROM meetings WHERE status='Pending'").n;
    const totalExpenses = q('SELECT COALESCE(SUM(amount),0) s FROM expenses').s;
    const monthExpenses = q("SELECT COALESCE(SUM(amount),0) s FROM expenses WHERE substr(expense_date,1,7)=?", month).s;
    const pl = profitAndLoss({});
    const bs = balanceSheet({});
    const ar = arAging({});
    const ap = apAging({});
    const vat = vatSummary({});
    const credit = pl.totalIncome;
    const debit = pl.totalExpense;
    const netPosition = bs.totalEquity;          // net worth (net cash position)
    const netProfit = pl.netProfit;
    const receivables = ar.total;
    const payables = ap.total;
    const vatPayable = vat.netPayable;
    const cashBank = bs.assets.filter((a) => ['1000', '1001', '1010'].includes(a.code)).reduce((s, a) => s + a.amount, 0);
    const leads = q('SELECT COUNT(*) n FROM leads').n;
    const wonLeads = q("SELECT COUNT(*) n FROM leads WHERE status='Won'").n;
    const interestedLeads = q("SELECT COUNT(*) n FROM leads WHERE status IN ('Interested','Won')").n;
    const openDeals = q("SELECT COUNT(*) n FROM deals WHERE stage NOT IN ('Closed Won','Closed Lost')").n;
    const pipelineValue = q("SELECT COALESCE(SUM(amount),0) s FROM deals WHERE stage NOT IN ('Closed Won','Closed Lost')").s;
    const outstanding = ar.total;

    const expenseByMonth = db.prepare(`
      SELECT substr(expense_date,1,7) ym, SUM(amount) total FROM expenses GROUP BY ym ORDER BY ym`).all();
    const expenseByCategory = db.prepare(`
      SELECT category, SUM(amount) total FROM expenses GROUP BY category ORDER BY total DESC`).all();
    const expenseByPerson = db.prepare(`
      SELECT person, SUM(amount) total FROM expenses GROUP BY person ORDER BY total DESC`).all();
    const meetingsByStatus = db.prepare(`
      SELECT status, COUNT(*) n FROM meetings GROUP BY status`).all();
    const recentMeetings = db.prepare('SELECT * FROM meetings ORDER BY meeting_date DESC, id DESC LIMIT 6').all();
    const recentExpenses = db.prepare('SELECT * FROM expenses ORDER BY expense_date DESC, id DESC LIMIT 6').all();

    res.json({
      kpi: { totalMeetings, monthMeetings, completed, pending, totalExpenses, monthExpenses,
             credit, debit, netPosition, netProfit, receivables, payables, vatPayable, cashBank,
             leads, wonLeads, interestedLeads, openDeals, pipelineValue, outstanding },
      charts: { expenseByMonth, expenseByCategory, expenseByPerson, meetingsByStatus },
      recentMeetings, recentExpenses,
    });
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function payNumber() {
  return nextNumber('PAYR', 'payments', 'payment_number');
}

// Keep the double-entry ledger in sync with the Expense tracker.
function postExpenseJournal(row, action) {
  try {
    deleteJournalsFor('expense', row.id);
    if (action === 'delete') return;
    const code = expenseCategoryToCode(row.category, row.other_details);
    postJournal(
      { journal_date: row.expense_date, reference: row.other_details || row.category, notes: `Expense — ${row.category}`, source_type: 'expense', source_id: row.id },
      [
        { code, debit: row.amount, credit: 0, description: row.other_details || row.category },
        { code: CODES.BANK, debit: 0, credit: row.amount, description: `Paid by ${row.person}` },
      ], { id: row.created_by });
  } catch (e) { console.error('expense journal failed:', e.message); }
}

function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  const row = db.prepare("SELECT COUNT(*) n FROM invoices WHERE invoice_number LIKE ?").get(`DEVX-${year}-%`);
  const seq = String((row?.n || 0) + 1).padStart(3, '0');
  return `DEVX-${year}-${seq}`;
}
