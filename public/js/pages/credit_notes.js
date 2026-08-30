import { get, post, del, icon, fmtAED, fmtDate, escapeHtml, toast, openModal, confirmDialog } from '../api.js';
import { pageHead, kpiRow, listView } from '../ui.js';

export default async function creditNotes(view, ctx) {
  const isAdmin = ctx.user.role === 'admin';
  let rows = await get('/api/credit-notes');
  let customers = (await get('/api/contacts').catch(() => [])).filter((c) => c.contact_type === 'customer');

  view.innerHTML = pageHead({
    title: 'Credit Notes', desc: 'Credits issued to customers — reduce receivables and reverse VAT.',
    actions: `<button class="btn btn-primary" id="addBtn">${icon('plus')} New Credit Note</button>`,
  }) + kpiRow([
    { label: 'Total credited', value: fmtAED(rows.reduce((s, r) => s + Number(r.total || 0), 0)), icon: 'receipt', tone: 'red' },
    { label: 'Credit notes', value: rows.length, icon: 'file' },
  ]) + `<div id="cbody"></div>`;

  view.querySelector('#addBtn').onclick = () => openForm();
  renderList();

  function renderList() {
    listView({
      mount: view.querySelector('#cbody'), rows,
      searchKeys: ['cn_number', 'client_name', 'reason'],
      empty: 'No credit notes yet.',
      columns: [
        { label: 'CN #', sort: (r) => r.cn_number, render: (r) => `<strong>${escapeHtml(r.cn_number)}</strong>` },
        { label: 'Customer', sort: (r) => r.client_name, render: (r) => escapeHtml(r.client_name) },
        { label: 'Date', sort: (r) => r.cn_date, render: (r) => fmtDate(r.cn_date) },
        { label: 'Reason', render: (r) => escapeHtml(r.reason || '—') },
        { label: 'Total', align: 'right', sort: (r) => Number(r.total), render: (r) => `<strong class="neg">${fmtAED(r.total)}</strong>` },
        { label: '', align: 'right', render: (r) => `<div class="row-actions">${isAdmin ? `<button class="btn btn-ghost btn-icon btn-sm" data-del="${r.id}" title="Delete" style="color:var(--red)">${icon('trash')}</button>` : ''}</div>` },
      ],
      onRowsRendered: (tbody) => tbody.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
        const r = rows.find((x) => x.id == b.dataset.del);
        if (await confirmDialog(`Delete credit note ${r.cn_number}?`)) { await del('/api/credit-notes/' + r.id); rows = rows.filter((x) => x.id !== r.id); toast('Credit note deleted', 'ok'); renderList(); }
      }),
    });
  }

  function lineRow(it = {}) {
    return `<tr class="li">
      <td><input class="input" data-f="description" value="${escapeHtml(it.description || '')}" placeholder="Item / reason"></td>
      <td style="width:80px"><input class="input" data-f="qty" type="number" step="0.01" value="${it.qty ?? 1}"></td>
      <td style="width:120px"><input class="input" data-f="unit_price" type="number" step="0.01" value="${it.unit_price ?? ''}"></td>
      <td style="width:120px" class="num amt">0.00</td>
      <td style="width:36px"><button class="btn btn-ghost btn-icon btn-sm" data-rm style="color:var(--red)">${icon('x')}</button></td>
    </tr>`;
  }

  function openForm() {
    openModal({
      title: 'New credit note', size: 'lg',
      body: `<form id="cf">
        <div class="grid-3">
          <div class="field"><label>Customer</label><input class="input" name="client_name" list="cnCust" required>
            <datalist id="cnCust">${customers.map((c) => `<option value="${escapeHtml(c.display_name)}">`).join('')}</datalist></div>
          <div class="field"><label>Date</label><input class="input" type="date" name="cn_date" value="${new Date().toISOString().slice(0, 10)}"></div>
          <div class="field"><label>VAT %</label><input class="input" type="number" step="0.01" name="tax_percent" value="5"></div>
        </div>
        <div class="field"><label>Reason</label><input class="input" name="reason" placeholder="e.g. Partial refund, discount"></div>
        <label style="font-weight:600;font-size:13px">Line items</label>
        <div class="table-wrap" style="margin:6px 0 10px"><table class="data"><thead><tr><th class="nosort">Description</th><th class="nosort">Qty</th><th class="nosort">Unit price</th><th class="nosort num">Amount</th><th class="nosort"></th></tr></thead>
          <tbody id="items">${lineRow()}</tbody></table></div>
        <button type="button" class="btn btn-outline btn-sm" id="addItem">${icon('plus')} Add item</button>
        <div class="card-pad" style="background:var(--subtle);border-radius:10px;text-align:right;margin-top:12px">
          <div>Subtotal: <strong id="sSub">AED 0.00</strong></div><div>VAT: <strong id="sTax">AED 0.00</strong></div>
          <div style="font-size:18px;margin-top:4px">Total credit: <strong id="sTot" class="neg">AED 0.00</strong></div>
        </div>
      </form>`,
      footer: `<button class="btn btn-outline" data-close>Cancel</button><button class="btn btn-primary" data-save>Create credit note</button>`,
      onMount: (back, close) => {
        const itemsEl = back.querySelector('#items');
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
          const fd = Object.fromEntries(new FormData(back.querySelector('#cf')));
          const items = [...itemsEl.querySelectorAll('tr.li')].map((tr) => ({ description: tr.querySelector('[data-f=description]').value, qty: Number(tr.querySelector('[data-f=qty]').value || 0), unit_price: Number(tr.querySelector('[data-f=unit_price]').value || 0) })).filter((it) => it.description || it.unit_price);
          if (!fd.client_name) return toast('Customer is required', 'err');
          if (!items.length) return toast('Add at least one line', 'err');
          try {
            await post('/api/credit-notes', { ...fd, tax_percent: Number(fd.tax_percent || 0), items });
            rows = await get('/api/credit-notes'); toast('Credit note created', 'ok'); close(); renderList();
          } catch (e) { toast(e.message, 'err'); }
        };
      },
    });
  }
}
