import { get, post, del, icon, fmtAED, fmtDate, escapeHtml, toast, openModal, confirmDialog } from '../api.js';
import { pageHead, kpiRow, listView } from '../ui.js';

const SRC_BADGE = { manual: 'b-blue', invoice: 'b-green', bill: 'b-amber', payment: 'b-green', expense: 'b-amber', credit_note: 'b-red', opening: 'b-gray' };

export default async function journals(view, ctx) {
  const isAdmin = ctx.user.role === 'admin';
  let rows = await get('/api/journals');
  let accounts = await get('/api/accounts').catch(() => []);
  const activeAccts = accounts.filter((a) => a.is_active);

  view.innerHTML = pageHead({
    title: 'Manual Journals', desc: 'Every posting in your books — auto-generated and manual double-entry journals.',
    actions: `<button class="btn btn-primary" id="addBtn">${icon('plus')} New Journal</button>`,
  }) + kpiRow([
    { label: 'Total journals', value: rows.length, icon: 'ledger' },
    { label: 'Manual entries', value: rows.filter((r) => r.is_manual).length, icon: 'edit' },
    { label: 'System postings', value: rows.filter((r) => !r.is_manual).length, icon: 'cpu' },
  ]) + `<div id="jbody"></div>`;

  view.querySelector('#addBtn').onclick = () => openForm();
  renderList();

  function renderList() {
    listView({
      mount: view.querySelector('#jbody'), rows,
      searchKeys: ['journal_number', 'reference', 'notes', 'source_type'],
      filters: [{ key: 'src', label: 'Source', options: ['All', ...[...new Set(rows.map((r) => r.source_type))]], match: (r, v) => r.source_type === v }],
      empty: 'No journals yet.',
      columns: [
        { label: 'Date', sort: (r) => r.journal_date, render: (r) => fmtDate(r.journal_date) },
        { label: 'Journal #', sort: (r) => r.journal_number, render: (r) => `<strong>${escapeHtml(r.journal_number || '—')}</strong>` },
        { label: 'Reference', render: (r) => escapeHtml(r.reference || r.notes || '—') },
        { label: 'Source', sort: (r) => r.source_type, render: (r) => `<span class="badge ${SRC_BADGE[r.source_type] || 'b-gray'}">${escapeHtml(r.source_type)}</span>` },
        { label: 'Amount', align: 'right', sort: (r) => Number(r.total), render: (r) => `<strong>${fmtAED(r.total)}</strong>` },
        { label: '', align: 'right', render: (r) => `<div class="row-actions">
          <button class="btn btn-ghost btn-icon btn-sm" data-view="${r.id}" title="View">${icon('external')}</button>
          ${isAdmin && r.is_manual ? `<button class="btn btn-ghost btn-icon btn-sm" data-del="${r.id}" title="Delete" style="color:var(--red)">${icon('trash')}</button>` : ''}
        </div>` },
      ],
      onRowsRendered: (tbody) => {
        tbody.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => openView(b.dataset.view));
        tbody.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
          if (await confirmDialog('Delete this manual journal?')) {
            try { await del('/api/journals/' + b.dataset.del); rows = rows.filter((r) => r.id != b.dataset.del); toast('Journal deleted', 'ok'); renderList(); }
            catch (e) { toast(e.message, 'err'); }
          }
        });
      },
    });
  }

  async function openView(id) {
    const j = await get('/api/journals/' + id);
    openModal({
      title: `Journal ${j.journal_number}`, size: 'lg',
      body: `<div class="detail-row"><span class="k">Date</span><strong>${fmtDate(j.journal_date)}</strong></div>
        <div class="detail-row"><span class="k">Reference</span><strong>${escapeHtml(j.reference || '—')}</strong></div>
        <div class="detail-row"><span class="k">Notes</span><strong>${escapeHtml(j.notes || '—')}</strong></div>
        <div class="table-wrap" style="margin-top:12px"><table class="data">
          <thead><tr><th class="nosort">Account</th><th class="nosort num">Debit</th><th class="nosort num">Credit</th></tr></thead>
          <tbody>${j.lines.map((l) => `<tr><td>${escapeHtml(l.account_code || '')} · ${escapeHtml(l.account_name)}${l.description ? `<div class="muted" style="font-size:12px">${escapeHtml(l.description)}</div>` : ''}</td>
            <td class="num">${l.debit ? fmtAED(l.debit) : '—'}</td><td class="num">${l.credit ? fmtAED(l.credit) : '—'}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td style="text-align:right;font-weight:700">Total</td>
            <td class="num" style="font-weight:700">${fmtAED(j.lines.reduce((s, l) => s + l.debit, 0))}</td>
            <td class="num" style="font-weight:700">${fmtAED(j.lines.reduce((s, l) => s + l.credit, 0))}</td></tr></tfoot>
        </table></div>`,
      footer: `<button class="btn btn-outline" data-close>Close</button>`,
    });
  }

  function acctOptions(sel) {
    return activeAccts.map((a) => `<option value="${a.id}"${a.id == sel ? ' selected' : ''}>${escapeHtml(a.code + ' · ' + a.name)}</option>`).join('');
  }
  function lineRow() {
    return `<tr class="jl">
      <td><select class="select" data-f="account_id"><option value="">Select account…</option>${acctOptions()}</select></td>
      <td style="width:130px"><input class="input" data-f="debit" type="number" step="0.01" placeholder="0.00"></td>
      <td style="width:130px"><input class="input" data-f="credit" type="number" step="0.01" placeholder="0.00"></td>
      <td style="width:36px"><button class="btn btn-ghost btn-icon btn-sm" data-rm style="color:var(--red)">${icon('x')}</button></td>
    </tr>`;
  }

  function openForm() {
    openModal({
      title: 'New manual journal', size: 'lg',
      body: `<form id="jf">
        <div class="grid-2">
          <div class="field"><label>Date</label><input class="input" type="date" name="journal_date" value="${new Date().toISOString().slice(0, 10)}"></div>
          <div class="field"><label>Reference</label><input class="input" name="reference" placeholder="e.g. Depreciation Aug"></div>
        </div>
        <label style="font-weight:600;font-size:13px">Journal lines</label>
        <div class="table-wrap" style="margin:6px 0 10px"><table class="data">
          <thead><tr><th class="nosort">Account</th><th class="nosort num">Debit</th><th class="nosort num">Credit</th><th class="nosort"></th></tr></thead>
          <tbody id="jlines">${lineRow()}${lineRow()}</tbody></table></div>
        <button type="button" class="btn btn-outline btn-sm" id="addLine">${icon('plus')} Add line</button>
        <div class="field" style="margin-top:12px"><label>Notes</label><input class="input" name="notes"></div>
        <div class="card-pad" style="background:var(--subtle);border-radius:10px;text-align:right">
          Debit: <strong id="tDr">AED 0.00</strong> &nbsp;·&nbsp; Credit: <strong id="tCr">AED 0.00</strong>
          <div id="balMsg" style="font-size:12px;margin-top:4px"></div>
        </div>
      </form>`,
      footer: `<button class="btn btn-outline" data-close>Cancel</button><button class="btn btn-primary" data-save>Post journal</button>`,
      onMount: (back, close) => {
        const linesEl = back.querySelector('#jlines');
        const recalc = () => {
          let dr = 0, cr = 0;
          linesEl.querySelectorAll('tr.jl').forEach((tr) => { dr += Number(tr.querySelector('[data-f=debit]').value || 0); cr += Number(tr.querySelector('[data-f=credit]').value || 0); });
          back.querySelector('#tDr').textContent = fmtAED(dr);
          back.querySelector('#tCr').textContent = fmtAED(cr);
          const diff = Math.round((dr - cr) * 100) / 100;
          const msg = back.querySelector('#balMsg');
          msg.innerHTML = diff === 0 && dr > 0 ? `<span class="pos">✓ Balanced</span>` : `<span class="neg">Out of balance by ${fmtAED(Math.abs(diff))}</span>`;
        };
        back.addEventListener('input', recalc);
        back.querySelector('#addLine').onclick = () => { linesEl.insertAdjacentHTML('beforeend', lineRow()); recalc(); };
        linesEl.addEventListener('click', (e) => { if (e.target.closest('[data-rm]')) { e.target.closest('tr').remove(); recalc(); } });
        recalc();
        back.querySelector('[data-save]').onclick = async () => {
          const fd = Object.fromEntries(new FormData(back.querySelector('#jf')));
          const lines = [...linesEl.querySelectorAll('tr.jl')].map((tr) => ({
            account_id: Number(tr.querySelector('[data-f=account_id]').value || 0),
            debit: Number(tr.querySelector('[data-f=debit]').value || 0),
            credit: Number(tr.querySelector('[data-f=credit]').value || 0),
          })).filter((l) => l.account_id && (l.debit || l.credit));
          if (lines.length < 2) return toast('Add at least two lines', 'err');
          try {
            await post('/api/journals', { journal_date: fd.journal_date, reference: fd.reference, notes: fd.notes, lines });
            rows = await get('/api/journals');
            toast('Journal posted', 'ok'); close(); renderList();
          } catch (e) { toast(e.message, 'err'); }
        };
      },
    });
  }
}
