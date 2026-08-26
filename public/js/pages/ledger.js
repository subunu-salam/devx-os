import { get, post, put, del, icon, fmtAED, fmtDate, escapeHtml, toast, openModal, confirmDialog, optionList } from '../api.js';
import { pageHead, kpiRow, listView, rowActionButtons } from '../ui.js';
import { makeChart, chartCard } from '../charts.js';

const TYPES = ['credit', 'debit'];
const METHODS = ['cash', 'card', 'cheque', 'bank'];
const CATS = ['Investment', 'Client Payment', 'Salary', 'Office', 'License / Govt', 'Bank Transfer', 'Refund', 'Other'];

export default async function ledger(view, ctx) {
  const isAdmin = ctx.user.role === 'admin';
  let rows = await get('/api/ledger');
  let expTotal = 0;
  try { expTotal = (await get('/api/expenses')).reduce((s, e) => s + Number(e.amount || 0), 0); } catch {}

  const credit = sum(rows.filter((r) => r.type === 'credit'));
  const debit = sum(rows.filter((r) => r.type === 'debit'));
  const netLedger = credit - debit;
  const netPosition = netLedger - expTotal;

  view.innerHTML = pageHead({
    title: 'Finance Ledger', desc: 'All money in and out — investments, income, and outflows.',
    actions: `<button class="btn btn-primary" id="addBtn">${icon('plus')} Add Entry</button>`,
  }) + kpiRow([
    { label: 'Total credit (in)', value: fmtAED(credit), icon: 'trending', tone: 'green' },
    { label: 'Total debit (out)', value: fmtAED(debit), icon: 'wallet', tone: 'red' },
    { label: 'Ledger balance', value: fmtAED(netLedger), icon: 'ledger', tone: netLedger >= 0 ? 'green' : 'red' },
    { label: 'Net company position', value: fmtAED(netPosition), sub: 'incl. tracked expenses', icon: 'layers', tone: netPosition >= 0 ? 'green' : 'red' },
  ]) + `<div class="grid cols-2 mb16" id="charts"></div><div id="lbody"></div>`;

  view.querySelector('#addBtn').onclick = () => openForm();
  renderCharts();
  renderList();

  function renderCharts() {
    // running balance over time
    const sorted = rows.slice().sort((a, b) => (a.entry_date || '').localeCompare(b.entry_date || ''));
    let bal = 0; const bl = [], bd = [];
    for (const r of sorted) { bal += r.type === 'credit' ? Number(r.amount) : -Number(r.amount); bl.push(fmtDate(r.entry_date)); bd.push(bal); }
    // credit vs debit by month
    const months = {};
    for (const r of rows) { const k = (r.entry_date || '').slice(0, 7); if (!k) continue; months[k] = months[k] || { c: 0, d: 0 }; months[k][r.type === 'credit' ? 'c' : 'd'] += Number(r.amount || 0); }
    const mk = Object.keys(months).sort();
    view.querySelector('#charts').innerHTML = chartCard('Running balance', 'lBal') + chartCard('Credit vs Debit by month', 'lCD');
    makeChart('lBal', 'line', { labels: bl, datasets: [{ label: 'Balance (AED)', data: bd }] });
    makeChart('lCD', 'bar', {
      labels: mk.map((m) => new Date(m + '-01').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })),
      datasets: [{ label: 'Credit', data: mk.map((m) => months[m].c), backgroundColor: '#46B37D' },
                 { label: 'Debit', data: mk.map((m) => months[m].d), backgroundColor: '#E5484D' }],
    }, { plugins: { legend: { display: true, position: 'bottom' } } });
  }

  function renderList() {
    listView({
      mount: view.querySelector('#lbody'), rows,
      searchKeys: ['category', 'description', 'party', 'reference'],
      filters: [
        { key: 'type', label: 'Type', options: ['All', 'credit', 'debit'], match: (r, v) => r.type === v },
        { key: 'method', label: 'Method', options: ['All', ...METHODS], match: (r, v) => r.method === v },
      ],
      empty: 'No ledger entries yet.',
      columns: [
        { label: 'Date', sort: (r) => r.entry_date, render: (r) => fmtDate(r.entry_date) },
        { label: 'Type', sort: (r) => r.type, render: (r) => `<span class="badge ${r.type === 'credit' ? 'b-green' : 'b-red'}">${r.type}</span>` },
        { label: 'Category', sort: (r) => r.category, render: (r) => escapeHtml(r.category || '—') },
        { label: 'Description', render: (r) => `${escapeHtml(r.description || '—')}${r.party ? `<div class="muted" style="font-size:12px">${escapeHtml(r.party)}</div>` : ''}` },
        { label: 'Method', render: (r) => escapeHtml(r.method || '—') },
        { label: 'Amount', align: 'right', sort: (r) => Number(r.amount), render: (r) => `<span class="${r.type === 'credit' ? 'pos' : 'neg'}">${r.type === 'credit' ? '+' : '−'} ${fmtAED(r.amount)}</span>` },
        { label: '', align: 'right', render: () => rowActionButtons(isAdmin) },
      ],
      onRowsRendered: (tbody) => tbody.querySelectorAll('tr').forEach((tr) => {
        const row = rows.find((r) => r.id == tr.dataset.id);
        tr.querySelector('[data-edit]')?.addEventListener('click', () => openForm(row));
        tr.querySelector('[data-del]')?.addEventListener('click', async () => {
          if (await confirmDialog('Delete this ledger entry?')) {
            await del('/api/ledger/' + row.id); rows = rows.filter((r) => r.id !== row.id); toast('Entry deleted', 'ok'); refresh();
          }
        });
      }),
    });
  }
  function refresh() { renderCharts(); renderList(); }

  function openForm(row) {
    const r = row || { type: 'credit' };
    openModal({
      title: row ? 'Edit ledger entry' : 'Add ledger entry',
      body: `<form id="lf">
        <div class="grid-2">
          <div class="field"><label>Type</label><select class="select" name="type">${optionList(TYPES, r.type)}</select></div>
          <div class="field"><label>Date</label><input class="input" type="date" name="entry_date" value="${r.entry_date || new Date().toISOString().slice(0, 10)}" required></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>Category</label><select class="select" name="category">${optionList(CATS, r.category || 'Other')}</select></div>
          <div class="field"><label>Amount (AED)</label><input class="input" type="number" step="0.01" name="amount" value="${r.amount ?? ''}" required></div>
        </div>
        <div class="field"><label>Description</label><input class="input" name="description" value="${escapeHtml(r.description || '')}"></div>
        <div class="grid-2">
          <div class="field"><label>Party</label><input class="input" name="party" value="${escapeHtml(r.party || '')}" placeholder="Who from / to"></div>
          <div class="field"><label>Method</label><select class="select" name="method"><option value="">—</option>${optionList(METHODS, r.method || '')}</select></div>
        </div>
        <div class="field"><label>Reference</label><input class="input" name="reference" value="${escapeHtml(r.reference || '')}"></div>
      </form>`,
      footer: `<button class="btn btn-outline" data-close>Cancel</button><button class="btn btn-primary" data-save>${row ? 'Save' : 'Add entry'}</button>`,
      onMount: (back, close) => {
        back.querySelector('[data-save]').onclick = async () => {
          const fd = Object.fromEntries(new FormData(back.querySelector('#lf')));
          if (!fd.amount) return toast('Amount is required', 'err');
          fd.amount = Number(fd.amount);
          try {
            if (row) { const u = await put('/api/ledger/' + row.id, fd); Object.assign(rows.find((x) => x.id === row.id), u); }
            else { rows.unshift(await post('/api/ledger', fd)); }
            toast(row ? 'Entry updated' : 'Entry added', 'ok'); close(); refresh();
          } catch (e) { toast(e.message, 'err'); }
        };
      },
    });
  }
}
const sum = (a) => a.reduce((s, r) => s + Number(r.amount || 0), 0);
