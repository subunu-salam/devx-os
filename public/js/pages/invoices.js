import { get, post, put, del, icon, badge, fmtAED, fmtDate, escapeHtml, toast, openModal, confirmDialog, optionList } from '../api.js';
import { pageHead, kpiRow, listView, rowActionButtons } from '../ui.js';

const STATUSES = ['Draft', 'Sent', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled'];

export default async function invoices(view, ctx) {
  const isAdmin = ctx.user.role === 'admin';
  let rows = await get('/api/invoices');
  let customers = (await get('/api/contacts').catch(() => [])).filter((c) => c.contact_type === 'customer');

  const sumBy = (f) => rows.filter(f).reduce((s, r) => s + Number(r.total || 0), 0);
  view.innerHTML = pageHead({
    title: 'Invoices', desc: 'Bill clients and track what has been paid.',
    actions: `<button class="btn btn-primary" id="addBtn">${icon('plus')} Create Invoice</button>`,
  }) + kpiRow([
    { label: 'Total invoiced', value: fmtAED(sumBy(() => true)), icon: 'invoice' },
    { label: 'Paid', value: fmtAED(sumBy((r) => r.status === 'Paid')), icon: 'check2', tone: 'green' },
    { label: 'Outstanding', value: fmtAED(sumBy((r) => r.status === 'Sent' || r.status === 'Overdue')), icon: 'clock', tone: 'amber' },
    { label: 'Overdue', value: fmtAED(sumBy((r) => r.status === 'Overdue')), icon: 'wallet', tone: 'red' },
  ]) + `<div id="ibody"></div>`;

  view.querySelector('#addBtn').onclick = () => openForm();
  renderList();

  function renderList() {
    listView({
      mount: view.querySelector('#ibody'), rows,
      searchKeys: ['invoice_number', 'client_name'],
      filters: [{ key: 'status', label: 'Status', options: ['All', ...STATUSES], match: (r, v) => r.status === v }],
      empty: 'No invoices yet. Click “Create Invoice”.',
      columns: [
        { label: 'Invoice #', sort: (r) => r.invoice_number, render: (r) => `<strong>${escapeHtml(r.invoice_number)}</strong>` },
        { label: 'Client', sort: (r) => r.client_name, render: (r) => escapeHtml(r.client_name) },
        { label: 'Issued', sort: (r) => r.issue_date, render: (r) => fmtDate(r.issue_date) },
        { label: 'Due', render: (r) => fmtDate(r.due_date) },
        { label: 'Status', sort: (r) => r.status, render: (r) => badge(r.status) },
        { label: 'Total', align: 'right', sort: (r) => Number(r.total), render: (r) => `<strong>${fmtAED(r.total)}</strong>` },
        { label: '', align: 'right', render: (r) => `<div class="row-actions">
            <button class="btn btn-ghost btn-icon btn-sm" data-view title="View">${icon('external')}</button>
            <button class="btn btn-ghost btn-icon btn-sm" data-edit title="Edit">${icon('edit')}</button>
            ${isAdmin ? `<button class="btn btn-ghost btn-icon btn-sm" data-del title="Delete" style="color:var(--red)">${icon('trash')}</button>` : ''}
          </div>` },
      ],
      onRowsRendered: (tbody) => tbody.querySelectorAll('tr').forEach((tr) => {
        const row = rows.find((r) => r.id == tr.dataset.id);
        tr.querySelector('[data-view]')?.addEventListener('click', () => openView(row.id));
        tr.querySelector('[data-edit]')?.addEventListener('click', () => openForm(row));
        tr.querySelector('[data-del]')?.addEventListener('click', async () => {
          if (await confirmDialog(`Delete invoice ${row.invoice_number}?`)) { await del('/api/invoices/' + row.id); rows = rows.filter((r) => r.id !== row.id); toast('Invoice deleted', 'ok'); renderList(); }
        });
      }),
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
    const items = row ? null : [{}];
    openModal({
      title: row ? `Edit ${row.invoice_number}` : 'Create invoice', size: 'lg',
      body: `<form id="if">
        <div class="grid-3">
          <div class="field"><label>Client</label><input class="input" name="client_name" list="invCustList" value="${escapeHtml(r.client_name || '')}" required>
            <datalist id="invCustList">${customers.map((c) => `<option value="${escapeHtml(c.display_name)}">`).join('')}</datalist></div>
          <div class="field"><label>Issue date</label><input class="input" type="date" name="issue_date" value="${r.issue_date || new Date().toISOString().slice(0, 10)}"></div>
          <div class="field"><label>Due date</label><input class="input" type="date" name="due_date" value="${r.due_date || ''}"></div>
        </div>
        <label style="font-weight:600;font-size:13px">Line items</label>
        <div class="table-wrap" style="margin:6px 0 10px">
          <table class="data" style="min-width:520px"><thead><tr><th class="nosort">Description</th><th class="nosort">Qty</th><th class="nosort">Unit price</th><th class="nosort num">Amount</th><th class="nosort"></th></tr></thead>
          <tbody id="items">${(items || []).map(lineRow).join('')}</tbody></table>
        </div>
        <button type="button" class="btn btn-outline btn-sm" id="addItem">${icon('plus')} Add item</button>
        <div class="grid-2" style="margin-top:14px">
          <div class="field"><label>Tax %</label><input class="input" type="number" step="0.01" name="tax_percent" value="${r.tax_percent ?? 0}"></div>
          <div class="field"><label>Status</label><select class="select" name="status">${optionList(STATUSES, r.status || 'Draft')}</select></div>
        </div>
        <div class="field"><label>Notes</label><textarea class="input" name="notes" rows="2">${escapeHtml(r.notes || '')}</textarea></div>
        <div class="card-pad" style="background:#f8faf9;border-radius:10px;text-align:right">
          <div>Subtotal: <strong id="sSub">AED 0.00</strong></div>
          <div>Tax: <strong id="sTax">AED 0.00</strong></div>
          <div style="font-size:18px;margin-top:4px">Total: <strong id="sTot" class="pos">AED 0.00</strong></div>
        </div>
      </form>`,
      footer: `<button class="btn btn-outline" data-close>Cancel</button><button class="btn btn-primary" data-save>${row ? 'Save' : 'Create invoice'}</button>`,
      onMount: async (back, close) => {
        const itemsEl = back.querySelector('#items');
        if (row) { const full = await get('/api/invoices/' + row.id); itemsEl.innerHTML = (full.items.length ? full.items : [{}]).map(lineRow).join(''); }
        const recalc = () => {
          let sub = 0;
          itemsEl.querySelectorAll('tr.li').forEach((tr) => {
            const q = Number(tr.querySelector('[data-f=qty]').value || 0), p = Number(tr.querySelector('[data-f=unit_price]').value || 0);
            const a = q * p; tr.querySelector('.amt').textContent = a.toFixed(2); sub += a;
          });
          const tax = sub * Number(back.querySelector('[name=tax_percent]').value || 0) / 100;
          back.querySelector('#sSub').textContent = fmtAED(sub);
          back.querySelector('#sTax').textContent = fmtAED(tax);
          back.querySelector('#sTot').textContent = fmtAED(sub + tax);
        };
        back.addEventListener('input', recalc);
        back.querySelector('#addItem').onclick = () => { itemsEl.insertAdjacentHTML('beforeend', lineRow()); recalc(); };
        itemsEl.addEventListener('click', (e) => { if (e.target.closest('[data-rm]')) { e.target.closest('tr').remove(); recalc(); } });
        recalc();
        back.querySelector('[data-save]').onclick = async () => {
          const fd = Object.fromEntries(new FormData(back.querySelector('#if')));
          const items = [...itemsEl.querySelectorAll('tr.li')].map((tr) => ({
            description: tr.querySelector('[data-f=description]').value,
            qty: Number(tr.querySelector('[data-f=qty]').value || 0),
            unit_price: Number(tr.querySelector('[data-f=unit_price]').value || 0),
          })).filter((it) => it.description || it.unit_price);
          if (!fd.client_name) return toast('Client is required', 'err');
          const payload = { ...fd, tax_percent: Number(fd.tax_percent || 0), items };
          try {
            if (row) { await put('/api/invoices/' + row.id, payload); }
            else { await post('/api/invoices', payload); }
            rows = await get('/api/invoices');
            toast(row ? 'Invoice updated' : 'Invoice created', 'ok'); close(); renderList();
          } catch (e) { toast(e.message, 'err'); }
        };
      },
    });
  }

  async function openView(id) {
    const inv = await get('/api/invoices/' + id);
    const rowsHtml = inv.items.map((it) => `<tr><td>${escapeHtml(it.description)}</td><td class="num">${it.qty}</td><td class="num">${fmtAED(it.unit_price)}</td><td class="num">${fmtAED(it.amount)}</td></tr>`).join('');
    openModal({
      title: `Invoice ${inv.invoice_number}`, size: 'lg',
      body: `<div class="inv-doc" id="invDoc">
        <div class="head">
          <div><img src="/assets/devx-logo-full.png" alt="DevX"><div class="muted" style="margin-top:8px;font-size:12px">DevX Technologies LLC<br>Dubai Investment Park 1, Dubai, UAE<br>+971 54 749 7336 · hello@devxpert.ae</div></div>
          <div style="text-align:right"><h2 style="font-size:24px">INVOICE</h2><div class="muted">${escapeHtml(inv.invoice_number)}</div><div style="margin-top:6px">${badge(inv.status)}</div></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:18px">
          <div><div class="muted" style="font-size:12px">BILL TO</div><strong>${escapeHtml(inv.client_name)}</strong></div>
          <div style="text-align:right"><div>Issued: <strong>${fmtDate(inv.issue_date)}</strong></div><div>Due: <strong>${fmtDate(inv.due_date)}</strong></div></div>
        </div>
        <div class="table-wrap"><table class="data"><thead><tr><th class="nosort">Description</th><th class="nosort num">Qty</th><th class="nosort num">Unit</th><th class="nosort num">Amount</th></tr></thead>
          <tbody>${rowsHtml || '<tr><td colspan="4" class="muted">No items</td></tr>'}</tbody></table></div>
        <div style="text-align:right;margin-top:16px">
          <div>Subtotal: <strong>${fmtAED(inv.subtotal)}</strong></div>
          <div>Tax (${inv.tax_percent}%): <strong>${fmtAED(inv.tax)}</strong></div>
          <div style="font-size:20px;margin-top:6px">Total: <strong class="pos">${fmtAED(inv.total)}</strong></div>
        </div>
        ${inv.notes ? `<div style="margin-top:18px" class="muted"><strong>Notes:</strong> ${escapeHtml(inv.notes)}</div>` : ''}
      </div>`,
      footer: `<button class="btn btn-outline no-print" data-close>Close</button>
        ${inv.status !== 'Sent' && inv.status !== 'Paid' ? `<button class="btn btn-outline no-print" data-sent>Mark Sent</button>` : ''}
        ${inv.status !== 'Paid' ? `<button class="btn btn-outline no-print" data-paid>Mark Paid</button>` : ''}
        <button class="btn btn-primary no-print" data-print>${icon('print')} Print / PDF</button>`,
      onMount: (back, close) => {
        back.querySelector('[data-print]').onclick = () => window.print();
        back.querySelector('[data-sent]')?.addEventListener('click', async () => { await put('/api/invoices/' + id, { status: 'Sent' }); rows = await get('/api/invoices'); toast('Marked as sent', 'ok'); close(); renderList(); });
        back.querySelector('[data-paid]')?.addEventListener('click', async () => { await put('/api/invoices/' + id, { status: 'Paid' }); rows = await get('/api/invoices'); toast('Marked paid — credit added to ledger', 'ok'); close(); renderList(); });
      },
    });
  }
}
