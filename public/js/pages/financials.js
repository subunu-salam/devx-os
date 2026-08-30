import { get, icon, fmtAED, fmtDate, escapeHtml, toast } from '../api.js';
import { pageHead } from '../ui.js';

const REPORTS = [
  ['pnl', 'Profit & Loss'],
  ['balance', 'Balance Sheet'],
  ['trial', 'Trial Balance'],
  ['gl', 'General Ledger'],
  ['ar', 'A/R Aging'],
  ['ap', 'A/P Aging'],
  ['vat', 'VAT Summary'],
];

export default async function financials(view) {
  const year = new Date().getFullYear();
  view.innerHTML = pageHead({
    title: 'Financial Reports', desc: 'Real accounting statements generated from your double-entry ledger.',
    actions: `<button class="btn btn-primary no-print" id="printBtn">${icon('print')} Print / PDF</button>`,
  }) + `
    <div class="toolbar no-print">
      <select id="rep">${REPORTS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
      <div class="search" style="flex:none"><label style="font-size:12px;color:var(--muted);margin-right:6px">From</label><input type="date" id="from" value="${year}-01-01" style="border:none;background:transparent;color:var(--ink)"></div>
      <div class="search" style="flex:none"><label style="font-size:12px;color:var(--muted);margin-right:6px">To</label><input type="date" id="to" value="${new Date().toISOString().slice(0, 10)}" style="border:none;background:transparent;color:var(--ink)"></div>
      <button class="btn btn-outline btn-sm" id="run">${icon('search')} Run</button>
    </div>
    <div id="report"><div class="spinner"></div></div>`;

  const repSel = view.querySelector('#rep');
  const fromEl = view.querySelector('#from');
  const toEl = view.querySelector('#to');
  view.querySelector('#run').onclick = run;
  repSel.onchange = run;
  view.querySelector('#printBtn').onclick = () => window.print();
  run();

  async function run() {
    const el = view.querySelector('#report');
    el.innerHTML = '<div class="spinner"></div>';
    const from = fromEl.value, to = toEl.value;
    try {
      const kind = repSel.value;
      if (kind === 'pnl') el.innerHTML = await renderPnl(from, to);
      else if (kind === 'balance') el.innerHTML = await renderBalance(to);
      else if (kind === 'trial') el.innerHTML = await renderTrial(to);
      else if (kind === 'gl') el.innerHTML = await renderGL(from, to);
      else if (kind === 'ar') el.innerHTML = await renderAging('/api/reports/ar-aging', 'Accounts Receivable Aging', to);
      else if (kind === 'ap') el.innerHTML = await renderAging('/api/reports/ap-aging', 'Accounts Payable Aging', to);
      else if (kind === 'vat') el.innerHTML = await renderVat(from, to);
    } catch (e) { el.innerHTML = `<div class="empty">${icon('x')}<p>${escapeHtml(e.message)}</p></div>`; toast(e.message, 'err'); }
  }

  function shell(title, sub, inner) {
    return `<div class="card" id="printArea"><div class="card-pad" style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:12px"><img src="/assets/devx-logo-full.png" style="height:32px"><div><strong>${title}</strong><div class="muted" style="font-size:12px">${sub}</div></div></div>
      <div class="muted" style="font-size:12px">DevX Technologies LLC</div></div>
      <div class="card-pad">${inner}</div></div>`;
  }
  function rowsTable(head, body, foot = '') {
    return `<div class="table-wrap" style="border:none;box-shadow:none"><table class="data"><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${foot ? `<tfoot>${foot}</tfoot>` : ''}</table></div>`;
  }

  async function renderPnl(from, to) {
    const d = await get(`/api/reports/pnl?from=${from}&to=${to}`);
    const sec = (label, list, total) => `
      <tr><td colspan="2" style="font-weight:700;padding-top:14px;color:var(--muted);text-transform:uppercase;font-size:12px;letter-spacing:.04em">${label}</td></tr>
      ${list.length ? list.map((r) => `<tr><td style="padding-left:18px">${escapeHtml(r.name)}</td><td class="num">${fmtAED(r.amount)}</td></tr>`).join('') : `<tr><td style="padding-left:18px" class="muted">No entries</td><td class="num">—</td></tr>`}
      <tr><td style="font-weight:700">Total ${label}</td><td class="num" style="font-weight:700">${fmtAED(total)}</td></tr>`;
    const body = sec('Income', d.income, d.totalIncome) + sec('Expenses', d.expense, d.totalExpense) +
      `<tr><td style="font-weight:800;font-size:15px;padding-top:14px">Net Profit</td><td class="num" style="font-weight:800;font-size:15px;padding-top:14px" ><span class="${d.netProfit >= 0 ? 'pos' : 'neg'}">${fmtAED(d.netProfit)}</span></td></tr>`;
    return shell('Profit & Loss', `${fmtDate(from)} — ${fmtDate(to)}`, rowsTable('<th class="nosort">Account</th><th class="nosort num">Amount</th>', body));
  }

  async function renderBalance(to) {
    const d = await get(`/api/reports/balance-sheet?to=${to}`);
    const sec = (label, list, total) => `
      <tr><td colspan="2" style="font-weight:700;padding-top:14px;color:var(--muted);text-transform:uppercase;font-size:12px;letter-spacing:.04em">${label}</td></tr>
      ${list.map((r) => `<tr><td style="padding-left:18px">${escapeHtml(r.name)}</td><td class="num">${fmtAED(r.amount)}</td></tr>`).join('') || `<tr><td class="muted" style="padding-left:18px">None</td><td class="num">—</td></tr>`}
      <tr><td style="font-weight:700">Total ${label}</td><td class="num" style="font-weight:700">${fmtAED(total)}</td></tr>`;
    const body = sec('Assets', d.assets, d.totalAssets) + sec('Liabilities', d.liabilities, d.totalLiabilities) + sec('Equity', d.equity, d.totalEquity) +
      `<tr><td style="font-weight:800;padding-top:14px">Liabilities + Equity</td><td class="num" style="font-weight:800;padding-top:14px">${fmtAED(d.totalLiabilitiesAndEquity)}</td></tr>`;
    const note = d.balanced ? `<div class="muted" style="font-size:12px;margin-top:10px">${icon('check2')} Balanced — Assets = Liabilities + Equity</div>` : `<div class="neg" style="font-size:12px;margin-top:10px">⚠ Out of balance</div>`;
    return shell('Balance Sheet', `As of ${fmtDate(to)}`, rowsTable('<th class="nosort">Account</th><th class="nosort num">Amount</th>', body) + note);
  }

  async function renderTrial(to) {
    const d = await get(`/api/reports/trial-balance?to=${to}`);
    const body = d.rows.map((r) => `<tr><td>${escapeHtml(r.code || '')} · ${escapeHtml(r.name)}</td><td class="num">${r.debit ? fmtAED(r.debit) : '—'}</td><td class="num">${r.credit ? fmtAED(r.credit) : '—'}</td></tr>`).join('');
    const foot = `<tr><td style="font-weight:800">Total</td><td class="num" style="font-weight:800">${fmtAED(d.totalDebit)}</td><td class="num" style="font-weight:800">${fmtAED(d.totalCredit)}</td></tr>`;
    return shell('Trial Balance', `As of ${fmtDate(to)}`, rowsTable('<th class="nosort">Account</th><th class="nosort num">Debit</th><th class="nosort num">Credit</th>', body, foot));
  }

  async function renderGL(from, to) {
    const rows = await get(`/api/reports/general-ledger?from=${from}&to=${to}`);
    let running = {};
    const body = rows.map((l) => {
      running[l.account_id] = (running[l.account_id] || 0) + (l.debit - l.credit);
      return `<tr><td>${fmtDate(l.journal_date)}</td><td>${escapeHtml(l.account_code || '')} · ${escapeHtml(l.account_name)}</td>
        <td>${escapeHtml(l.journal_number || '')} <span class="muted">${escapeHtml(l.reference || '')}</span></td>
        <td class="num">${l.debit ? fmtAED(l.debit) : '—'}</td><td class="num">${l.credit ? fmtAED(l.credit) : '—'}</td></tr>`;
    }).join('');
    return shell('General Ledger', `${fmtDate(from)} — ${fmtDate(to)} · ${rows.length} lines`,
      rowsTable('<th class="nosort">Date</th><th class="nosort">Account</th><th class="nosort">Journal</th><th class="nosort num">Debit</th><th class="nosort num">Credit</th>', body || `<tr><td colspan="5" class="muted" style="text-align:center;padding:20px">No transactions</td></tr>`));
  }

  async function renderAging(url, title, to) {
    const d = await get(`${url}?to=${to}`);
    const b = d.buckets;
    const summary = `<div class="table-wrap" style="border:none;box-shadow:none;margin-bottom:14px"><table class="data">
      <thead><tr><th class="nosort num">Current</th><th class="nosort num">1–30</th><th class="nosort num">31–60</th><th class="nosort num">61–90</th><th class="nosort num">90+</th><th class="nosort num">Total</th></tr></thead>
      <tbody><tr><td class="num">${fmtAED(b.current)}</td><td class="num">${fmtAED(b.d1_30)}</td><td class="num">${fmtAED(b.d31_60)}</td><td class="num">${fmtAED(b.d61_90)}</td><td class="num">${fmtAED(b.d90p)}</td><td class="num"><strong>${fmtAED(d.total)}</strong></td></tr></tbody></table></div>`;
    const body = d.list.length ? d.list.map((r) => `<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.doc)}</td><td>${fmtDate(r.due)}</td><td class="num">${r.days}d</td><td class="num"><strong>${fmtAED(r.balance)}</strong></td></tr>`).join('')
      : `<tr><td colspan="5" class="muted" style="text-align:center;padding:20px">Nothing outstanding 🎉</td></tr>`;
    return shell(title, `As of ${fmtDate(d.asOf)}`, summary + rowsTable('<th class="nosort">Name</th><th class="nosort">Document</th><th class="nosort">Due</th><th class="nosort num">Overdue</th><th class="nosort num">Balance</th>', body));
  }

  async function renderVat(from, to) {
    const d = await get(`/api/reports/vat?from=${from}&to=${to}`);
    const body = `
      <tr><td>Output VAT (on sales)</td><td class="num">${fmtAED(d.outputVat)}</td></tr>
      <tr><td>Input VAT (on purchases — recoverable)</td><td class="num">${fmtAED(d.inputVat)}</td></tr>
      <tr><td style="font-weight:800;padding-top:12px">Net VAT ${d.netPayable >= 0 ? 'payable to FTA' : 'refundable'}</td><td class="num" style="font-weight:800;padding-top:12px"><span class="${d.netPayable >= 0 ? 'neg' : 'pos'}">${fmtAED(Math.abs(d.netPayable))}</span></td></tr>`;
    return shell('VAT Summary (UAE 5%)', `${fmtDate(from)} — ${fmtDate(to)}`, rowsTable('<th class="nosort">Description</th><th class="nosort num">Amount</th>', body));
  }
}
