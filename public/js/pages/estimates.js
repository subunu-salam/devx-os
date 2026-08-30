import { get, post, put, del, icon, badge, fmtAED, fmtDate, escapeHtml, toast, openModal, confirmDialog, optionList } from '../api.js';
import { pageHead, kpiRow, listView } from '../ui.js';

const STATUSES = ['Draft', 'Sent', 'Accepted', 'Declined', 'Invoiced'];

export default async function estimates(view, ctx) {
  const isAdmin = ctx.user.role === 'admin';
  let rows = await get('/api/estimates');
  let customers = (await get('/api/contacts').catch(() => [])).filter((c) => c.contact_type === 'customer');

  const sumBy = (f) => rows.filter(f).reduce((s, r) => s + Number(r.total || 0), 0);
  view.innerHTML = pageHead({
    title: 'Estimates', desc: 'Quotes you send to customers — accept and convert them into invoices.',
    actions: `<button class="btn btn-primary" id="addBtn">${icon('plus')} New Estimate</button>`,
  }) + kpiRow([
    { label: 'Total quoted', value: fmtAED(sumBy(() => true)), icon: 'file' },
    { label: 'Accepted', value: fmtAED(sumBy((r) => r.status === 'Accepted')), icon: 'check2', tone: 'green' },
    { label: 'Sent / pending', value: fmtAED(sumBy((r) => r.status === 'Sent')), icon: 'clock', tone: 'amber' },
    { label: 'Converted', value: rows.filter((r) => r.status === 'Invoiced').length, sub: 'to invoices', icon: 'invoice' },
  ]) + `<div id="ebody"></div>`;

  view.querySelector('#addBtn').onclick = () => openForm();
  renderList();

  function renderList() {
    listView({
      mount: view.querySelector('#ebody'), rows,
      searchKeys: ['estimate_number', 'client_name'],
      filters: [{ key: 'status', label: 'Status', options: ['All', ...STATUSES], match: (r, v) => r.status === v }],
      empty: 'No estimates yet.',
      columns: [
        { label: 'Estimate #', sort: (r) => r.estimate_number, render: (r) => `<strong>${escapeHtml(r.estimate_number)}</strong>` },
        { label: 'Customer', sort: (r) => r.client_name, render: (r) => escapeHtml(r.client_name) },
        { label: 'Date', sort: (r) => r.estimate_date, render: (r) => fmtDate(r.estimate_date) },
        { label: 'Expiry', render: (r) => fmtDate(r.expiry_date) },
        { label: 'Status', sort: (r) => r.status, render: (r) => badge(r.status === 'Accepted' ? 'Won' : r.status === 'Declined' ? 'Lost' : r.status) },
        { label: 'Total', align: 'right', sort: (r) => Number(r.total), render: (r) => `<strong>${fmtAED(r.total)}</strong>` },
        { label: '', align: 'right', render: (r) => `<div class="row-actions">
          ${r.status !== 'Invoiced' ? `<button class="btn btn-ghost btn-icon btn-sm" data-conv="${r.id}" title="Convert to invoice">${icon('invoice')}</button>` : ''}
          <button class="btn btn-ghost btn-icon btn-sm" data-edit="${r.id}" title="Edit">${icon('edit')}</button>
          ${isAdmin ? `<button class="btn btn-ghost btn-icon btn-sm" data-del="${r.id}" title="Delete" style="color:var(--red)">${icon('trash')}</button>` : ''}
        </div>` },
      ],
      onRowsRendered: (tbody) => {
        tbody.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => openForm(rows.find((r) => r.id == b.dataset.edit)));
        tbody.querySelectorAll('[data-conv]').forEach((b) => b.onclick = async () => {
          if (await confirmDialog('Convert this estimate into an invoice?', { danger: false, confirmText: 'Convert' })) {
            try { await post(`/api/estimates/${b.dataset.conv}/convert`); rows = await get('/api/estimates'); toast('Converted to invoice', 'ok'); renderList(); }
            catch (e) { toast(e.message, 'err'); }
          }
        });
        tbody.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
          const r = rows.find((x) => x.id == b.dataset.del);
          if (await confirmDialog(`Delete estimate ${r.estimate_number}?`)) { await del('/api/estimates/' + r.id); rows = rows.filter((x) => x.id !== r.id); toast('Estimate deleted', 'ok'); renderList(); }
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
      title: row ? `Edit ${row.estimate_number}` : 'New estimate', size: 'lg',
      body: `<form id="ef">
        <div class="grid-3">
          <div class="field"><label>Customer</label><input class="input" name="client_name" list="custList" value="${escapeHtml(r.client_name || '')}" required>
            <datalist id="custList">${customers.map((c) => `<option value="${escapeHtml(c.display_name)}">`).join('')}</datalist></div>
          <div class="field"><label>Date</label><input class="input" type="date" name="estimate_date" value="${r.estimate_date || new Date().toISOString().slice(0, 10)}"></div>
          <div class="field"><label>Expiry date</label><input class="input" type="date" name="expiry_date" value="${r.expiry_date || ''}"></div>
        </div>
        <label style="font-weight:600;font-size:13px">Line items</label>
        <div class="table-wrap" style="margin:6px 0 10px"><table class="data"><thead><tr><th class="nosort">Description</th><th class="nosort">Qty</th><th class="nosort">Unit price</th><th class="nosort num">Amount</th><th class="nosort"></th></tr></thead>
          <tbody id="items">${lineRow()}</tbody></table></div>
        <button type="button" class="btn btn-outline btn-sm" id="addItem">${icon('plus')} Add item</button>
        <div class="grid-2" style="margin-top:14px">
          <div class="field"><label>VAT %</label><input class="input" type="number" step="0.01" name="tax_percent" value="${r.tax_percent ?? 5}"></div>
          <div class="field"><label>Status</label><select class="select" name="status">${optionList(STATUSES.filter((s) => s !== 'Invoiced'), r.status || 'Draft')}</select></div>
        </div>
        <div class="field"><label>Notes</label><textarea class="input" name="notes" rows="2">${escapeHtml(r.notes || '')}</textarea></div>
        <div class="card-pad" style="background:var(--subtle);border-radius:10px;text-align:right">
          <div>Subtotal: <strong id="sSub">AED 0.00</strong></div><div>VAT: <strong id="sTax">AED 0.00</strong></div>
          <div style="font-size:18px;margin-top:4px">Total: <strong id="sTot" class="pos">AED 0.00</strong></div>
        </div>
      </form>`,
      footer: `<button class="btn btn-outline" data-close>Cancel</button><button class="btn btn-primary" data-save>${row ? 'Save' : 'Create estimate'}</button>`,
      onMount: async (back, close) => {
        const itemsEl = back.querySelector('#items');
        if (row) { const full = await get('/api/estimates/' + row.id); itemsEl.innerHTML = (full.items.length ? full.items : [{}]).map(lineRow).join(''); }
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
          const fd = Object.fromEntries(new FormData(back.querySelector('#ef')));
          const items = [...itemsEl.querySelectorAll('tr.li')].map((tr) => ({ description: tr.querySelector('[data-f=description]').value, qty: Number(tr.querySelector('[data-f=qty]').value || 0), unit_price: Number(tr.querySelector('[data-f=unit_price]').value || 0) })).filter((it) => it.description || it.unit_price);
          if (!fd.client_name) return toast('Customer is required', 'err');
          const payload = { ...fd, tax_percent: Number(fd.tax_percent || 0), items };
          try {
            if (row) await put('/api/estimates/' + row.id, payload); else await post('/api/estimates', payload);
            rows = await get('/api/estimates'); toast(row ? 'Estimate updated' : 'Estimate created', 'ok'); close(); renderList();
          } catch (e) { toast(e.message, 'err'); }
        };
      },
    });
  }
}
