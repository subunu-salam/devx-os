import { get, post, put, del, icon, badge, fmtAED, fmtDate, escapeHtml, toast, openModal, confirmDialog, optionList } from '../api.js';
import { pageHead, kpiRow, listView } from '../ui.js';

const STATUSES = ['Draft', 'Open', 'Partially Paid', 'Paid', 'Cancelled'];

export default async function bills(view, ctx) {
  const isAdmin = ctx.user.role === 'admin';
  let rows = await get('/api/bills');
  let vendors = (await get('/api/contacts').catch(() => [])).filter((c) => c.contact_type === 'vendor');
  let accounts = await get('/api/accounts').catch(() => []);
  const expenseAccts = accounts.filter((a) => ['expense', 'asset'].includes(a.account_type) && a.is_active);

  const sumBy = (f) => rows.filter(f).reduce((s, r) => s + Number(r.total || 0), 0);
  const outstanding = rows.reduce((s, r) => s + (Number(r.total || 0) - Number(r.amount_paid || 0)) * (['Paid', 'Cancelled', 'Draft'].includes(r.status) ? 0 : 1), 0);
  view.innerHTML = pageHead({
    title: 'Bills', desc: 'Vendor bills you owe — posts to Accounts Payable and expense accounts.',
    actions: `<button class="btn btn-primary" id="addBtn">${icon('plus')} New Bill</button>`,
  }) + kpiRow([
    { label: 'Total billed', value: fmtAED(sumBy(() => true)), icon: 'invoice' },
    { label: 'Paid', value: fmtAED(rows.reduce((s, r) => s + Number(r.amount_paid || 0), 0)), icon: 'check2', tone: 'green' },
    { label: 'Outstanding (AP)', value: fmtAED(outstanding), icon: 'clock', tone: 'amber' },
    { label: 'Bills', value: rows.length, icon: 'receipt' },
  ]) + `<div id="bbody"></div>`;

  view.querySelector('#addBtn').onclick = () => openForm();
  renderList();

  function renderList() {
    listView({
      mount: view.querySelector('#bbody'), rows,
      searchKeys: ['bill_number', 'vendor_name'],
      filters: [{ key: 'status', label: 'Status', options: ['All', ...STATUSES], match: (r, v) => r.status === v }],
      empty: 'No bills yet.',
      columns: [
        { label: 'Bill #', sort: (r) => r.bill_number, render: (r) => `<strong>${escapeHtml(r.bill_number)}</strong>` },
        { label: 'Vendor', sort: (r) => r.vendor_name, render: (r) => escapeHtml(r.vendor_name) },
        { label: 'Date', sort: (r) => r.bill_date, render: (r) => fmtDate(r.bill_date) },
        { label: 'Due', render: (r) => fmtDate(r.due_date) },
        { label: 'Status', sort: (r) => r.status, render: (r) => badge(statusBadge(r.status)) },
        { label: 'Balance', align: 'right', sort: (r) => Number(r.total) - Number(r.amount_paid), render: (r) => `<strong>${fmtAED(r.total - (r.amount_paid || 0))}</strong><div class="muted" style="font-size:11px">of ${fmtAED(r.total)}</div>` },
        { label: '', align: 'right', render: (r) => `<div class="row-actions">
          ${!['Paid', 'Cancelled', 'Draft'].includes(r.status) ? `<button class="btn btn-ghost btn-icon btn-sm" data-pay="${r.id}" title="Record payment">${icon('wallet')}</button>` : ''}
          <button class="btn btn-ghost btn-icon btn-sm" data-edit="${r.id}" title="Edit">${icon('edit')}</button>
          ${isAdmin ? `<button class="btn btn-ghost btn-icon btn-sm" data-del="${r.id}" title="Delete" style="color:var(--red)">${icon('trash')}</button>` : ''}
        </div>` },
      ],
      onRowsRendered: (tbody) => {
        tbody.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => openForm(rows.find((r) => r.id == b.dataset.edit)));
        tbody.querySelectorAll('[data-pay]').forEach((b) => b.onclick = () => recordPayment(rows.find((r) => r.id == b.dataset.pay)));
        tbody.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
          const r = rows.find((x) => x.id == b.dataset.del);
          if (await confirmDialog(`Delete bill ${r.bill_number}?`)) { await del('/api/bills/' + r.id); rows = rows.filter((x) => x.id !== r.id); toast('Bill deleted', 'ok'); renderList(); }
        });
      },
    });
  }

  function acctSelect(sel) {
    return `<select class="select" data-f="account_id">${expenseAccts.map((a) => `<option value="${a.id}"${a.id == sel ? ' selected' : ''}>${escapeHtml(a.code + ' · ' + a.name)}</option>`).join('')}</select>`;
  }
  function lineRow(it = {}) {
    return `<tr class="li">
      <td>${acctSelect(it.account_id)}</td>
      <td><input class="input" data-f="description" value="${escapeHtml(it.description || '')}" placeholder="Details"></td>
      <td style="width:70px"><input class="input" data-f="qty" type="number" step="0.01" value="${it.qty ?? 1}"></td>
      <td style="width:110px"><input class="input" data-f="unit_price" type="number" step="0.01" value="${it.unit_price ?? ''}"></td>
      <td style="width:110px" class="num amt">0.00</td>
      <td style="width:32px"><button class="btn btn-ghost btn-icon btn-sm" data-rm style="color:var(--red)">${icon('x')}</button></td>
    </tr>`;
  }

  function openForm(row) {
    const r = row || {};
    openModal({
      title: row ? `Edit ${row.bill_number}` : 'New bill', size: 'lg',
      body: `<form id="bf">
        <div class="grid-3">
          <div class="field"><label>Vendor</label><input class="input" name="vendor_name" list="venList" value="${escapeHtml(r.vendor_name || '')}" required>
            <datalist id="venList">${vendors.map((c) => `<option value="${escapeHtml(c.display_name)}">`).join('')}</datalist></div>
          <div class="field"><label>Bill date</label><input class="input" type="date" name="bill_date" value="${r.bill_date || new Date().toISOString().slice(0, 10)}"></div>
          <div class="field"><label>Due date</label><input class="input" type="date" name="due_date" value="${r.due_date || ''}"></div>
        </div>
        <label style="font-weight:600;font-size:13px">Line items</label>
        <div class="table-wrap" style="margin:6px 0 10px"><table class="data" style="min-width:640px"><thead><tr><th class="nosort">Account</th><th class="nosort">Details</th><th class="nosort">Qty</th><th class="nosort">Price</th><th class="nosort num">Amount</th><th class="nosort"></th></tr></thead>
          <tbody id="items">${lineRow()}</tbody></table></div>
        <button type="button" class="btn btn-outline btn-sm" id="addItem">${icon('plus')} Add line</button>
        <div class="grid-2" style="margin-top:14px">
          <div class="field"><label>VAT %</label><input class="input" type="number" step="0.01" name="tax_percent" value="${r.tax_percent ?? 5}"></div>
          <div class="field"><label>Status</label><select class="select" name="status">${optionList(['Draft', 'Open'], r.status || 'Open')}</select></div>
        </div>
        <div class="field"><label>Notes</label><input class="input" name="notes" value="${escapeHtml(r.notes || '')}"></div>
        <div class="card-pad" style="background:var(--subtle);border-radius:10px;text-align:right">
          <div>Subtotal: <strong id="sSub">AED 0.00</strong></div><div>Input VAT: <strong id="sTax">AED 0.00</strong></div>
          <div style="font-size:18px;margin-top:4px">Total: <strong id="sTot" class="neg">AED 0.00</strong></div>
        </div>
      </form>`,
      footer: `<button class="btn btn-outline" data-close>Cancel</button><button class="btn btn-primary" data-save>${row ? 'Save' : 'Create bill'}</button>`,
      onMount: async (back, close) => {
        const itemsEl = back.querySelector('#items');
        if (row) { const full = await get('/api/bills/' + row.id); itemsEl.innerHTML = (full.items.length ? full.items : [{}]).map(lineRow).join(''); }
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
          const fd = Object.fromEntries(new FormData(back.querySelector('#bf')));
          const items = [...itemsEl.querySelectorAll('tr.li')].map((tr) => ({
            account_id: Number(tr.querySelector('[data-f=account_id]').value || 0),
            description: tr.querySelector('[data-f=description]').value,
            qty: Number(tr.querySelector('[data-f=qty]').value || 0), unit_price: Number(tr.querySelector('[data-f=unit_price]').value || 0),
          })).filter((it) => it.description || it.unit_price);
          if (!fd.vendor_name) return toast('Vendor is required', 'err');
          const payload = { ...fd, tax_percent: Number(fd.tax_percent || 0), items };
          try {
            if (row) await put('/api/bills/' + row.id, payload); else await post('/api/bills', payload);
            rows = await get('/api/bills'); toast(row ? 'Bill updated' : 'Bill created', 'ok'); close(); renderList();
          } catch (e) { toast(e.message, 'err'); }
        };
      },
    });
  }

  function recordPayment(bill) {
    const balance = bill.total - (bill.amount_paid || 0);
    openModal({
      title: `Pay bill ${bill.bill_number}`,
      body: `<form id="pf">
        <div class="detail-row"><span class="k">Vendor</span><strong>${escapeHtml(bill.vendor_name)}</strong></div>
        <div class="detail-row"><span class="k">Balance due</span><strong>${fmtAED(balance)}</strong></div>
        <div class="grid-2" style="margin-top:12px">
          <div class="field"><label>Amount (AED)</label><input class="input" type="number" step="0.01" name="amount" value="${balance.toFixed(2)}" required></div>
          <div class="field"><label>Date</label><input class="input" type="date" name="payment_date" value="${new Date().toISOString().slice(0, 10)}"></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>Paid through</label><select class="select" name="mode">${optionList(['bank', 'cash', 'card', 'cheque'], 'bank')}</select></div>
          <div class="field"><label>Reference</label><input class="input" name="reference"></div>
        </div>
      </form>`,
      footer: `<button class="btn btn-outline" data-close>Cancel</button><button class="btn btn-primary" data-save>Record payment</button>`,
      onMount: (back, close) => {
        back.querySelector('[data-save]').onclick = async () => {
          const fd = Object.fromEntries(new FormData(back.querySelector('#pf')));
          try {
            await post('/api/payments', { payment_type: 'made', party_name: bill.vendor_name, contact_id: bill.contact_id, amount: Number(fd.amount), mode: fd.mode, payment_date: fd.payment_date, reference: fd.reference, document_type: 'bill', document_id: bill.id });
            rows = await get('/api/bills'); toast('Payment recorded', 'ok'); close(); renderList();
          } catch (e) { toast(e.message, 'err'); }
        };
      },
    });
  }
}
function statusBadge(s) { return s === 'Open' ? 'Sent' : s === 'Partially Paid' ? 'Follow-up' : s; }
