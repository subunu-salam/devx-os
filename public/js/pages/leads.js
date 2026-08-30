import { get, post, put, del, icon, badge, escapeHtml, fmtDate, toast, openModal, confirmDialog, optionList } from '../api.js';
import { pageHead, kpiRow, listView, rowActionButtons } from '../ui.js';

const STATUSES = ['New', 'Interested', 'Follow-up', 'Won', 'Lost'];

export default async function leads(view, ctx) {
  const isAdmin = ctx.user.role === 'admin';
  let rows = await get('/api/leads');

  const count = (s) => rows.filter((r) => r.status === s).length;
  const won = count('Won'), lost = count('Lost');
  const conv = (won + lost) ? Math.round((won / (won + lost)) * 100) : 0;

  view.innerHTML = pageHead({
    title: 'Leads & Pipeline', desc: 'Prospects and follow-ups from your outreach.',
    actions: `<div class="tabs" id="ltabs"><button class="active" data-tab="board">Board</button><button data-tab="list">Table</button></div>
              <button class="btn btn-primary" id="addBtn">${icon('plus')} Add Lead</button>`,
  }) + kpiRow([
    { label: 'Total leads', value: rows.length, icon: 'target' },
    { label: 'Interested', value: count('Interested'), icon: 'zap', tone: 'green' },
    { label: 'Won', value: won, icon: 'check2', tone: 'green' },
    { label: 'Conversion', value: conv + '%', sub: `${won} won · ${lost} lost`, icon: 'trending', tone: 'amber' },
  ]) + `<div id="lbody"></div>`;

  const body = view.querySelector('#lbody');
  let tab = 'board';
  view.querySelector('#addBtn').onclick = () => openForm();
  view.querySelectorAll('#ltabs button').forEach((b) => b.onclick = () => {
    tab = b.dataset.tab; view.querySelectorAll('#ltabs button').forEach((x) => x.classList.toggle('active', x === b)); renderTab();
  });
  renderTab();

  function renderTab() { tab === 'board' ? renderBoard() : renderList(); }

  function renderBoard() {
    body.innerHTML = `<div class="kanban">${STATUSES.map((s) => {
      const items = rows.filter((r) => r.status === s);
      return `<div class="kan-col"><h4><span>${s}</span><span>${items.length}</span></h4>
        ${items.map((r) => `<div class="kan-card" data-id="${r.id}">
          <div class="nm">${escapeHtml(r.name)}</div>
          <div class="ct">${escapeHtml(r.business_category || '—')}</div>
          ${r.next_action ? `<div class="ct" style="margin-top:4px">${icon('clock')} ${escapeHtml(r.next_action)}</div>` : ''}
        </div>`).join('') || `<div class="muted" style="padding:8px;font-size:12px">—</div>`}
      </div>`;
    }).join('')}</div>`;
    body.querySelectorAll('.kan-card').forEach((c) => c.onclick = () => openForm(rows.find((r) => r.id == c.dataset.id)));
  }

  function renderList() {
    listView({
      mount: body, rows,
      searchKeys: ['name', 'business_category', 'notes', 'source'],
      filters: [{ key: 'status', label: 'Status', options: ['All', ...STATUSES], match: (r, v) => r.status === v }],
      empty: 'No leads yet.',
      columns: [
        { label: 'Name', sort: (r) => r.name, render: (r) => `<strong>${escapeHtml(r.name)}</strong>` },
        { label: 'Category', sort: (r) => r.business_category || '', render: (r) => escapeHtml(r.business_category || '—') },
        { label: 'Status', sort: (r) => r.status, render: (r) => badge(r.status) },
        { label: 'Next action', render: (r) => escapeHtml(r.next_action || '—') },
        { label: 'Source', render: (r) => `<span class="muted">${escapeHtml(r.source || '—')}</span>` },
        { label: '', align: 'right', render: (r) => `<div class="row-actions">
            ${r.converted_contact_id ? `<span class="badge b-green" title="Converted">${icon('check')}</span>` : `<button class="btn btn-ghost btn-icon btn-sm" data-conv title="Convert to customer" style="color:var(--green)">${icon('users')}</button>`}
            <button class="btn btn-ghost btn-icon btn-sm" data-edit title="Edit">${icon('edit')}</button>
            ${isAdmin ? `<button class="btn btn-ghost btn-icon btn-sm" data-del title="Delete" style="color:var(--red)">${icon('trash')}</button>` : ''}
          </div>` },
      ],
      onRowsRendered: (tbody) => tbody.querySelectorAll('tr').forEach((tr) => {
        const row = rows.find((r) => r.id == tr.dataset.id);
        tr.querySelector('[data-edit]')?.addEventListener('click', () => openForm(row));
        tr.querySelector('[data-conv]')?.addEventListener('click', () => convertLead(row));
        tr.querySelector('[data-del]')?.addEventListener('click', async () => {
          if (await confirmDialog(`Delete lead “${row.name}”?`)) { await del('/api/leads/' + row.id); rows = rows.filter((r) => r.id !== row.id); toast('Lead deleted', 'ok'); renderTab(); }
        });
      }),
    });
  }

  function convertLead(row) {
    if (row.converted_contact_id) return toast('Already converted to a customer', 'ok');
    openModal({
      title: `Convert “${escapeHtml(row.name)}” to customer`,
      body: `<p style="color:var(--muted)">This creates a <strong>Customer</strong> in your books and a <strong>CRM Contact</strong>, and marks the lead as Won.</p>
        <div class="field" style="margin-top:12px"><label><input type="checkbox" id="mkDeal" checked style="width:auto;margin-right:6px">Also create a Won deal</label></div>
        <div class="field"><label>Deal amount (AED)</label><input class="input" type="number" step="0.01" id="dealAmt" value="0"></div>`,
      footer: `<button class="btn btn-outline" data-close>Cancel</button><button class="btn btn-primary" data-yes>${icon('users')} Convert</button>`,
      onMount: (back, close) => {
        back.querySelector('[data-yes]').onclick = async () => {
          try {
            await post(`/api/leads/${row.id}/convert`, { create_deal: back.querySelector('#mkDeal').checked, amount: Number(back.querySelector('#dealAmt').value || 0), owner: ctx.user.full_name });
            const fresh = rows.find((r) => r.id === row.id); if (fresh) { fresh.status = 'Won'; fresh.converted_contact_id = -1; }
            toast('Lead converted to customer', 'ok'); close(); renderTab();
          } catch (e) { toast(e.message, 'err'); }
        };
      },
    });
  }

  function openForm(row) {
    const r = row || {};
    openModal({
      title: row ? 'Edit lead' : 'Add lead',
      body: `<form id="lf">
        <div class="field"><label>Name</label><input class="input" name="name" value="${escapeHtml(r.name || '')}" required></div>
        <div class="grid-2">
          <div class="field"><label>Business category</label><input class="input" name="business_category" value="${escapeHtml(r.business_category || '')}"></div>
          <div class="field"><label>Status</label><select class="select" name="status">${optionList(STATUSES, r.status || 'New')}</select></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>Next action</label><input class="input" name="next_action" value="${escapeHtml(r.next_action || '')}"></div>
          <div class="field"><label>Next action date</label><input class="input" type="date" name="next_action_date" value="${r.next_action_date || ''}"></div>
        </div>
        <div class="field"><label>Source</label><input class="input" name="source" value="${escapeHtml(r.source || '')}"></div>
        <div class="field"><label>Notes</label><textarea class="input" name="notes" rows="2">${escapeHtml(r.notes || '')}</textarea></div>
      </form>`,
      footer: `<button class="btn btn-outline" data-close>Cancel</button><button class="btn btn-primary" data-save>${row ? 'Save' : 'Add lead'}</button>`,
      onMount: (back, close) => {
        back.querySelector('[data-save]').onclick = async () => {
          const fd = Object.fromEntries(new FormData(back.querySelector('#lf')));
          if (!fd.name) return toast('Name is required', 'err');
          try {
            if (row) { const u = await put('/api/leads/' + row.id, fd); Object.assign(rows.find((x) => x.id === row.id), u); }
            else { rows.unshift(await post('/api/leads', fd)); }
            toast(row ? 'Lead updated' : 'Lead added', 'ok'); close(); renderTab();
          } catch (e) { toast(e.message, 'err'); }
        };
      },
    });
  }
}
