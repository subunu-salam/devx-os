// Extended API routes — Zoho Books (accounting) + Zoho CRM modules.
import db from './schema.js';
import { requireAuth, requireAdmin } from './auth.js';
import { logActivity } from './activity.js';
import { crudRouter } from './crud.js';
import {
  postJournal, deleteJournalsFor, nextNumber, idByCode, CODES,
  trialBalance, profitAndLoss, balanceSheet, generalLedger, arAging, apAging, vatSummary,
  getSetting, setSetting,
} from './accounting.js';

const today = () => new Date().toISOString().slice(0, 10);
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v) => Number(v || 0);

/* Compute subtotal/tax/total from line items + tax %. */
function totalsOf(items, taxPercent) {
  const subtotal = round2(items.reduce((s, it) => s + num(it.qty) * num(it.unit_price), 0));
  const tax = round2(subtotal * num(taxPercent) / 100);
  return { subtotal, tax, total: round2(subtotal + tax) };
}

export function registerExtRoutes(app) {
  /* ============================ CHART OF ACCOUNTS ============================ */
  // Custom delete first so it wins over the generic crudRouter delete.
  app.delete('/api/accounts/:id', requireAuth, requireAdmin, (req, res) => {
    const a = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
    if (!a) return res.status(404).json({ error: 'Not found' });
    if (a.is_system) return res.status(400).json({ error: 'System accounts cannot be deleted' });
    const used = db.prepare('SELECT COUNT(*) n FROM journal_lines WHERE account_id = ?').get(a.id).n;
    if (used) return res.status(400).json({ error: 'Account has transactions — deactivate it instead' });
    db.prepare('DELETE FROM accounts WHERE id = ?').run(a.id);
    logActivity(req.user, 'delete', 'account', a.id, `Deleted account ${a.name}`);
    res.json({ ok: true });
  });
  crudRouter(app, {
    base: '/api/accounts', table: 'accounts', entity: 'account',
    fields: ['code', 'name', 'account_type', 'account_subtype', 'description', 'is_active', 'opening_balance'],
    orderBy: 'code', label: (r) => r.name,
  });

  /* ============================ CONTACTS (customers / vendors) ============================ */
  crudRouter(app, {
    base: '/api/contacts', table: 'contacts', entity: 'contact',
    fields: ['contact_type', 'display_name', 'company_name', 'email', 'phone', 'trn', 'billing_address', 'payment_terms', 'notes', 'opening_balance', 'is_active'],
    orderBy: 'display_name', label: (r) => r.display_name,
  });

  /* ============================ ITEMS ============================ */
  crudRouter(app, {
    base: '/api/items', table: 'items', entity: 'item',
    fields: ['name', 'item_type', 'sku', 'description', 'sell_price', 'cost_price', 'tax_percent', 'income_account_id', 'expense_account_id',
             'unit', 'track_inventory', 'opening_stock', 'stock_on_hand', 'reorder_level', 'is_active'],
    orderBy: 'name', label: (r) => r.name,
    afterWrite: (row, action) => { if (action === 'create' && row.track_inventory && !row.stock_on_hand && row.opening_stock) db.prepare('UPDATE items SET stock_on_hand = opening_stock WHERE id = ?').run(row.id); },
  });

  /* ============================ ESTIMATES ============================ */
  app.get('/api/estimates', requireAuth, (req, res) =>
    res.json(db.prepare('SELECT * FROM estimates ORDER BY id DESC').all()));

  app.get('/api/estimates/:id', requireAuth, (req, res) => {
    const e = db.prepare('SELECT * FROM estimates WHERE id = ?').get(req.params.id);
    if (!e) return res.status(404).json({ error: 'Not found' });
    e.items = db.prepare('SELECT * FROM estimate_items WHERE estimate_id = ?').all(e.id);
    res.json(e);
  });

  app.post('/api/estimates', requireAuth, (req, res) => {
    const b = req.body || {};
    const items = Array.isArray(b.items) ? b.items : [];
    const { subtotal, tax, total } = totalsOf(items, b.tax_percent);
    const number = b.estimate_number || nextNumber('EST', 'estimates', 'estimate_number');
    const info = db.prepare(`INSERT INTO estimates
      (estimate_number, contact_id, client_name, estimate_date, expiry_date, status, subtotal, tax_percent, tax, total, currency, notes, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      number, b.contact_id || null, b.client_name || 'Client', b.estimate_date || today(), b.expiry_date || null,
      b.status || 'Draft', subtotal, num(b.tax_percent), tax, total, 'AED', b.notes || null, req.user.id);
    saveLineItems('estimate_items', 'estimate_id', info.lastInsertRowid, items);
    logActivity(req.user, 'create', 'estimate', info.lastInsertRowid, `Created estimate ${number}`);
    res.status(201).json(getEstimate(info.lastInsertRowid));
  });

  app.put('/api/estimates/:id', requireAuth, (req, res) => {
    const e = db.prepare('SELECT * FROM estimates WHERE id = ?').get(req.params.id);
    if (!e) return res.status(404).json({ error: 'Not found' });
    const b = req.body || {};
    const items = Array.isArray(b.items) ? b.items : db.prepare('SELECT * FROM estimate_items WHERE estimate_id = ?').all(e.id);
    const { subtotal, tax, total } = totalsOf(items, b.tax_percent ?? e.tax_percent);
    db.prepare(`UPDATE estimates SET contact_id=?, client_name=?, estimate_date=?, expiry_date=?, status=?, subtotal=?, tax_percent=?, tax=?, total=?, notes=? WHERE id=?`).run(
      b.contact_id ?? e.contact_id, b.client_name ?? e.client_name, b.estimate_date ?? e.estimate_date, b.expiry_date ?? e.expiry_date,
      b.status ?? e.status, subtotal, num(b.tax_percent ?? e.tax_percent), tax, total, b.notes ?? e.notes, e.id);
    if (Array.isArray(b.items)) saveLineItems('estimate_items', 'estimate_id', e.id, items);
    logActivity(req.user, 'update', 'estimate', e.id, `Updated estimate ${e.estimate_number}`);
    res.json(getEstimate(e.id));
  });

  app.delete('/api/estimates/:id', requireAuth, requireAdmin, (req, res) => {
    const e = db.prepare('SELECT * FROM estimates WHERE id = ?').get(req.params.id);
    if (!e) return res.status(404).json({ error: 'Not found' });
    db.prepare('DELETE FROM estimates WHERE id = ?').run(e.id);
    logActivity(req.user, 'delete', 'estimate', e.id, `Deleted estimate ${e.estimate_number}`);
    res.json({ ok: true });
  });

  // Convert an estimate → invoice.
  app.post('/api/estimates/:id/convert', requireAuth, (req, res) => {
    const e = getEstimate(req.params.id);
    if (!e) return res.status(404).json({ error: 'Not found' });
    if (e.converted_invoice_id) return res.status(400).json({ error: 'Already converted' });
    const number = nextInvoiceNumber();
    const info = db.prepare(`INSERT INTO invoices
      (invoice_number, client_name, contact_id, issue_date, due_date, status, subtotal, tax_percent, tax, total, currency, notes, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      number, e.client_name, e.contact_id, today(), null, 'Sent', e.subtotal, e.tax_percent, e.tax, e.total, 'AED', e.notes, req.user.id);
    const invId = info.lastInsertRowid;
    const ins = db.prepare('INSERT INTO invoice_items (invoice_id, description, qty, unit_price, amount) VALUES (?,?,?,?,?)');
    for (const it of e.items) ins.run(invId, it.description, it.qty, it.unit_price, round2(it.qty * it.unit_price));
    db.prepare("UPDATE estimates SET status='Invoiced', converted_invoice_id=? WHERE id=?").run(invId, e.id);
    postInvoiceJournal(getInvoice(invId), req.user);
    logActivity(req.user, 'create', 'invoice', invId, `Converted estimate ${e.estimate_number} → invoice ${number}`);
    res.status(201).json(getInvoice(invId));
  });

  /* ============================ BILLS (vendor bills) ============================ */
  app.get('/api/bills', requireAuth, (req, res) =>
    res.json(db.prepare('SELECT * FROM bills ORDER BY id DESC').all()));

  app.get('/api/bills/:id', requireAuth, (req, res) => {
    const bill = getBill(req.params.id);
    if (!bill) return res.status(404).json({ error: 'Not found' });
    res.json(bill);
  });

  app.post('/api/bills', requireAuth, (req, res) => {
    const b = req.body || {};
    const items = Array.isArray(b.items) ? b.items : [];
    const { subtotal, tax, total } = totalsOf(items, b.tax_percent);
    const number = b.bill_number || nextNumber('BILL', 'bills', 'bill_number');
    const info = db.prepare(`INSERT INTO bills
      (bill_number, contact_id, vendor_name, bill_date, due_date, status, subtotal, tax_percent, tax, total, currency, notes, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      number, b.contact_id || null, b.vendor_name || 'Vendor', b.bill_date || today(), b.due_date || null,
      b.status || 'Open', subtotal, num(b.tax_percent), tax, total, 'AED', b.notes || null, req.user.id);
    const billId = info.lastInsertRowid;
    saveBillItems(billId, items);
    postBillJournal(getBill(billId), req.user);
    logActivity(req.user, 'create', 'bill', billId, `Created bill ${number} for ${b.vendor_name}`);
    res.status(201).json(getBill(billId));
  });

  app.put('/api/bills/:id', requireAuth, (req, res) => {
    const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(req.params.id);
    if (!bill) return res.status(404).json({ error: 'Not found' });
    const b = req.body || {};
    const items = Array.isArray(b.items) ? b.items : db.prepare('SELECT * FROM bill_items WHERE bill_id = ?').all(bill.id);
    const { subtotal, tax, total } = totalsOf(items, b.tax_percent ?? bill.tax_percent);
    db.prepare(`UPDATE bills SET contact_id=?, vendor_name=?, bill_date=?, due_date=?, status=?, subtotal=?, tax_percent=?, tax=?, total=?, notes=? WHERE id=?`).run(
      b.contact_id ?? bill.contact_id, b.vendor_name ?? bill.vendor_name, b.bill_date ?? bill.bill_date, b.due_date ?? bill.due_date,
      b.status ?? bill.status, subtotal, num(b.tax_percent ?? bill.tax_percent), tax, total, b.notes ?? bill.notes, bill.id);
    if (Array.isArray(b.items)) saveBillItems(bill.id, items);
    deleteJournalsFor('bill', bill.id);
    postBillJournal(getBill(bill.id), req.user);
    logActivity(req.user, 'update', 'bill', bill.id, `Updated bill ${bill.bill_number}`);
    res.json(getBill(bill.id));
  });

  app.delete('/api/bills/:id', requireAuth, requireAdmin, (req, res) => {
    const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(req.params.id);
    if (!bill) return res.status(404).json({ error: 'Not found' });
    deleteJournalsFor('bill', bill.id);
    db.prepare('DELETE FROM bills WHERE id = ?').run(bill.id);
    logActivity(req.user, 'delete', 'bill', bill.id, `Deleted bill ${bill.bill_number}`);
    res.json({ ok: true });
  });

  /* ============================ PAYMENTS (received / made) ============================ */
  app.get('/api/payments', requireAuth, (req, res) => {
    const type = req.query.type;
    const rows = type
      ? db.prepare('SELECT * FROM payments WHERE payment_type = ? ORDER BY id DESC').all(type)
      : db.prepare('SELECT * FROM payments ORDER BY id DESC').all();
    res.json(rows);
  });

  app.post('/api/payments', requireAuth, (req, res) => {
    const b = req.body || {};
    const type = b.payment_type === 'made' ? 'made' : 'received';
    const amount = round2(b.amount);
    if (amount <= 0) return res.status(400).json({ error: 'Amount must be positive' });
    const depositId = b.deposit_account_id || idByCode(b.mode === 'cash' ? CODES.PETTY_CASH : CODES.BANK);
    const number = nextNumber(type === 'made' ? 'PAYM' : 'PAYR', 'payments', 'payment_number');
    const info = db.prepare(`INSERT INTO payments
      (payment_number, payment_type, contact_id, party_name, payment_date, amount, mode, deposit_account_id, reference, notes, document_type, document_id, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      number, type, b.contact_id || null, b.party_name || null, b.payment_date || today(), amount,
      b.mode || 'bank', depositId, b.reference || null, b.notes || null, b.document_type || null, b.document_id || null, req.user.id);
    const payId = info.lastInsertRowid;

    if (type === 'received') {
      // Dr Bank/Cash, Cr Accounts Receivable
      postJournal({ journal_date: b.payment_date || today(), reference: number, notes: 'Payment received', source_type: 'payment', source_id: payId },
        [{ account_id: depositId, debit: amount, credit: 0, description: b.party_name },
         { code: CODES.AR, debit: 0, credit: amount, description: b.party_name, contact_id: b.contact_id }], req.user);
      if (b.document_type === 'invoice' && b.document_id) applyToInvoice(b.document_id, amount);
    } else {
      // Dr Accounts Payable, Cr Bank/Cash
      postJournal({ journal_date: b.payment_date || today(), reference: number, notes: 'Payment made', source_type: 'payment', source_id: payId },
        [{ code: CODES.AP, debit: amount, credit: 0, description: b.party_name, contact_id: b.contact_id },
         { account_id: depositId, debit: 0, credit: amount, description: b.party_name }], req.user);
      if (b.document_type === 'bill' && b.document_id) applyToBill(b.document_id, amount);
    }
    logActivity(req.user, 'create', 'payment', payId, `Recorded ${type} payment ${number} — AED ${amount}`);
    res.status(201).json(db.prepare('SELECT * FROM payments WHERE id = ?').get(payId));
  });

  app.delete('/api/payments/:id', requireAuth, requireAdmin, (req, res) => {
    const p = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    deleteJournalsFor('payment', p.id);
    if (p.document_type === 'invoice' && p.document_id) applyToInvoice(p.document_id, -p.amount);
    if (p.document_type === 'bill' && p.document_id) applyToBill(p.document_id, -p.amount);
    db.prepare('DELETE FROM payments WHERE id = ?').run(p.id);
    logActivity(req.user, 'delete', 'payment', p.id, `Deleted payment ${p.payment_number}`);
    res.json({ ok: true });
  });

  /* ============================ CREDIT NOTES ============================ */
  app.get('/api/credit-notes', requireAuth, (req, res) =>
    res.json(db.prepare('SELECT * FROM credit_notes ORDER BY id DESC').all()));

  app.get('/api/credit-notes/:id', requireAuth, (req, res) => {
    const cn = db.prepare('SELECT * FROM credit_notes WHERE id = ?').get(req.params.id);
    if (!cn) return res.status(404).json({ error: 'Not found' });
    cn.items = db.prepare('SELECT * FROM credit_note_items WHERE credit_note_id = ?').all(cn.id);
    res.json(cn);
  });

  app.post('/api/credit-notes', requireAuth, (req, res) => {
    const b = req.body || {};
    const items = Array.isArray(b.items) ? b.items : [];
    const { subtotal, tax, total } = totalsOf(items, b.tax_percent);
    const number = b.cn_number || nextNumber('CN', 'credit_notes', 'cn_number');
    const info = db.prepare(`INSERT INTO credit_notes
      (cn_number, contact_id, client_name, cn_date, invoice_id, reason, status, subtotal, tax_percent, tax, total, currency, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      number, b.contact_id || null, b.client_name || 'Client', b.cn_date || today(), b.invoice_id || null,
      b.reason || null, 'Open', subtotal, num(b.tax_percent), tax, total, 'AED', req.user.id);
    const cnId = info.lastInsertRowid;
    saveLineItems('credit_note_items', 'credit_note_id', cnId, items);
    // Dr Sales (reduce income), Dr Output VAT, Cr Accounts Receivable
    postJournal({ journal_date: b.cn_date || today(), reference: number, notes: `Credit note — ${b.reason || ''}`, source_type: 'credit_note', source_id: cnId },
      [{ code: CODES.SALES, debit: subtotal, credit: 0, description: b.client_name },
       { code: CODES.OUTPUT_VAT, debit: tax, credit: 0, description: 'VAT reversed' },
       { code: CODES.AR, debit: 0, credit: total, description: b.client_name, contact_id: b.contact_id }], req.user);
    logActivity(req.user, 'create', 'credit_note', cnId, `Created credit note ${number}`);
    const cn = db.prepare('SELECT * FROM credit_notes WHERE id = ?').get(cnId);
    cn.items = db.prepare('SELECT * FROM credit_note_items WHERE credit_note_id = ?').all(cnId);
    res.status(201).json(cn);
  });

  app.delete('/api/credit-notes/:id', requireAuth, requireAdmin, (req, res) => {
    const cn = db.prepare('SELECT * FROM credit_notes WHERE id = ?').get(req.params.id);
    if (!cn) return res.status(404).json({ error: 'Not found' });
    deleteJournalsFor('credit_note', cn.id);
    db.prepare('DELETE FROM credit_notes WHERE id = ?').run(cn.id);
    logActivity(req.user, 'delete', 'credit_note', cn.id, `Deleted credit note ${cn.cn_number}`);
    res.json({ ok: true });
  });

  /* ============================ MANUAL JOURNALS ============================ */
  app.get('/api/journals', requireAuth, (req, res) => {
    const rows = db.prepare(`SELECT j.*,
      (SELECT COALESCE(SUM(debit),0) FROM journal_lines WHERE journal_id = j.id) total
      FROM journals j ORDER BY j.journal_date DESC, j.id DESC LIMIT 500`).all();
    res.json(rows);
  });

  app.get('/api/journals/:id', requireAuth, (req, res) => {
    const j = db.prepare('SELECT * FROM journals WHERE id = ?').get(req.params.id);
    if (!j) return res.status(404).json({ error: 'Not found' });
    j.lines = db.prepare(`SELECT jl.*, a.name account_name, a.code account_code
      FROM journal_lines jl JOIN accounts a ON a.id = jl.account_id WHERE jl.journal_id = ?`).all(j.id);
    res.json(j);
  });

  app.post('/api/journals', requireAuth, (req, res) => {
    const b = req.body || {};
    try {
      const jid = postJournal(
        { journal_date: b.journal_date || today(), reference: b.reference, notes: b.notes, source_type: 'manual', is_manual: 1 },
        b.lines || [], req.user);
      logActivity(req.user, 'create', 'journal', jid, `Posted manual journal`);
      res.status(201).json({ id: jid });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  app.delete('/api/journals/:id', requireAuth, requireAdmin, (req, res) => {
    const j = db.prepare('SELECT * FROM journals WHERE id = ?').get(req.params.id);
    if (!j) return res.status(404).json({ error: 'Not found' });
    if (!j.is_manual) return res.status(400).json({ error: 'Only manual journals can be deleted here — edit the source document instead' });
    db.prepare('DELETE FROM journals WHERE id = ?').run(j.id);
    logActivity(req.user, 'delete', 'journal', j.id, `Deleted manual journal ${j.journal_number}`);
    res.json({ ok: true });
  });

  /* ============================ REPORTS ============================ */
  app.get('/api/reports/trial-balance', requireAuth, (req, res) => res.json(trialBalance({ to: req.query.to })));
  app.get('/api/reports/pnl', requireAuth, (req, res) => res.json(profitAndLoss({ from: req.query.from, to: req.query.to })));
  app.get('/api/reports/balance-sheet', requireAuth, (req, res) => res.json(balanceSheet({ to: req.query.to })));
  app.get('/api/reports/general-ledger', requireAuth, (req, res) => res.json(generalLedger({ accountId: req.query.account, from: req.query.from, to: req.query.to })));
  app.get('/api/reports/ar-aging', requireAuth, (req, res) => res.json(arAging({ asOf: req.query.to })));
  app.get('/api/reports/ap-aging', requireAuth, (req, res) => res.json(apAging({ asOf: req.query.to })));
  app.get('/api/reports/vat', requireAuth, (req, res) => res.json(vatSummary({ from: req.query.from, to: req.query.to })));

  /* ============================ CRM ============================ */
  crudRouter(app, {
    base: '/api/crm/accounts', table: 'crm_accounts', entity: 'account',
    fields: ['name', 'industry', 'website', 'phone', 'billing_city', 'employees', 'annual_revenue', 'owner', 'description'],
    orderBy: 'name', label: (r) => r.name,
  });
  crudRouter(app, {
    base: '/api/crm/contacts', table: 'crm_contacts', entity: 'contact',
    fields: ['first_name', 'last_name', 'account_name', 'title', 'email', 'phone', 'mobile', 'lead_source', 'owner', 'description'],
    orderBy: 'last_name', label: (r) => `${r.first_name || ''} ${r.last_name}`.trim(),
  });
  crudRouter(app, {
    base: '/api/deals', table: 'deals', entity: 'deal',
    fields: ['name', 'account_name', 'contact_name', 'amount', 'stage', 'probability', 'closing_date', 'lead_source', 'owner', 'next_step', 'description'],
    orderBy: 'id DESC', label: (r) => r.name,
  });
  crudRouter(app, {
    base: '/api/tasks', table: 'tasks', entity: 'task',
    fields: ['subject', 'related_to', 'task_type', 'due_date', 'priority', 'status', 'owner', 'notes'],
    orderBy: 'due_date', label: (r) => r.subject,
  });

  /* ============================ SALES ORDERS ============================ */
  docRoutes(app, {
    base: '/api/sales-orders', table: 'sales_orders', itemsTable: 'sales_order_items', fk: 'sales_order_id',
    numPrefix: 'SO', numCol: 'so_number', entity: 'sales order',
    nameField: 'client_name', dateField: 'so_date', extra: ['shipment_date', 'contact_id'],
  });
  app.post('/api/sales-orders/:id/convert', requireAuth, (req, res) => {
    const so = getDoc('sales_orders', 'sales_order_items', 'sales_order_id', req.params.id);
    if (!so) return res.status(404).json({ error: 'Not found' });
    if (so.converted_invoice_id) return res.status(400).json({ error: 'Already invoiced' });
    const number = nextInvoiceNumber();
    const info = db.prepare(`INSERT INTO invoices (invoice_number, client_name, contact_id, issue_date, status, subtotal, tax_percent, tax, total, currency, notes, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(number, so.client_name, so.contact_id, today(), 'Sent', so.subtotal, so.tax_percent, so.tax, so.total, 'AED', so.notes, req.user.id);
    const invId = info.lastInsertRowid;
    const ins = db.prepare('INSERT INTO invoice_items (invoice_id, description, qty, unit_price, amount) VALUES (?,?,?,?,?)');
    for (const it of so.items) ins.run(invId, it.description, it.qty, it.unit_price, round2(it.qty * it.unit_price));
    db.prepare("UPDATE sales_orders SET status='Invoiced', converted_invoice_id=? WHERE id=?").run(invId, so.id);
    postInvoiceJournal(getInvoice(invId), req.user);
    logActivity(req.user, 'create', 'invoice', invId, `Converted ${so.so_number} → invoice ${number}`);
    res.status(201).json(getInvoice(invId));
  });

  /* ============================ PURCHASE ORDERS ============================ */
  docRoutes(app, {
    base: '/api/purchase-orders', table: 'purchase_orders', itemsTable: 'purchase_order_items', fk: 'purchase_order_id',
    numPrefix: 'PO', numCol: 'po_number', entity: 'purchase order',
    nameField: 'vendor_name', dateField: 'po_date', extra: ['delivery_date', 'contact_id'], withAccount: true,
    defaultStatus: 'Draft',
  });
  app.post('/api/purchase-orders/:id/convert', requireAuth, (req, res) => {
    const po = getDoc('purchase_orders', 'purchase_order_items', 'purchase_order_id', req.params.id);
    if (!po) return res.status(404).json({ error: 'Not found' });
    if (po.converted_bill_id) return res.status(400).json({ error: 'Already billed' });
    const number = nextNumber('BILL', 'bills', 'bill_number');
    const info = db.prepare(`INSERT INTO bills (bill_number, contact_id, vendor_name, bill_date, status, subtotal, tax_percent, tax, total, currency, notes, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(number, po.contact_id, po.vendor_name, today(), 'Open', po.subtotal, po.tax_percent, po.tax, po.total, 'AED', po.notes, req.user.id);
    const billId = info.lastInsertRowid;
    saveAccountItems('bill_items', 'bill_id', billId, po.items);
    db.prepare("UPDATE purchase_orders SET status='Billed', converted_bill_id=? WHERE id=?").run(billId, po.id);
    postBillJournal(getBill(billId), req.user);
    logActivity(req.user, 'create', 'bill', billId, `Converted ${po.po_number} → bill ${number}`);
    res.status(201).json(getBill(billId));
  });

  /* ============================ VENDOR CREDITS ============================ */
  app.get('/api/vendor-credits', requireAuth, (req, res) => res.json(db.prepare('SELECT * FROM vendor_credits ORDER BY id DESC').all()));
  app.get('/api/vendor-credits/:id', requireAuth, (req, res) => {
    const vc = getDoc('vendor_credits', 'vendor_credit_items', 'vendor_credit_id', req.params.id);
    if (!vc) return res.status(404).json({ error: 'Not found' });
    res.json(vc);
  });
  app.post('/api/vendor-credits', requireAuth, (req, res) => {
    const b = req.body || {};
    const items = Array.isArray(b.items) ? b.items : [];
    const { subtotal, tax, total } = totalsOf(items, b.tax_percent);
    const number = b.vc_number || nextNumber('VC', 'vendor_credits', 'vc_number');
    const info = db.prepare(`INSERT INTO vendor_credits (vc_number, contact_id, vendor_name, vc_date, bill_id, reason, status, subtotal, tax_percent, tax, total, currency, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(number, b.contact_id || null, b.vendor_name || 'Vendor', b.vc_date || today(), b.bill_id || null, b.reason || null, 'Open', subtotal, num(b.tax_percent), tax, total, 'AED', req.user.id);
    const vcId = info.lastInsertRowid;
    saveAccountItems('vendor_credit_items', 'vendor_credit_id', vcId, items);
    // Dr Accounts Payable, Cr expense account(s), Cr Input VAT (reverse)
    const lines = [{ code: CODES.AP, debit: total, credit: 0, description: b.vendor_name, contact_id: b.contact_id }];
    for (const it of items) lines.push({ account_id: it.account_id || idByCode(CODES.OFFICE), debit: 0, credit: round2(it.qty * it.unit_price), description: it.description });
    if (tax > 0) lines.push({ code: CODES.INPUT_VAT, debit: 0, credit: tax, description: 'Input VAT reversed' });
    postJournal({ journal_date: b.vc_date || today(), reference: number, notes: `Vendor credit — ${b.reason || ''}`, source_type: 'vendor_credit', source_id: vcId }, lines, req.user);
    logActivity(req.user, 'create', 'vendor_credit', vcId, `Created vendor credit ${number}`);
    res.status(201).json(getDoc('vendor_credits', 'vendor_credit_items', 'vendor_credit_id', vcId));
  });
  app.delete('/api/vendor-credits/:id', requireAuth, requireAdmin, (req, res) => {
    const vc = db.prepare('SELECT * FROM vendor_credits WHERE id = ?').get(req.params.id);
    if (!vc) return res.status(404).json({ error: 'Not found' });
    deleteJournalsFor('vendor_credit', vc.id);
    db.prepare('DELETE FROM vendor_credits WHERE id = ?').run(vc.id);
    logActivity(req.user, 'delete', 'vendor_credit', vc.id, `Deleted vendor credit ${vc.vc_number}`);
    res.json({ ok: true });
  });

  /* ============================ RECURRING INVOICES ============================ */
  app.get('/api/recurring-invoices', requireAuth, (req, res) => res.json(db.prepare('SELECT * FROM recurring_invoices ORDER BY id DESC').all()));
  app.get('/api/recurring-invoices/:id', requireAuth, (req, res) => {
    const r = getDoc('recurring_invoices', 'recurring_invoice_items', 'recurring_invoice_id', req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found' });
    res.json(r);
  });
  app.post('/api/recurring-invoices', requireAuth, (req, res) => {
    const b = req.body || {};
    const items = Array.isArray(b.items) ? b.items : [];
    const { subtotal, tax, total } = totalsOf(items, b.tax_percent);
    const start = b.start_date || today();
    const info = db.prepare(`INSERT INTO recurring_invoices (profile_name, contact_id, client_name, frequency, start_date, next_date, status, tax_percent, subtotal, tax, total, notes, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(b.profile_name || 'Recurring', b.contact_id || null, b.client_name || 'Client', b.frequency || 'Monthly', start, start, 'Active', num(b.tax_percent), subtotal, tax, total, b.notes || null, req.user.id);
    saveLineItems('recurring_invoice_items', 'recurring_invoice_id', info.lastInsertRowid, items);
    logActivity(req.user, 'create', 'recurring_invoice', info.lastInsertRowid, `Created recurring profile ${b.profile_name}`);
    res.status(201).json(getDoc('recurring_invoices', 'recurring_invoice_items', 'recurring_invoice_id', info.lastInsertRowid));
  });
  app.put('/api/recurring-invoices/:id', requireAuth, (req, res) => {
    const r = db.prepare('SELECT * FROM recurring_invoices WHERE id = ?').get(req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found' });
    const b = req.body || {};
    const items = Array.isArray(b.items) ? b.items : db.prepare('SELECT * FROM recurring_invoice_items WHERE recurring_invoice_id = ?').all(r.id);
    const { subtotal, tax, total } = totalsOf(items, b.tax_percent ?? r.tax_percent);
    db.prepare(`UPDATE recurring_invoices SET profile_name=?, client_name=?, frequency=?, status=?, tax_percent=?, subtotal=?, tax=?, total=?, notes=? WHERE id=?`).run(
      b.profile_name ?? r.profile_name, b.client_name ?? r.client_name, b.frequency ?? r.frequency, b.status ?? r.status, num(b.tax_percent ?? r.tax_percent), subtotal, tax, total, b.notes ?? r.notes, r.id);
    if (Array.isArray(b.items)) saveLineItems('recurring_invoice_items', 'recurring_invoice_id', r.id, items);
    res.json(getDoc('recurring_invoices', 'recurring_invoice_items', 'recurring_invoice_id', r.id));
  });
  app.delete('/api/recurring-invoices/:id', requireAuth, requireAdmin, (req, res) => {
    const r = db.prepare('SELECT * FROM recurring_invoices WHERE id = ?').get(req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found' });
    db.prepare('DELETE FROM recurring_invoices WHERE id = ?').run(r.id);
    logActivity(req.user, 'delete', 'recurring_invoice', r.id, `Deleted recurring profile ${r.profile_name}`);
    res.json({ ok: true });
  });
  app.post('/api/recurring-invoices/:id/generate', requireAuth, (req, res) => {
    const r = getDoc('recurring_invoices', 'recurring_invoice_items', 'recurring_invoice_id', req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found' });
    const number = nextInvoiceNumber();
    const info = db.prepare(`INSERT INTO invoices (invoice_number, client_name, contact_id, issue_date, status, subtotal, tax_percent, tax, total, currency, notes, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(number, r.client_name, r.contact_id, today(), 'Sent', r.subtotal, r.tax_percent, r.tax, r.total, 'AED', r.notes, req.user.id);
    const invId = info.lastInsertRowid;
    const ins = db.prepare('INSERT INTO invoice_items (invoice_id, description, qty, unit_price, amount) VALUES (?,?,?,?,?)');
    for (const it of r.items) ins.run(invId, it.description, it.qty, it.unit_price, round2(it.qty * it.unit_price));
    postInvoiceJournal(getInvoice(invId), req.user);
    db.prepare('UPDATE recurring_invoices SET last_generated=?, generated_count=generated_count+1, next_date=? WHERE id=?').run(today(), addFrequency(r.next_date || today(), r.frequency), r.id);
    logActivity(req.user, 'create', 'invoice', invId, `Generated invoice ${number} from recurring ${r.profile_name}`);
    res.status(201).json(getInvoice(invId));
  });

  /* ============================ BANKING ============================ */
  app.get('/api/banking/accounts', requireAuth, (req, res) => {
    const accts = db.prepare("SELECT * FROM accounts WHERE account_subtype IN ('bank','cash') ORDER BY code").all();
    res.json(accts.map((a) => {
      const { dr, cr } = db.prepare('SELECT COALESCE(SUM(debit),0) dr, COALESCE(SUM(credit),0) cr FROM journal_lines WHERE account_id = ?').get(a.id);
      return { ...a, balance: round2(dr - cr) };
    }));
  });
  app.get('/api/banking/transactions', requireAuth, (req, res) => {
    const rows = db.prepare(`SELECT j.*, (SELECT COALESCE(SUM(debit),0) FROM journal_lines WHERE journal_id=j.id) amount
      FROM journals j WHERE j.source_type IN ('banking') ORDER BY j.journal_date DESC, j.id DESC LIMIT 300`).all();
    res.json(rows);
  });
  app.post('/api/banking/transaction', requireAuth, (req, res) => {
    const b = req.body || {};
    const amount = round2(b.amount);
    if (amount <= 0) return res.status(400).json({ error: 'Amount must be positive' });
    const date = b.date || today();
    try {
      if (b.type === 'transfer') {
        if (!b.from_account_id || !b.to_account_id) return res.status(400).json({ error: 'Pick both accounts' });
        postJournal({ journal_date: date, reference: b.reference || 'Transfer', notes: b.description || 'Bank transfer', source_type: 'banking' },
          [{ account_id: b.to_account_id, debit: amount, credit: 0, description: 'Transfer in' },
           { account_id: b.from_account_id, debit: 0, credit: amount, description: 'Transfer out' }], req.user);
      } else if (b.type === 'deposit') {
        postJournal({ journal_date: date, reference: b.reference || 'Deposit', notes: b.description || 'Money in', source_type: 'banking' },
          [{ account_id: b.account_id, debit: amount, credit: 0, description: b.description },
           { account_id: b.other_account_id || idByCode(CODES.OTHER_INCOME), debit: 0, credit: amount, description: b.description }], req.user);
      } else { // withdrawal
        postJournal({ journal_date: date, reference: b.reference || 'Withdrawal', notes: b.description || 'Money out', source_type: 'banking' },
          [{ account_id: b.other_account_id || idByCode(CODES.OTHER_EXPENSE), debit: amount, credit: 0, description: b.description },
           { account_id: b.account_id, debit: 0, credit: amount, description: b.description }], req.user);
      }
      logActivity(req.user, 'create', 'banking', null, `Bank ${b.type} — AED ${amount}`);
      res.status(201).json({ ok: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  /* ============================ LEAD → CUSTOMER CONVERSION ============================ */
  app.post('/api/leads/:id/convert', requireAuth, (req, res) => {
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Not found' });
    if (lead.converted_contact_id) return res.status(400).json({ error: 'Lead already converted to a customer' });
    const b = req.body || {};
    // 1) Books customer
    const cInfo = db.prepare(`INSERT INTO contacts (contact_type, display_name, company_name, notes, is_active, created_by) VALUES ('customer',?,?,?,1,?)`)
      .run(lead.name, lead.business_category || null, lead.notes || `Converted from lead (${lead.source || 'lead'})`, req.user.id);
    const contactId = cInfo.lastInsertRowid;
    // 2) CRM contact
    db.prepare(`INSERT INTO crm_contacts (last_name, account_name, lead_source, owner, description, created_by) VALUES (?,?,?,?,?,?)`)
      .run(lead.name, lead.business_category || null, lead.source || 'Lead', b.owner || null, lead.notes || null, req.user.id);
    // 3) optional Deal (Closed Won)
    if (b.create_deal) {
      db.prepare(`INSERT INTO deals (name, account_name, amount, stage, probability, lead_source, owner, created_by) VALUES (?,?,?,?,?,?,?,?)`)
        .run(`${lead.name} — Won`, lead.name, round2(b.amount || 0), 'Closed Won', 100, lead.source || 'Lead', b.owner || null, req.user.id);
    }
    // 4) mark lead converted
    db.prepare("UPDATE leads SET status='Won', converted_contact_id=?, updated_at=datetime('now') WHERE id=?").run(contactId, lead.id);
    logActivity(req.user, 'update', 'lead', lead.id, `Converted lead ${lead.name} → customer`);
    res.status(201).json({ ok: true, contact_id: contactId, customer: db.prepare('SELECT * FROM contacts WHERE id=?').get(contactId) });
  });

  /* ============================ DELIVERY CHALLANS ============================ */
  docRoutes(app, {
    base: '/api/delivery-challans', table: 'delivery_challans', itemsTable: 'delivery_challan_items', fk: 'delivery_challan_id',
    numPrefix: 'DC', numCol: 'dc_number', entity: 'delivery challan',
    nameField: 'client_name', dateField: 'dc_date', extra: ['contact_id', 'reference', 'challan_type'],
  });
  app.post('/api/delivery-challans/:id/convert', requireAuth, (req, res) => {
    const dc = getDoc('delivery_challans', 'delivery_challan_items', 'delivery_challan_id', req.params.id);
    if (!dc) return res.status(404).json({ error: 'Not found' });
    if (dc.converted_invoice_id) return res.status(400).json({ error: 'Already invoiced' });
    const number = nextInvoiceNumber();
    const info = db.prepare(`INSERT INTO invoices (invoice_number, client_name, contact_id, issue_date, status, subtotal, tax_percent, tax, total, currency, notes, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(number, dc.client_name, dc.contact_id, today(), 'Sent', dc.subtotal, dc.tax_percent, dc.tax, dc.total, 'AED', dc.notes, req.user.id);
    const invId = info.lastInsertRowid;
    const ins = db.prepare('INSERT INTO invoice_items (invoice_id, description, qty, unit_price, amount) VALUES (?,?,?,?,?)');
    for (const it of dc.items) ins.run(invId, it.description, it.qty, it.unit_price, round2(it.qty * it.unit_price));
    db.prepare("UPDATE delivery_challans SET status='Invoiced', converted_invoice_id=? WHERE id=?").run(invId, dc.id);
    postInvoiceJournal(getInvoice(invId), req.user);
    logActivity(req.user, 'create', 'invoice', invId, `Converted ${dc.dc_number} → invoice ${number}`);
    res.status(201).json(getInvoice(invId));
  });

  /* ============================ DOCUMENTS ============================ */
  crudRouter(app, {
    base: '/api/documents', table: 'documents', entity: 'document',
    fields: ['name', 'file_url', 'file_type', 'folder', 'notes', 'uploaded_by'],
    orderBy: 'id DESC', label: (r) => r.name,
  });

  /* ============================ TIME TRACKING ============================ */
  crudRouter(app, {
    base: '/api/projects', table: 'projects', entity: 'project',
    fields: ['name', 'contact_id', 'customer_name', 'billing_method', 'rate', 'budget_hours', 'status', 'description'],
    orderBy: 'id DESC', label: (r) => r.name,
  });
  crudRouter(app, {
    base: '/api/time-entries', table: 'time_entries', entity: 'time entry',
    fields: ['project_id', 'project_name', 'task', 'user_name', 'entry_date', 'hours', 'billable', 'billed', 'notes'],
    orderBy: 'entry_date DESC, id DESC', label: (r) => `${r.hours}h — ${r.project_name || ''}`,
  });

  /* ============================ TRANSACTION LOCKING ============================ */
  app.get('/api/transaction-lock', requireAuth, (req, res) => res.json({ lock_date: getSetting('lock_date') }));
  app.put('/api/transaction-lock', requireAuth, requireAdmin, (req, res) => {
    const d = (req.body || {}).lock_date || null;
    setSetting('lock_date', d);
    logActivity(req.user, 'update', 'settings', null, d ? `Locked books up to ${d}` : 'Removed transaction lock');
    res.json({ lock_date: d });
  });

  /* ============================ BULK UPDATE (non-accounting modules) ============================ */
  const BULK = {
    expenses: { table: 'expenses', fields: ['category', 'person'] },
    meetings: { table: 'meetings', fields: ['status'] },
    leads: { table: 'leads', fields: ['status'] },
    tasks: { table: 'tasks', fields: ['status', 'priority', 'owner'] },
    deals: { table: 'deals', fields: ['stage', 'owner'] },
  };
  app.get('/api/bulk-update/modules', requireAuth, (req, res) => res.json(BULK));
  app.post('/api/bulk-update', requireAuth, requireAdmin, (req, res) => {
    const { module, ids, field, value } = req.body || {};
    const cfg = BULK[module];
    if (!cfg) return res.status(400).json({ error: 'Unknown module' });
    if (!cfg.fields.includes(field)) return res.status(400).json({ error: 'Field not allowed for this module' });
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'No rows selected' });
    const stmt = db.prepare(`UPDATE ${cfg.table} SET ${field} = ? WHERE id = ?`);
    db.transaction(() => { for (const id of ids) stmt.run(value, id); })();
    logActivity(req.user, 'update', module, null, `Bulk updated ${ids.length} ${module} — ${field} = ${value}`);
    res.json({ ok: true, updated: ids.length });
  });

  /* ============================ FINANCE SUMMARY (Books dashboard) ============================ */
  app.get('/api/books-summary', requireAuth, (req, res) => {
    const pl = profitAndLoss({});
    const ar = arAging({});
    const ap = apAging({});
    const vat = vatSummary({});
    const bs = balanceSheet({});
    const cash = (idByCode(CODES.BANK) ? require0('SELECT COALESCE(SUM(debit)-SUM(credit),0) v FROM journal_lines WHERE account_id=?', idByCode(CODES.BANK)) : 0)
      + (idByCode(CODES.PETTY_CASH) ? require0('SELECT COALESCE(SUM(debit)-SUM(credit),0) v FROM journal_lines WHERE account_id=?', idByCode(CODES.PETTY_CASH)) : 0);
    res.json({
      totalIncome: pl.totalIncome, totalExpense: pl.totalExpense, netProfit: pl.netProfit,
      receivables: ar.total, payables: ap.total, vatPayable: vat.netPayable,
      cash: round2(cash), totalAssets: bs.totalAssets, totalEquity: bs.totalEquity,
    });
  });
}

function require0(sql, ...args) { return Number(db.prepare(sql).get(...args)?.v || 0); }

/* ---- Shared helpers ---- */
function saveLineItems(table, fk, id, items) {
  db.prepare(`DELETE FROM ${table} WHERE ${fk} = ?`).run(id);
  const ins = db.prepare(`INSERT INTO ${table} (${fk}, description, qty, unit_price, amount) VALUES (?,?,?,?,?)`);
  for (const it of items) {
    if (!it.description && !it.unit_price) continue;
    const amount = round2(num(it.qty) * num(it.unit_price));
    ins.run(id, it.description || '', num(it.qty), num(it.unit_price), amount);
  }
}
function saveAccountItems(table, fk, id, items) {
  db.prepare(`DELETE FROM ${table} WHERE ${fk} = ?`).run(id);
  const ins = db.prepare(`INSERT INTO ${table} (${fk}, account_id, description, qty, unit_price, amount) VALUES (?,?,?,?,?,?)`);
  for (const it of items) {
    if (!it.description && !it.unit_price) continue;
    const amount = round2(num(it.qty) * num(it.unit_price));
    ins.run(id, it.account_id || idByCode(CODES.OFFICE), it.description || '', num(it.qty), num(it.unit_price), amount);
  }
}
function saveBillItems(billId, items) { saveAccountItems('bill_items', 'bill_id', billId, items); }

/* Generic getter: returns a document row with its .items array. */
function getDoc(table, itemsTable, fk, id) {
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  if (row) row.items = db.prepare(`SELECT * FROM ${itemsTable} WHERE ${fk} = ?`).all(row.id);
  return row;
}

/* Advance a date by a recurring frequency. */
function addFrequency(dateStr, freq) {
  const d = new Date((dateStr || today()) + 'T00:00:00');
  if (freq === 'Weekly') d.setDate(d.getDate() + 7);
  else if (freq === 'Quarterly') d.setMonth(d.getMonth() + 3);
  else if (freq === 'Yearly') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1); // Monthly default
  return d.toISOString().slice(0, 10);
}

/* Generic CRUD for non-posting documents (Sales Orders, Purchase Orders). */
function docRoutes(app, cfg) {
  const { base, table, itemsTable, fk, numPrefix, numCol, entity, nameField, dateField,
          extra = [], withAccount = false, defaultStatus = 'Draft' } = cfg;
  const saveItems = withAccount
    ? (id, items) => saveAccountItems(itemsTable, fk, id, items)
    : (id, items) => saveLineItems(itemsTable, fk, id, items);

  app.get(base, requireAuth, (req, res) => res.json(db.prepare(`SELECT * FROM ${table} ORDER BY id DESC`).all()));
  app.get(`${base}/:id`, requireAuth, (req, res) => {
    const d = getDoc(table, itemsTable, fk, req.params.id);
    if (!d) return res.status(404).json({ error: 'Not found' });
    res.json(d);
  });
  app.post(base, requireAuth, (req, res) => {
    const b = req.body || {};
    const items = Array.isArray(b.items) ? b.items : [];
    const { subtotal, tax, total } = totalsOf(items, b.tax_percent);
    const number = b[numCol] || nextNumber(numPrefix, table, numCol);
    const cols = [numCol, nameField, dateField, ...extra, 'status', 'subtotal', 'tax_percent', 'tax', 'total', 'currency', 'notes', 'created_by'];
    const vals = [number, b[nameField] || '—', b[dateField] || today(), ...extra.map((e) => b[e] ?? null), b.status || defaultStatus, subtotal, num(b.tax_percent), tax, total, 'AED', b.notes || null, req.user.id];
    const info = db.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...vals);
    saveItems(info.lastInsertRowid, items);
    logActivity(req.user, 'create', entity, info.lastInsertRowid, `Created ${entity} ${number}`);
    res.status(201).json(getDoc(table, itemsTable, fk, info.lastInsertRowid));
  });
  app.put(`${base}/:id`, requireAuth, (req, res) => {
    const ex = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    if (!ex) return res.status(404).json({ error: 'Not found' });
    const b = req.body || {};
    const items = Array.isArray(b.items) ? b.items : db.prepare(`SELECT * FROM ${itemsTable} WHERE ${fk} = ?`).all(ex.id);
    const { subtotal, tax, total } = totalsOf(items, b.tax_percent ?? ex.tax_percent);
    const setCols = [nameField, dateField, ...extra, 'status', 'subtotal', 'tax_percent', 'tax', 'total', 'notes'];
    const setVals = [b[nameField] ?? ex[nameField], b[dateField] ?? ex[dateField], ...extra.map((e) => b[e] ?? ex[e]), b.status ?? ex.status, subtotal, num(b.tax_percent ?? ex.tax_percent), tax, total, b.notes ?? ex.notes];
    db.prepare(`UPDATE ${table} SET ${setCols.map((c) => c + '=?').join(',')} WHERE id = ?`).run(...setVals, ex.id);
    if (Array.isArray(b.items)) saveItems(ex.id, items);
    logActivity(req.user, 'update', entity, ex.id, `Updated ${entity} ${ex[numCol]}`);
    res.json(getDoc(table, itemsTable, fk, ex.id));
  });
  app.delete(`${base}/:id`, requireAuth, requireAdmin, (req, res) => {
    const ex = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    if (!ex) return res.status(404).json({ error: 'Not found' });
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(ex.id);
    logActivity(req.user, 'delete', entity, ex.id, `Deleted ${entity} ${ex[numCol]}`);
    res.json({ ok: true });
  });
}
function getEstimate(id) {
  const e = db.prepare('SELECT * FROM estimates WHERE id = ?').get(id);
  if (e) e.items = db.prepare('SELECT * FROM estimate_items WHERE estimate_id = ?').all(e.id);
  return e;
}
function getBill(id) {
  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(id);
  if (bill) bill.items = db.prepare('SELECT * FROM bill_items WHERE bill_id = ?').all(bill.id);
  return bill;
}
function getInvoice(id) {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  if (inv) inv.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(inv.id);
  return inv;
}
function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  const row = db.prepare("SELECT COUNT(*) n FROM invoices WHERE invoice_number LIKE ?").get(`DEVX-${year}-%`);
  return `DEVX-${year}-${String((row?.n || 0) + 1).padStart(3, '0')}`;
}

/* ---- Journal posting for invoices / bills (shared with routes.js) ---- */
export function postInvoiceJournal(inv, user) {
  if (!inv || inv.status === 'Draft' || inv.status === 'Cancelled') return;
  postJournal(
    { journal_date: inv.issue_date, reference: inv.invoice_number, notes: `Invoice ${inv.invoice_number}`, source_type: 'invoice', source_id: inv.id },
    [
      { code: CODES.AR, debit: inv.total, credit: 0, description: inv.client_name, contact_id: inv.contact_id },
      { code: CODES.SALES, debit: 0, credit: inv.subtotal, description: inv.client_name },
      { code: CODES.OUTPUT_VAT, debit: 0, credit: inv.tax, description: 'Output VAT' },
    ], user);
}
function postBillJournal(bill, user) {
  if (!bill || bill.status === 'Draft' || bill.status === 'Cancelled') return;
  const lines = [];
  const items = bill.items || [];
  if (items.length) {
    for (const it of items) lines.push({ account_id: it.account_id || idByCode(CODES.OFFICE), debit: round2(it.qty * it.unit_price), credit: 0, description: it.description });
  } else {
    lines.push({ code: CODES.OFFICE, debit: bill.subtotal, credit: 0, description: bill.vendor_name });
  }
  if (bill.tax > 0) lines.push({ code: CODES.INPUT_VAT, debit: bill.tax, credit: 0, description: 'Input VAT' });
  lines.push({ code: CODES.AP, debit: 0, credit: bill.total, description: bill.vendor_name, contact_id: bill.contact_id });
  postJournal({ journal_date: bill.bill_date, reference: bill.bill_number, notes: `Bill ${bill.bill_number}`, source_type: 'bill', source_id: bill.id }, lines, user);
}
function applyToInvoice(invId, delta) {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invId);
  if (!inv) return;
  const paid = round2((inv.amount_paid || 0) + delta);
  let status = inv.status;
  if (paid >= inv.total - 0.005) status = 'Paid';
  else if (paid > 0.005) status = 'Partially Paid';
  else if (inv.status === 'Paid' || inv.status === 'Partially Paid') status = 'Sent';
  db.prepare('UPDATE invoices SET amount_paid = ?, status = ? WHERE id = ?').run(Math.max(0, paid), status, invId);
}
function applyToBill(billId, delta) {
  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(billId);
  if (!bill) return;
  const paid = round2((bill.amount_paid || 0) + delta);
  let status = bill.status;
  if (paid >= bill.total - 0.005) status = 'Paid';
  else if (paid > 0.005) status = 'Partially Paid';
  else status = 'Open';
  db.prepare('UPDATE bills SET amount_paid = ?, status = ? WHERE id = ?').run(Math.max(0, paid), status, billId);
}
