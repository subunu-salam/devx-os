import { get, post, del, icon, fmtAED, fmtDate, escapeHtml, toast, openModal, confirmDialog, optionList } from '../api.js';
import { pageHead, kpiRow, listView } from '../ui.js';

// Shared implementation for Payments Received (customers) and Payments Made (vendors).
export function paymentsPage({ type, title, desc, contactType, docApi, docLabel, docNumberKey, docNameKey }) {
  return async function (view, ctx) {
    const isAdmin = ctx.user.role === 'admin';
    let rows = await get('/api/payments?type=' + type);
    let contacts = (await get('/api/contacts').catch(() => [])).filter((c) => c.contact_type === contactType);
    let docs = (await get(docApi).catch(() => [])).filter((d) => !['Paid', 'Cancelled', 'Draft'].includes(d.status));

    const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
    const monthKey = new Date().toISOString().slice(0, 7);
    const monthTotal = rows.filter((r) => (r.payment_date || '').slice(0, 7) === monthKey).reduce((s, r) => s + Number(r.amount || 0), 0);

    view.innerHTML = pageHead({
      title, desc,
      actions: `<button class="btn btn-primary" id="addBtn">${icon('plus')} Record Payment</button>`,
    }) + kpiRow([
      { label: type === 'received' ? 'Total received' : 'Total paid', value: fmtAED(total), icon: 'wallet', tone: type === 'received' ? 'green' : 'red' },
      { label: 'This month', value: fmtAED(monthTotal), icon: 'trending', tone: 'amber' },
      { label: 'Payments', value: rows.length, icon: 'receipt' },
    ]) + `<div id="pbody"></div>`;

    view.querySelector('#addBtn').onclick = () => openForm();
    renderList();

    function renderList() {
      listView({
        mount: view.querySelector('#pbody'), rows,
        searchKeys: ['payment_number', 'party_name', 'reference'],
        filters: [{ key: 'mode', label: 'Mode', options: ['All', 'bank', 'cash', 'card', 'cheque'], match: (r, v) => r.mode === v }],
        empty: 'No payments recorded yet.',
        columns: [
          { label: 'Payment #', sort: (r) => r.payment_number, render: (r) => `<strong>${escapeHtml(r.payment_number || '—')}</strong>` },
          { label: type === 'received' ? 'From' : 'To', sort: (r) => r.party_name, render: (r) => escapeHtml(r.party_name || '—') },
          { label: 'Date', sort: (r) => r.payment_date, render: (r) => fmtDate(r.payment_date) },
          { label: 'Mode', render: (r) => escapeHtml(r.mode || '—') },
          { label: 'Reference', render: (r) => escapeHtml(r.reference || '—') },
          { label: 'Amount', align: 'right', sort: (r) => Number(r.amount), render: (r) => `<strong class="${type === 'received' ? 'pos' : 'neg'}">${fmtAED(r.amount)}</strong>` },
          { label: '', align: 'right', render: (r) => `<div class="row-actions">${isAdmin ? `<button class="btn btn-ghost btn-icon btn-sm" data-del="${r.id}" title="Delete" style="color:var(--red)">${icon('trash')}</button>` : ''}</div>` },
        ],
        onRowsRendered: (tbody) => tbody.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
          if (await confirmDialog('Delete this payment? Linked documents will be re-opened.')) {
            try { await del('/api/payments/' + b.dataset.del); rows = await get('/api/payments?type=' + type); toast('Payment deleted', 'ok'); renderList(); }
            catch (e) { toast(e.message, 'err'); }
          }
        }),
      });
    }

    function openForm() {
      openModal({
        title: 'Record payment',
        body: `<form id="pf">
          <div class="field"><label>${docLabel} (optional)</label>
            <select class="select" name="doc"><option value="">— none / on-account —</option>
              ${docs.map((d) => `<option value="${d.id}" data-name="${escapeHtml(d[docNameKey])}" data-bal="${(d.total - (d.amount_paid || 0)).toFixed(2)}">${escapeHtml(d[docNumberKey])} · ${escapeHtml(d[docNameKey])} · ${fmtAED(d.total - (d.amount_paid || 0))}</option>`).join('')}
            </select></div>
          <div class="grid-2">
            <div class="field"><label>${type === 'received' ? 'Customer' : 'Vendor'}</label><input class="input" name="party_name" list="pList" required>
              <datalist id="pList">${contacts.map((c) => `<option value="${escapeHtml(c.display_name)}">`).join('')}</datalist></div>
            <div class="field"><label>Amount (AED)</label><input class="input" type="number" step="0.01" name="amount" required></div>
          </div>
          <div class="grid-2">
            <div class="field"><label>Date</label><input class="input" type="date" name="payment_date" value="${new Date().toISOString().slice(0, 10)}"></div>
            <div class="field"><label>Mode</label><select class="select" name="mode">${optionList(['bank', 'cash', 'card', 'cheque'], 'bank')}</select></div>
          </div>
          <div class="field"><label>Reference</label><input class="input" name="reference"></div>
        </form>`,
        footer: `<button class="btn btn-outline" data-close>Cancel</button><button class="btn btn-primary" data-save>Record payment</button>`,
        onMount: (back, close) => {
          const docSel = back.querySelector('[name=doc]');
          docSel.addEventListener('change', () => {
            const opt = docSel.selectedOptions[0];
            if (opt && opt.value) { back.querySelector('[name=party_name]').value = opt.dataset.name; back.querySelector('[name=amount]').value = opt.dataset.bal; }
          });
          back.querySelector('[data-save]').onclick = async () => {
            const fd = Object.fromEntries(new FormData(back.querySelector('#pf')));
            if (!fd.party_name || !fd.amount) return toast('Party and amount are required', 'err');
            const payload = { payment_type: type, party_name: fd.party_name, amount: Number(fd.amount), mode: fd.mode, payment_date: fd.payment_date, reference: fd.reference };
            if (fd.doc) { payload.document_type = type === 'received' ? 'invoice' : 'bill'; payload.document_id = Number(fd.doc); }
            try { await post('/api/payments', payload); rows = await get('/api/payments?type=' + type); toast('Payment recorded', 'ok'); close(); renderList(); }
            catch (e) { toast(e.message, 'err'); }
          };
        },
      });
    }
  };
}
