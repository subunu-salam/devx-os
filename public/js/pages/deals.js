import { get, post, put, del, icon, fmtAED, fmtDate, escapeHtml, toast, openModal, confirmDialog, optionList } from '../api.js';
import { pageHead, kpiRow, listView, rowActionButtons } from '../ui.js';

const STAGES = ['Qualification', 'Needs Analysis', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];
const STAGE_PROB = { 'Qualification': 10, 'Needs Analysis': 25, 'Proposal': 50, 'Negotiation': 75, 'Closed Won': 100, 'Closed Lost': 0 };
const SOURCES = ['Meeting', 'Referral', 'Website', 'Cold Call', 'Social', 'Event'];

export default async function deals(view, ctx) {
  const isAdmin = ctx.user.role === 'admin';
  let rows = await get('/api/deals');

  const open = rows.filter((r) => !r.stage.startsWith('Closed'));
  const won = rows.filter((r) => r.stage === 'Closed Won');
  const pipeline = open.reduce((s, r) => s + Number(r.amount || 0), 0);
  const weighted = open.reduce((s, r) => s + Number(r.amount || 0) * Number(r.probability || 0) / 100, 0);
  const wonValue = won.reduce((s, r) => s + Number(r.amount || 0), 0);

  view.innerHTML = pageHead({
    title: 'Deals', desc: 'Your sales pipeline — opportunities from qualification to close.',
    actions: `<div class="tabs" id="dtabs"><button class="active" data-tab="board">Pipeline</button><button data-tab="list">Table</button></div>
              <button class="btn btn-primary" id="addBtn">${icon('plus')} New Deal</button>`,
  }) + kpiRow([
    { label: 'Open deals', value: open.length, icon: 'target' },
    { label: 'Pipeline value', value: fmtAED(pipeline), icon: 'trending', tone: 'amber' },
    { label: 'Weighted value', value: fmtAED(weighted), sub: 'by probability', icon: 'zap', tone: 'green' },
    { label: 'Won', value: fmtAED(wonValue), sub: `${won.length} deals`, icon: 'check2', tone: 'green' },
  ]) + `<div id="dbody"></div>`;

  const body = view.querySelector('#dbody');
  let tab = 'board';
  view.querySelector('#addBtn').onclick = () => openForm();
  view.querySelectorAll('#dtabs button').forEach((b) => b.onclick = () => {
    tab = b.dataset.tab; view.querySelectorAll('#dtabs button').forEach((x) => x.classList.toggle('active', x === b)); renderTab();
  });
  renderTab();

  function renderTab() { tab === 'board' ? renderBoard() : renderList(); }

  function renderBoard() {
    body.innerHTML = `<div class="kanban" style="grid-template-columns:repeat(6,minmax(190px,1fr))">${STAGES.map((s) => {
      const items = rows.filter((r) => r.stage === s);
      const val = items.reduce((a, r) => a + Number(r.amount || 0), 0);
      return `<div class="kan-col"><h4><span>${s}</span><span>${fmtAED(val)}</span></h4>
        ${items.map((r) => `<div class="kan-card" data-id="${r.id}">
          <div class="nm">${escapeHtml(r.name)}</div>
          <div class="ct">${escapeHtml(r.account_name || '—')}</div>
          <div class="ct" style="margin-top:4px;display:flex;justify-content:space-between"><strong style="color:var(--green)">${fmtAED(r.amount)}</strong><span>${r.probability}%</span></div>
        </div>`).join('') || `<div class="muted" style="padding:8px;font-size:12px">—</div>`}
      </div>`;
    }).join('')}</div>`;
    body.querySelectorAll('.kan-card').forEach((c) => c.onclick = () => openForm(rows.find((r) => r.id == c.dataset.id)));
  }

  function renderList() {
    listView({
      mount: body, rows,
      searchKeys: ['name', 'account_name', 'contact_name', 'owner'],
      filters: [{ key: 'stage', label: 'Stage', options: ['All', ...STAGES], match: (r, v) => r.stage === v }],
      empty: 'No deals yet.',
      columns: [
        { label: 'Deal', sort: (r) => r.name, render: (r) => `<strong>${escapeHtml(r.name)}</strong>${r.account_name ? `<div class="muted" style="font-size:12px">${escapeHtml(r.account_name)}</div>` : ''}` },
        { label: 'Amount', align: 'right', sort: (r) => Number(r.amount), render: (r) => `<strong>${fmtAED(r.amount)}</strong>` },
        { label: 'Stage', sort: (r) => r.stage, render: (r) => `<span class="badge ${r.stage === 'Closed Won' ? 'b-green' : r.stage === 'Closed Lost' ? 'b-red' : 'b-blue'}">${escapeHtml(r.stage)}</span>` },
        { label: 'Prob.', align: 'right', render: (r) => `${r.probability}%` },
        { label: 'Closing', sort: (r) => r.closing_date || '', render: (r) => fmtDate(r.closing_date) },
        { label: 'Owner', render: (r) => escapeHtml(r.owner || '—') },
        { label: '', align: 'right', render: () => rowActionButtons(isAdmin) },
      ],
      onRowsRendered: (tbody) => tbody.querySelectorAll('tr').forEach((tr) => {
        const row = rows.find((r) => r.id == tr.dataset.id);
        tr.querySelector('[data-edit]')?.addEventListener('click', () => openForm(row));
        tr.querySelector('[data-del]')?.addEventListener('click', async () => {
          if (await confirmDialog(`Delete deal “${row.name}”?`)) { await del('/api/deals/' + row.id); rows = rows.filter((r) => r.id !== row.id); toast('Deal deleted', 'ok'); renderTab(); }
        });
      }),
    });
  }

  function openForm(row) {
    const r = row || {};
    openModal({
      title: row ? 'Edit deal' : 'New deal',
      body: `<form id="df">
        <div class="field"><label>Deal name</label><input class="input" name="name" value="${escapeHtml(r.name || '')}" required></div>
        <div class="grid-2">
          <div class="field"><label>Account / company</label><input class="input" name="account_name" value="${escapeHtml(r.account_name || '')}"></div>
          <div class="field"><label>Contact</label><input class="input" name="contact_name" value="${escapeHtml(r.contact_name || '')}"></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>Amount (AED)</label><input class="input" type="number" step="0.01" name="amount" value="${r.amount ?? ''}"></div>
          <div class="field"><label>Closing date</label><input class="input" type="date" name="closing_date" value="${r.closing_date || ''}"></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>Stage</label><select class="select" name="stage">${optionList(STAGES, r.stage || 'Qualification')}</select></div>
          <div class="field"><label>Probability %</label><input class="input" type="number" name="probability" value="${r.probability ?? 10}"></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>Lead source</label><select class="select" name="lead_source"><option value="">—</option>${optionList(SOURCES, r.lead_source || '')}</select></div>
          <div class="field"><label>Owner</label><input class="input" name="owner" value="${escapeHtml(r.owner || '')}"></div>
        </div>
        <div class="field"><label>Next step</label><input class="input" name="next_step" value="${escapeHtml(r.next_step || '')}"></div>
        <div class="field"><label>Notes</label><textarea class="input" name="description" rows="2">${escapeHtml(r.description || '')}</textarea></div>
      </form>`,
      footer: `<button class="btn btn-outline" data-close>Cancel</button><button class="btn btn-primary" data-save>${row ? 'Save' : 'Create deal'}</button>`,
      onMount: (back, close) => {
        const stageSel = back.querySelector('[name=stage]');
        const probEl = back.querySelector('[name=probability]');
        stageSel.addEventListener('change', () => { probEl.value = STAGE_PROB[stageSel.value] ?? probEl.value; });
        back.querySelector('[data-save]').onclick = async () => {
          const fd = Object.fromEntries(new FormData(back.querySelector('#df')));
          if (!fd.name) return toast('Deal name is required', 'err');
          fd.amount = Number(fd.amount || 0); fd.probability = Number(fd.probability || 0);
          try {
            if (row) { const u = await put('/api/deals/' + row.id, fd); Object.assign(rows.find((x) => x.id === row.id), u); }
            else { rows.unshift(await post('/api/deals', fd)); }
            toast(row ? 'Deal updated' : 'Deal created', 'ok'); close(); renderTab();
          } catch (e) { toast(e.message, 'err'); }
        };
      },
    });
  }
}
