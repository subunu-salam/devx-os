import { get, post, put, del, icon, badge, fmtAED, fmtDate, escapeHtml, toast, openModal, confirmDialog, optionList } from '../api.js';
import { pageHead, kpiRow, listView } from '../ui.js';

const FREQ = ['Weekly', 'Monthly', 'Quarterly', 'Yearly'];
const STATUS = ['Active', 'Paused', 'Stopped'];

export default async function recurringInvoices(view, ctx) {
  const isAdmin = ctx.user.role === 'admin';
  let rows = await get('/api/recurring-invoices');
  let customers = (await get('/api/contacts').catch(() => [])).filter((c) => c.contact_type === 'customer');

  view.innerHTML = pageHead({
    title: 'Recurring Invoices', desc: 'Templates that bill customers on a schedule — generate invoices with one click.',
    actions: `<button class="btn btn-primary" id="addBtn">${icon('plus')} New Profile</button>`,
  }) + kpiRow([
    { label: 'Active profiles', value: rows.filter((r) => r.status === 'Active').length, icon: 'clock', tone: 'green' },
    { label: 'Recurring value', value: fmtAED(rows.filter((r) => r.status === 'Active').reduce((s, r) => s + r.total, 0)), sub: 'per cycle', icon: 'trending' },
    { label: 'Invoices generated', value: rows.reduce((s, r) => s + (r.generated_count || 0), 0), icon: 'invoice' },
  ]) + `<div id="rbody"></div>`;

  view.querySelector('#addBtn').onclick = () => openForm();
  renderList();

  function renderList() {
    listView({
      mount: view.querySelector('#rbody'), rows,
      searchKeys: ['profile_name', 'client_name'],
      filters: [{ key: 'status', label: 'Status', options: ['All', ...STATUS], match: (r, v) => r.status === v }],
      empty: 'No recurring profiles yet.',
      columns: [
        { label: 'Profile', sort: (r) => r.profile_name, render: (r) => `<strong>${escapeHtml(r.profile_name)}</strong><div class="muted" style="font-size:12px">${escapeHtml(r.client_name)}</div>` },
        { label: 'Frequency', sort: (r) => r.frequency, render: (r) => escapeHtml(r.frequency) },
        { label: 'Next date', sort: (r) => r.next_date || '', render: (r) => fmtDate(r.next_date) },
        { label: 'Status', sort: (r) => r.status, render: (r) => badge(r.status === 'Active' ? 'Paid' : r.status === 'Paused' ? 'Pending' : 'Cancelled') },
        { label: 'Amount', align: 'right', sort: (r) => Number(r.total), render: (r) => `<strong>${fmtAED(r.total)}</strong>` },
        { label: '', align: 'right', render: (r) => `<div class="row-actions">
          <button class="btn btn-ghost btn-icon btn-sm" data-gen="${r.id}" title="Generate invoice now">${icon('invoice')}</button>
          <button class="btn btn-ghost btn-icon btn-sm" data-edit="${r.id}" title="Edit">${icon('edit')}</button>
          ${isAdmin ? `<button class="btn btn-ghost btn-icon btn-sm" data-del="${r.id}" title="Delete" style="color:var(--red)">${icon('trash')}</button>` : ''}
        </div>` },
      ],
      onRowsRendered: (tbody) => {
        tbody.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => openForm(rows.find((r) => r.id == b.dataset.edit)));
        tbody.querySelectorAll('[data-gen]').forEach((b) => b.onclick = async () => {
          if (await confirmDialog('Generate an invoice now from this profile?', { danger: false, confirmText: 'Generate' })) {
            try { await post(`/api/recurring-invoices/${b.dataset.gen}/generate`); rows = await get('/api/recurring-invoices'); toast('Invoice generated', 'ok'); renderList(); }
            catch (e) { toast(e.message, 'err'); }
          }
        });
        tbody.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
          const r = rows.find((x) => x.id == b.dataset.del);
          if (await confirmDialog(`Delete profile ${r.profile_name}?`)) { await del('/api/recurring-invoices/' + r.id); rows = rows.filter((x) => x.id !== r.id); toast('Deleted', 'ok'); renderList(); }
        });
      },
    });
  }

  function lineRow(it = {}) {
    return `<tr class="li">
      <td><input class="input" data-f="description" value="${escapeHtml(it.description || '')}" placeholder="Item / service"></td>
      <td style="width:80px"><input class="input" data-f="qty" type="number" step="0.01" value="${it.qty ?? 1}"></td>
      <td style="width:120px"><input class="input" data-f="unit_price" type="number" step="0.01" value="${it.unit_price ?? ''}"></td>
      <td style="width:120px" class="num amt">0.00</td>
      <td style="width:36px"><button class="btn btn-ghost btn-icon btn-sm" data-rm style="color:var(--red)">${icon('x')}</button></td>
    </tr>`;
  }

  function openForm(row) {
    const r = row || {};
    openModal({
      title: row ? `Edit ${row.profile_name}` : 'New recurring profile', size: 'lg',
      body: `<form id="rf">
        <div class="grid-3">
          <div class="field"><label>Profile name</label><input class="input" name="profile_name" value="${escapeHtml(r.profile_name || '')}" required></div>
          <div class="field"><label>Customer</label><input class="input" name="client_name" list="rCust" value="${escapeHtml(r.client_name || '')}" required>
            <datalist id="rCust">${customers.map((c) => `<option value="${escapeHtml(c.display_name)}">`).join('')}</datalist></div>
          <div class="field"><label>Frequency</label><select class="select" name="frequency">${optionList(FREQ, r.frequency || 'Monthly')}</select></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>Start date</label><input class="input" type="date" name="start_date" value="${r.start_date || new Date().toISOString().slice(0, 10)}"></div>
          <div class="field"><label>Status</label><select class="select" name="status">${optionList(STATUS, r.status || 'Active')}</select></div>
        </div>
        <label style="font-weight:600;font-size:13px">Line items</label>
        <div class="table-wrap" style="margin:6px 0 10px"><table class="data"><thead><tr><th class="nosort">Description</th><th class="nosort">Qty</th><th class="nosort">Unit price</th><th class="nosort num">Amount</th><th class="nosort"></th></tr></thead>
          <tbody id="items">${lineRow()}</tbody></table></div>
        <button type="button" class="btn btn-outline btn-sm" id="addItem">${icon('plus')} Add item</button>
        <div class="grid-2" style="margin-top:14px"><div class="field"><label>VAT %</label><input class="input" type="number" step="0.01" name="tax_percent" value="${r.tax_percent ?? 5}"></div><div></div></div>
        <div class="card-pad" style="background:var(--subtle);border-radius:10px;text-align:right">
          <div>Subtotal: <strong id="sSub">AED 0.00</strong></div><div>VAT: <strong id="sTax">AED 0.00</strong></div>
          <div style="font-size:18px;margin-top:4px">Total per cycle: <strong id="sTot" class="pos">AED 0.00</strong></div>
        </div>
      </form>`,
      footer: `<button class="btn btn-outline" data-close>Cancel</button><button class="btn btn-primary" data-save>${row ? 'Save' : 'Create profile'}</button>`,
      onMount: async (back, close) => {
        const itemsEl = back.querySelector('#items');
        if (row) { const full = await get('/api/recurring-invoices/' + row.id); itemsEl.innerHTML = (full.items.length ? full.items : [{}]).map(lineRow).join(''); }
        const recalc = () => {
          let sub = 0;
          itemsEl.querySelectorAll('tr.li').forEach((tr) => { const q = Number(tr.querySelector('[data-f=qty]').value || 0), p = Number(tr.querySelector('[data-f=unit_price]').value || 0); const a = q * p; tr.querySelector('.amt').textContent = a.toFixed(2); sub += a; });
          const tax = sub * Number(back.querySelector('[name=tax_percent]').value || 0) / 100;
          back.querySelector('#sSub').textContent = fmtAED(sub); back.querySelector('#sTax').textContent = fmtAED(tax); back.querySelector('#sTot').textContent = fmtAED(sub + tax);
        };
        back.addEventListener('input', recalc);
        back.querySelector('#addItem').onclick = () => { itemsEl.insertAdjacentHTML('beforeend', lineRow()); recalc(); };
        itemsEl.addEventListener('click', (e) => { if (e.target.closest('[data-rm]')) { e.target.closest('tr').remove(); recalc(); } });
        recalc();
        back.querySelector('[data-save]').onclick = async () => {
          const fd = Object.fromEntries(new FormData(back.querySelector('#rf')));
          const items = [...itemsEl.querySelectorAll('tr.li')].map((tr) => ({ description: tr.querySelector('[data-f=description]').value, qty: Number(tr.querySelector('[data-f=qty]').value || 0), unit_price: Number(tr.querySelector('[data-f=unit_price]').value || 0) })).filter((it) => it.description || it.unit_price);
          if (!fd.profile_name || !fd.client_name) return toast('Profile name and customer are required', 'err');
          if (!items.length) return toast('Add at least one line', 'err');
          const payload = { ...fd, tax_percent: Number(fd.tax_percent || 0), items };
          try {
            if (row) await put('/api/recurring-invoices/' + row.id, payload); else await post('/api/recurring-invoices', payload);
            rows = await get('/api/recurring-invoices'); toast(row ? 'Saved' : 'Profile created', 'ok'); close(); renderList();
          } catch (e) { toast(e.message, 'err'); }
        };
      },
    });
  }
}
