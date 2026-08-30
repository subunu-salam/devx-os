// Double-entry accounting engine for DevX OS — the Zoho Books core.
// Every financial document posts a balanced journal (sum(debit) === sum(credit)).
// Financial reports (P&L, Balance Sheet, Trial Balance, GL, aging, VAT) are all
// derived from journal_lines, so the books always tie out.
import db from './schema.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/* ---- App settings (Transaction Locking, etc.) ---- */
export function getSetting(key) {
  const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return r ? r.value : null;
}
export function setSetting(key, value) {
  db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?,?,datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`).run(key, value ?? null);
}

/* ---- Well-known system account codes (created in seed.js) ---- */
export const CODES = {
  PETTY_CASH: '1000',
  UNDEPOSITED: '1001',
  BANK: '1010',
  AR: '1200',            // Accounts Receivable
  INPUT_VAT: '1510',     // VAT recoverable (asset)
  AP: '2000',            // Accounts Payable
  OUTPUT_VAT: '2100',    // VAT payable (liability)
  OWNER_EQUITY: '3000',
  OWNER_DRAWINGS: '3100',
  RETAINED: '3200',
  SALES: '4000',
  OTHER_INCOME: '4100',
  COGS: '5000',
  SALARIES: '6000',
  RENT: '6010',
  OFFICE: '6020',
  GOVT: '6030',
  TRAVEL: '6040',
  MEALS: '6050',
  SOFTWARE: '6060',
  MARKETING: '6070',
  OTHER_EXPENSE: '6900',
};

/* Map the existing Expense-tracker categories to a Chart-of-Accounts code. */
export function expenseCategoryToCode(category, details = '') {
  const t = `${category || ''} ${details || ''}`.toLowerCase();
  if (/salary|salaries|wage/.test(t)) return CODES.SALARIES;
  if (/rent|ejari/.test(t)) return CODES.RENT;
  if (/visa|immigration|labour|labor|license|licence|ded|dld|govt|government|trade name|approval|voucher/.test(t)) return CODES.GOVT;
  if (/travel|flight|taxi|fuel|transport/.test(t)) return CODES.TRAVEL;
  if (/food|meal|lunch|dinner|coffee|restaurant/.test(t)) return CODES.MEALS;
  if (/domain|email|microsoft|software|subscription|hosting|saas|aqueous/.test(t)) return CODES.SOFTWARE;
  if (/market|advert|campaign|t-shirt|tshirt|uniform|business card|logo|gift/.test(t)) return CODES.MARKETING;
  if (/office/.test(t)) return CODES.OFFICE;
  return CODES.OTHER_EXPENSE;
}

/* ---- Account lookups ---- */
export const accountByCode = (code) => db.prepare('SELECT * FROM accounts WHERE code = ?').get(String(code));
export const accountById = (id) => db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
export const idByCode = (code) => accountByCode(code)?.id;

/* ---- Numbering ---- */
export function nextNumber(prefix, table, column) {
  const year = new Date().getFullYear();
  const like = `${prefix}-${year}-%`;
  const row = db.prepare(`SELECT COUNT(*) n FROM ${table} WHERE ${column} LIKE ?`).get(like);
  const seq = String((row?.n || 0) + 1).padStart(4, '0');
  return `${prefix}-${year}-${seq}`;
}

/**
 * Post a balanced journal.
 * @param {Object} j { journal_date, reference, notes, source_type, source_id, is_manual }
 * @param {Array}  lines [{ account_id | code, debit, credit, description, contact_id }]
 * @param {Object} user
 * @returns {number} journal id
 */
export function postJournal(j, lines, user) {
  const clean = (lines || [])
    .map((l) => ({
      account_id: l.account_id || idByCode(l.code),
      debit: round2(l.debit),
      credit: round2(l.credit),
      description: l.description || null,
      contact_id: l.contact_id || null,
    }))
    .filter((l) => l.account_id && (l.debit !== 0 || l.credit !== 0));

  if (!clean.length) throw new Error('Journal has no lines');

  // Transaction Locking — block postings dated on/before the lock date.
  const lockDate = getSetting('lock_date');
  if (lockDate && !j.bypassLock && j.journal_date && j.journal_date <= lockDate) {
    throw new Error(`Books are locked up to ${lockDate}. Unlock in Accountant → Transaction Locking to post on or before that date.`);
  }
  const totDr = round2(clean.reduce((s, l) => s + l.debit, 0));
  const totCr = round2(clean.reduce((s, l) => s + l.credit, 0));
  if (Math.abs(totDr - totCr) > 0.001) {
    throw new Error(`Journal is not balanced (debit ${totDr} ≠ credit ${totCr})`);
  }

  const tx = db.transaction(() => {
    const number = j.journal_number || nextNumber('JE', 'journals', 'journal_number');
    const info = db.prepare(`INSERT INTO journals
      (journal_number, journal_date, reference, notes, source_type, source_id, is_manual, created_by)
      VALUES (?,?,?,?,?,?,?,?)`).run(
      number, j.journal_date, j.reference || null, j.notes || null,
      j.source_type || 'manual', j.source_id || null, j.is_manual ? 1 : 0, user?.id || null);
    const jid = info.lastInsertRowid;
    const ins = db.prepare(`INSERT INTO journal_lines (journal_id, account_id, debit, credit, description, contact_id)
      VALUES (?,?,?,?,?,?)`);
    for (const l of clean) ins.run(jid, l.account_id, l.debit, l.credit, l.description, l.contact_id);
    return jid;
  });
  return tx();
}

/* Remove the journal(s) tied to a source document (used before re-posting on edit / on delete). */
export function deleteJournalsFor(source_type, source_id) {
  const rows = db.prepare('SELECT id FROM journals WHERE source_type = ? AND source_id = ?').all(source_type, source_id);
  const del = db.prepare('DELETE FROM journals WHERE id = ?');
  for (const r of rows) del.run(r.id);   // journal_lines cascade
  return rows.length;
}

/* ============================ BALANCES & REPORTS ============================ */

const NORMAL_DEBIT = new Set(['asset', 'expense']);

/* Signed balance for an account: debit-normal → dr−cr, credit-normal → cr−dr. */
export function accountBalance(accountId, { from, to } = {}) {
  let sql = 'SELECT COALESCE(SUM(debit),0) dr, COALESCE(SUM(credit),0) cr FROM journal_lines jl JOIN journals j ON j.id = jl.journal_id WHERE jl.account_id = ?';
  const args = [accountId];
  if (from) { sql += ' AND j.journal_date >= ?'; args.push(from); }
  if (to) { sql += ' AND j.journal_date <= ?'; args.push(to); }
  const { dr, cr } = db.prepare(sql).get(...args);
  const acc = accountById(accountId);
  const sign = NORMAL_DEBIT.has(acc.account_type) ? 1 : -1;
  return round2((dr - cr) * sign);
}

/* Trial Balance — every account with its net debit/credit as of `to`. */
export function trialBalance({ to } = {}) {
  const accounts = db.prepare('SELECT * FROM accounts ORDER BY code').all();
  const rows = [];
  let totalDr = 0, totalCr = 0;
  for (const a of accounts) {
    let sql = 'SELECT COALESCE(SUM(debit),0) dr, COALESCE(SUM(credit),0) cr FROM journal_lines jl JOIN journals j ON j.id = jl.journal_id WHERE jl.account_id = ?';
    const args = [a.id];
    if (to) { sql += ' AND j.journal_date <= ?'; args.push(to); }
    const { dr, cr } = db.prepare(sql).get(...args);
    const net = round2(dr - cr);
    if (Math.abs(net) < 0.005 && dr === 0 && cr === 0) continue;
    const debit = net > 0 ? net : 0;
    const credit = net < 0 ? -net : 0;
    totalDr += debit; totalCr += credit;
    rows.push({ id: a.id, code: a.code, name: a.name, account_type: a.account_type, debit, credit });
  }
  return { rows, totalDebit: round2(totalDr), totalCredit: round2(totalCr) };
}

/* Profit & Loss for a date range. */
export function profitAndLoss({ from, to } = {}) {
  const income = accountsOfTypeWithBalance('income', { from, to }).map((r) => ({ ...r, amount: -r.signed })); // income normal credit → positive
  const expense = accountsOfTypeWithBalance('expense', { from, to }).map((r) => ({ ...r, amount: r.signed }));
  const totalIncome = round2(income.reduce((s, r) => s + r.amount, 0));
  const totalExpense = round2(expense.reduce((s, r) => s + r.amount, 0));
  const netProfit = round2(totalIncome - totalExpense);
  return { income, expense, totalIncome, totalExpense, netProfit, from, to };
}

/* Balance Sheet as of `to`. Equity includes current-period + retained net income. */
export function balanceSheet({ to } = {}) {
  const assets = accountsOfTypeWithBalance('asset', { to }).map((r) => ({ ...r, amount: r.signed }));
  const liabilities = accountsOfTypeWithBalance('liability', { to }).map((r) => ({ ...r, amount: -r.signed }));
  const equityAccts = accountsOfTypeWithBalance('equity', { to }).map((r) => ({ ...r, amount: -r.signed }));

  // Net income of all time up to `to` flows into equity (retained earnings).
  const pl = profitAndLoss({ to });
  const equity = equityAccts.slice();
  equity.push({ id: 0, code: '', name: 'Current Year Earnings', amount: pl.netProfit });

  const totalAssets = round2(assets.reduce((s, r) => s + r.amount, 0));
  const totalLiabilities = round2(liabilities.reduce((s, r) => s + r.amount, 0));
  const totalEquity = round2(equity.reduce((s, r) => s + r.amount, 0));
  return {
    assets, liabilities, equity,
    totalAssets, totalLiabilities, totalEquity,
    totalLiabilitiesAndEquity: round2(totalLiabilities + totalEquity),
    balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
    to,
  };
}

function accountsOfTypeWithBalance(type, { from, to } = {}) {
  const accts = db.prepare('SELECT * FROM accounts WHERE account_type = ? ORDER BY code').all(type);
  const out = [];
  for (const a of accts) {
    let sql = 'SELECT COALESCE(SUM(debit),0) dr, COALESCE(SUM(credit),0) cr FROM journal_lines jl JOIN journals j ON j.id = jl.journal_id WHERE jl.account_id = ?';
    const args = [a.id];
    if (from) { sql += ' AND j.journal_date >= ?'; args.push(from); }
    if (to) { sql += ' AND j.journal_date <= ?'; args.push(to); }
    const { dr, cr } = db.prepare(sql).get(...args);
    const signed = round2(dr - cr);          // debit-positive
    if (Math.abs(signed) < 0.005) continue;
    out.push({ id: a.id, code: a.code, name: a.name, subtype: a.account_subtype, signed });
  }
  return out;
}

/* General Ledger — running transactions for one account (or all). */
export function generalLedger({ accountId, from, to } = {}) {
  let sql = `SELECT jl.*, j.journal_date, j.journal_number, j.reference, j.source_type, a.name account_name, a.code account_code, a.account_type
             FROM journal_lines jl
             JOIN journals j ON j.id = jl.journal_id
             JOIN accounts a ON a.id = jl.account_id WHERE 1=1`;
  const args = [];
  if (accountId) { sql += ' AND jl.account_id = ?'; args.push(accountId); }
  if (from) { sql += ' AND j.journal_date >= ?'; args.push(from); }
  if (to) { sql += ' AND j.journal_date <= ?'; args.push(to); }
  sql += ' ORDER BY j.journal_date, j.id, jl.id';
  return db.prepare(sql).all(...args);
}

/* AR aging — unpaid customer invoices bucketed by age. */
export function arAging({ asOf } = {}) {
  const ref = asOf || new Date().toISOString().slice(0, 10);
  const rows = db.prepare(`SELECT * FROM invoices WHERE status NOT IN ('Paid','Cancelled','Draft') ORDER BY due_date`).all();
  return agingBuckets(rows, ref, (r) => round2(r.total - (r.amount_paid || 0)), (r) => r.due_date || r.issue_date, (r) => r.client_name, (r) => r.invoice_number);
}

/* AP aging — unpaid vendor bills bucketed by age. */
export function apAging({ asOf } = {}) {
  const ref = asOf || new Date().toISOString().slice(0, 10);
  const rows = db.prepare(`SELECT * FROM bills WHERE status NOT IN ('Paid','Cancelled','Draft') ORDER BY due_date`).all();
  return agingBuckets(rows, ref, (r) => round2(r.total - (r.amount_paid || 0)), (r) => r.due_date || r.bill_date, (r) => r.vendor_name, (r) => r.bill_number);
}

function agingBuckets(rows, ref, balOf, dueOf, nameOf, docOf) {
  const buckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90p: 0 };
  const list = [];
  for (const r of rows) {
    const bal = balOf(r);
    if (bal <= 0.005) continue;
    const due = dueOf(r);
    const days = due ? Math.floor((new Date(ref) - new Date(due)) / 86400000) : 0;
    let bucket = 'current';
    if (days <= 0) bucket = 'current';
    else if (days <= 30) bucket = 'd1_30';
    else if (days <= 60) bucket = 'd31_60';
    else if (days <= 90) bucket = 'd61_90';
    else bucket = 'd90p';
    buckets[bucket] = round2(buckets[bucket] + bal);
    list.push({ name: nameOf(r), doc: docOf(r), due, days: Math.max(0, days), balance: bal, bucket });
  }
  const total = round2(Object.values(buckets).reduce((a, b) => a + b, 0));
  return { buckets, list, total, asOf: ref };
}

/* VAT summary — output VAT (on sales) vs input VAT (on purchases) for a period. */
export function vatSummary({ from, to } = {}) {
  const outVat = accountByCode(CODES.OUTPUT_VAT);
  const inVat = accountByCode(CODES.INPUT_VAT);
  const bal = (acc) => {
    if (!acc) return { dr: 0, cr: 0 };
    let sql = 'SELECT COALESCE(SUM(debit),0) dr, COALESCE(SUM(credit),0) cr FROM journal_lines jl JOIN journals j ON j.id = jl.journal_id WHERE jl.account_id = ?';
    const args = [acc.id];
    if (from) { sql += ' AND j.journal_date >= ?'; args.push(from); }
    if (to) { sql += ' AND j.journal_date <= ?'; args.push(to); }
    return db.prepare(sql).get(...args);
  };
  const o = bal(outVat), i = bal(inVat);
  const outputVat = round2(o.cr - o.dr);   // liability, credit-normal
  const inputVat = round2(i.dr - i.cr);    // asset, debit-normal
  return { outputVat, inputVat, netPayable: round2(outputVat - inputVat), from, to };
}

export default { postJournal, deleteJournalsFor, accountBalance, trialBalance, profitAndLoss, balanceSheet, generalLedger, arAging, apAging, vatSummary };
