import { get, icon, fmtAED, fmtDate, escapeHtml, toast } from '../api.js';
import { pageHead } from '../ui.js';

const DATASETS = {
  meetings: { label: 'Meetings', url: '/api/meetings', cols: ['meeting_date', 'client_name', 'business_category', 'meeting_type', 'meeting_mode', 'confirmed_by', 'status', 'remarks'] },
  leads: { label: 'Leads', url: '/api/leads', cols: ['name', 'business_category', 'status', 'source', 'next_action'] },
  deals: { label: 'Deals', url: '/api/deals', cols: ['name', 'account_name', 'contact_name', 'amount', 'stage', 'probability', 'closing_date', 'owner'] },
  tasks: { label: 'Tasks', url: '/api/tasks', cols: ['subject', 'related_to', 'task_type', 'due_date', 'priority', 'status', 'owner'] },
  customers: { label: 'Customers', url: '/api/contacts', cols: ['display_name', 'company_name', 'email', 'phone', 'trn', 'payment_terms'] },
  invoices: { label: 'Invoices', url: '/api/invoices', cols: ['invoice_number', 'client_name', 'issue_date', 'due_date', 'status', 'total'] },
  estimates: { label: 'Estimates', url: '/api/estimates', cols: ['estimate_number', 'client_name', 'estimate_date', 'expiry_date', 'status', 'total'] },
  bills: { label: 'Bills', url: '/api/bills', cols: ['bill_number', 'vendor_name', 'bill_date', 'due_date', 'status', 'total'] },
  payments: { label: 'Payments', url: '/api/payments', cols: ['payment_number', 'payment_type', 'party_name', 'payment_date', 'mode', 'amount'] },
  expenses: { label: 'Expenses', url: '/api/expenses', cols: ['expense_date', 'person', 'category', 'other_details', 'amount', 'description'] },
};

export default async function reports(view) {
  view.innerHTML = pageHead({
    title: 'Reports & Export', desc: 'Export any module to Excel (CSV) or print a branded PDF.',
    actions: `<button class="btn btn-outline" id="csvBtn">${icon('download')} Export Excel (CSV)</button>
              <button class="btn btn-primary" id="pdfBtn">${icon('print')} Print / PDF</button>`,
  }) + `
    <div class="toolbar">
      <select id="ds">${Object.entries(DATASETS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select>
      <select id="mo"><option value="">All time</option></select>
    </div>
    <div id="report"></div>`;

  let current = 'meetings', allRows = [], monthField = 'meeting_date';
  const dsSel = view.querySelector('#ds'), moSel = view.querySelector('#mo');
  dsSel.onchange = () => { current = dsSel.value; load(); };
  moSel.onchange = render;
  view.querySelector('#csvBtn').onclick = exportCsv;
  view.querySelector('#pdfBtn').onclick = () => window.print();
  load();

  async function load() {
    const cfg = DATASETS[current];
    allRows = await get(cfg.url);
    monthField = cfg.cols[0];
    const months = [...new Set(allRows.map((r) => (r[monthField] || '').slice(0, 7)).filter(Boolean))].sort();
    moSel.innerHTML = `<option value="">All time</option>` + months.map((m) => `<option value="${m}">${new Date(m + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</option>`).join('');
    render();
  }

  function filtered() {
    const mo = moSel.value;
    return mo ? allRows.filter((r) => (r[monthField] || '').slice(0, 7) === mo) : allRows;
  }

  function render() {
    const cfg = DATASETS[current];
    const rows = filtered();
    const isMoney = cfg.cols.includes('amount') || cfg.cols.includes('total');
    const moneyKey = cfg.cols.includes('amount') ? 'amount' : 'total';
    const totalMoney = isMoney ? rows.reduce((s, r) => s + Number(r[moneyKey] || 0), 0) : null;
    view.querySelector('#report').innerHTML = `
      <div class="card" id="printArea">
        <div class="card-pad" style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:12px"><img class="logo-light" src="/assets/devx-logo-full.png" alt="DevX Technologies" style="height:34px"><img class="logo-dark" src="/assets/devx-logo-dark.png" alt="DevX Technologies" style="height:34px"><div><strong>${cfg.label} Report</strong><div class="muted" style="font-size:12px">${moSel.options[moSel.selectedIndex].text} · ${rows.length} records${totalMoney != null ? ' · ' + fmtAED(totalMoney) : ''}</div></div></div>
          <div class="muted" style="font-size:12px">DevX Technologies LLC</div>
        </div>
        <div class="table-wrap" style="border:none;box-shadow:none">
          <table class="data"><thead><tr>${cfg.cols.map((c) => `<th class="nosort ${c === 'amount' || c === 'total' ? 'num' : ''}">${label(c)}</th>`).join('')}</tr></thead>
          <tbody>${rows.map((r) => `<tr>${cfg.cols.map((c) => `<td class="${c === 'amount' || c === 'total' ? 'num' : ''}">${cell(r, c)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${cfg.cols.length}" class="muted" style="padding:24px;text-align:center">No records</td></tr>`}</tbody>
          ${totalMoney != null ? `<tfoot><tr><td colspan="${cfg.cols.length - 1}" style="text-align:right;font-weight:700">Total</td><td class="num" style="font-weight:700">${fmtAED(totalMoney)}</td></tr></tfoot>` : ''}
          </table>
        </div>
      </div>`;
  }

  function cell(r, c) {
    const v = r[c];
    if (c.endsWith('_date')) return fmtDate(v);
    if (c === 'amount' || c === 'total') return fmtAED(v);
    return escapeHtml(v ?? '—');
  }

  function exportCsv() {
    const cfg = DATASETS[current];
    const rows = filtered();
    const head = cfg.cols.map(label).join(',');
    const body = rows.map((r) => cfg.cols.map((c) => csv(r[c])).join(',')).join('\n');
    const blob = new Blob(['﻿' + head + '\n' + body], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `devx-${current}-${moSel.value || 'all'}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
    toast('Exported ' + a.download, 'ok');
  }
}

function label(c) { return c.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()); }
function csv(v) { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
