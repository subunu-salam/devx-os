import { get, post, icon, fmtDate, escapeHtml, toast } from '../api.js';
import { pageHead } from '../ui.js';

const MODULE_META = {
  expenses: { label: 'Expenses', api: '/api/expenses', name: (r) => `${r.other_details || r.category} · ${r.person}`, sub: (r) => fmtDate(r.expense_date) },
  meetings: { label: 'Meetings', api: '/api/meetings', name: (r) => r.client_name, sub: (r) => fmtDate(r.meeting_date) },
  leads: { label: 'Leads', api: '/api/leads', name: (r) => r.name, sub: (r) => r.business_category || '' },
  tasks: { label: 'Tasks', api: '/api/tasks', name: (r) => r.subject, sub: (r) => r.related_to || '' },
  deals: { label: 'Deals', api: '/api/deals', name: (r) => r.name, sub: (r) => r.account_name || '' },
};

export default async function bulkUpdate(view, ctx) {
  if (ctx.user.role !== 'admin') { view.innerHTML = `<div class="empty">${icon('lock')}<p>Admins only.</p></div>`; return; }
  const modules = await get('/api/bulk-update/modules');
  let current = 'leads';
  let rows = [];

  view.innerHTML = pageHead({
    title: 'Bulk Update', desc: 'Update a field across many records at once — status, owner, category and more.',
  }) + `
    <div class="toolbar">
      <select id="mod">${Object.keys(modules).map((m) => `<option value="${m}">${MODULE_META[m]?.label || m}</option>`).join('')}</select>
      <select id="field"></select>
      <input class="input" id="value" placeholder="New value" style="max-width:220px">
      <button class="btn btn-primary" id="apply">${icon('check')} Apply to selected</button>
    </div>
    <div id="body"></div>`;

  const modSel = view.querySelector('#mod');
  const fieldSel = view.querySelector('#field');
  modSel.onchange = () => { current = modSel.value; loadFields(); load(); };
  view.querySelector('#apply').onclick = apply;
  loadFields(); load();

  function loadFields() {
    fieldSel.innerHTML = modules[current].fields.map((f) => `<option value="${f}">${f}</option>`).join('');
  }

  async function load() {
    rows = await get(MODULE_META[current].api);
    const meta = MODULE_META[current];
    view.querySelector('#body').innerHTML = `
      <div class="table-wrap"><table class="data">
        <thead><tr><th class="nosort" style="width:36px"><input type="checkbox" id="all"></th><th class="nosort">Record</th><th class="nosort">Detail</th></tr></thead>
        <tbody>${rows.map((r) => `<tr><td><input type="checkbox" class="rowchk" value="${r.id}"></td>
          <td><strong>${escapeHtml(meta.name(r) || '#' + r.id)}</strong></td>
          <td class="muted">${escapeHtml(meta.sub(r) || '')}</td></tr>`).join('') || `<tr><td colspan="3" class="muted" style="text-align:center;padding:20px">No records</td></tr>`}</tbody>
      </table></div>`;
    const all = view.querySelector('#all');
    if (all) all.onclick = () => view.querySelectorAll('.rowchk').forEach((c) => (c.checked = all.checked));
  }

  async function apply() {
    const ids = [...view.querySelectorAll('.rowchk:checked')].map((c) => Number(c.value));
    const field = fieldSel.value;
    const value = view.querySelector('#value').value;
    if (!ids.length) return toast('Select at least one record', 'err');
    if (value === '') return toast('Enter a new value', 'err');
    try {
      const r = await post('/api/bulk-update', { module: current, ids, field, value });
      toast(`Updated ${r.updated} record${r.updated > 1 ? 's' : ''}`, 'ok');
      load();
    } catch (e) { toast(e.message, 'err'); }
  }
}
