import { get, post, put, del, uploadFile, icon, fmtAED, fmtDate, escapeHtml, toast, openModal, confirmDialog, optionList } from '../api.js';
import { pageHead, kpiRow, listView, rowActionButtons } from '../ui.js';
import { makeChart, chartCard } from '../charts.js';

const CATEGORIES = ['Office Expense', 'Food', 'Travel', 'Other Expense'];

export default async function expenses(view, ctx) {
  const isAdmin = ctx.user.role === 'admin';
  let rows = await get('/api/expenses');
  const users = await get('/api/users').catch(() => []);
  const persons = users.map((u) => u.full_name);

  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const monthKey = new Date().toISOString().slice(0, 7);
  const monthTotal = rows.filter((r) => (r.expense_date || '').slice(0, 7) === monthKey).reduce((s, r) => s + Number(r.amount || 0), 0);
  const withReceipt = rows.filter((r) => r.receipt_url).length;

  view.innerHTML = pageHead({
    title: 'Expense Tracker', desc: 'Company spending — replaces the Google Form → Excel workflow.',
    actions: `<button class="btn btn-primary" id="addBtn">${icon('plus')} Add Expense</button>`,
  }) + kpiRow([
    { label: 'Total spend', value: fmtAED(total), icon: 'wallet', tone: 'red' },
    { label: 'This month', value: fmtAED(monthTotal), icon: 'trending', tone: 'amber' },
    { label: 'Entries', value: rows.length, icon: 'receipt' },
    { label: 'With receipts', value: `${withReceipt}/${rows.length}`, icon: 'paperclip', tone: 'green' },
  ]) + `<div class="grid cols-2 mb16" id="charts"></div><div id="ebody"></div>`;

  view.querySelector('#addBtn').onclick = () => openForm();
  renderCharts();
  renderList();

  function renderCharts() {
    const byCat = groupSum(rows, 'category');
    const byMonth = monthlySeries(rows, 'expense_date', 'amount');
    const el = view.querySelector('#charts');
    el.innerHTML = chartCard('Spend by category', 'cCat') + chartCard('Spend by month', 'cMonth');
    makeChart('cCat', 'doughnut', {
      labels: Object.keys(byCat), datasets: [{ data: Object.values(byCat) }],
    });
    makeChart('cMonth', 'bar', {
      labels: byMonth.labels, datasets: [{ label: 'AED', data: byMonth.data }],
    });
  }

  function renderList() {
    listView({
      mount: view.querySelector('#ebody'), rows,
      searchKeys: ['person', 'category', 'other_details', 'description'],
      filters: [
        { key: 'category', label: 'Category', options: ['All', ...CATEGORIES], match: (r, v) => r.category === v },
        { key: 'person', label: 'Person', options: ['All', ...persons], match: (r, v) => r.person === v },
        { key: 'month', label: 'Month', options: ['All', ...[...new Set(rows.map((r) => (r.expense_date || '').slice(0, 7)))].sort()], match: (r, v) => (r.expense_date || '').slice(0, 7) === v },
      ],
      empty: 'No expenses yet.',
      columns: [
        { label: 'Date', sort: (r) => r.expense_date, render: (r) => fmtDate(r.expense_date) },
        { label: 'Person', sort: (r) => r.person, render: (r) => escapeHtml(r.person) },
        { label: 'Category', sort: (r) => r.category, render: (r) => escapeHtml(r.category) },
        { label: 'Details', render: (r) => `${escapeHtml(r.other_details || '—')}${r.description ? `<div class="muted" style="font-size:12px">${escapeHtml(r.description)}</div>` : ''}` },
        { label: 'Amount', align: 'right', sort: (r) => Number(r.amount), render: (r) => `<strong>${fmtAED(r.amount)}</strong>` },
        { label: 'Receipt', render: (r) => r.receipt_url ? `<a href="${escapeHtml(r.receipt_url)}" target="_blank" rel="noopener">${icon('paperclip')}</a>` : '<span class="muted">—</span>' },
        { label: '', align: 'right', render: () => rowActionButtons(isAdmin) },
      ],
      onRowsRendered: (tbody) => tbody.querySelectorAll('tr').forEach((tr) => {
        const row = rows.find((r) => r.id == tr.dataset.id);
        tr.querySelector('[data-edit]')?.addEventListener('click', () => openForm(row));
        tr.querySelector('[data-del]')?.addEventListener('click', async () => {
          if (await confirmDialog(`Delete this ${fmtAED(row.amount)} expense?`)) {
            await del('/api/expenses/' + row.id); rows = rows.filter((r) => r.id !== row.id);
            toast('Expense deleted', 'ok'); refresh();
          }
        });
      }),
    });
  }

  function refresh() { renderCharts(); renderList(); }

  function openForm(row) {
    const r = row || {};
    openModal({
      title: row ? 'Edit expense' : 'Add expense',
      body: `<form id="ef">
        <div class="grid-2">
          <div class="field"><label>Person</label><select class="select" name="person" required><option value="">Select…</option>${optionList(persons, r.person || '')}</select></div>
          <div class="field"><label>Category</label><select class="select" name="category">${optionList(CATEGORIES, r.category || 'Office Expense')}</select></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>Amount (AED)</label><input class="input" type="number" step="0.01" name="amount" value="${r.amount ?? ''}" required></div>
          <div class="field"><label>Expense date</label><input class="input" type="date" name="expense_date" value="${r.expense_date || ''}" required></div>
        </div>
        <div class="field"><label>Details</label><input class="input" name="other_details" value="${escapeHtml(r.other_details || '')}" placeholder="e.g. DOMAIN, Visa Expense"></div>
        <div class="field"><label>Description / comment</label><input class="input" name="description" value="${escapeHtml(r.description || '')}"></div>
        <div class="field"><label>Receipt (image / PDF)</label>
          <input class="input" type="file" name="receipt" accept="image/*,application/pdf">
          ${r.receipt_url ? `<div class="muted" style="font-size:12px;margin-top:4px">Current: <a href="${escapeHtml(r.receipt_url)}" target="_blank">view receipt</a></div>` : ''}</div>
      </form>`,
      footer: `<button class="btn btn-outline" data-close>Cancel</button><button class="btn btn-primary" data-save>${row ? 'Save' : 'Add expense'}</button>`,
      onMount: (back, close) => {
        back.querySelector('[data-save]').onclick = async () => {
          const form = back.querySelector('#ef');
          const fd = Object.fromEntries(new FormData(form));
          if (!fd.person || !fd.amount || !fd.expense_date) return toast('Person, amount and date are required', 'err');
          const btn = back.querySelector('[data-save]'); btn.disabled = true;
          try {
            let receipt_url = r.receipt_url || null;
            const file = form.receipt.files[0];
            if (file) { const up = await uploadFile(file); receipt_url = up.url; }
            const payload = {
              person: fd.person, category: fd.category, amount: Number(fd.amount),
              expense_date: fd.expense_date, other_details: fd.other_details, description: fd.description,
              receipt_url, month: new Date(fd.expense_date).toLocaleDateString('en-GB', { month: 'short' }),
            };
            if (row) { const u = await put('/api/expenses/' + row.id, payload); Object.assign(rows.find((x) => x.id === row.id), u); }
            else { rows.unshift(await post('/api/expenses', payload)); }
            toast(row ? 'Expense updated' : 'Expense added', 'ok'); close(); refresh();
          } catch (e) { toast(e.message, 'err'); btn.disabled = false; }
        };
      },
    });
  }
}

function groupSum(rows, key) {
  const o = {};
  for (const r of rows) o[r[key] || '—'] = (o[r[key] || '—'] || 0) + Number(r.amount || 0);
  return o;
}
function monthlySeries(rows, dateKey, valKey) {
  const o = {};
  for (const r of rows) { const k = (r[dateKey] || '').slice(0, 7); if (k) o[k] = (o[k] || 0) + Number(r[valKey] || 0); }
  const labels = Object.keys(o).sort();
  return { labels: labels.map((l) => new Date(l + '-01').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })), data: labels.map((l) => o[l]) };
}
