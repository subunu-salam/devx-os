import { get, post, put, del, icon, badge, fmtDate, escapeHtml, toast, openModal, confirmDialog, optionList } from '../api.js';
import { pageHead, kpiRow, listView, rowActionButtons } from '../ui.js';

const TYPES = ['Sales/Demo', 'Follow-up', 'Internal', 'Other'];
const MODES = ['In-Person', 'Online', 'Hybrid', 'Phone Call'];
const STATUSES = ['Pending', 'Confirmed', 'Completed', 'Cancelled', 'Rescheduled'];

export default async function meetings(view, ctx) {
  const isAdmin = ctx.user.role === 'admin';
  let rows = await get('/api/meetings');
  let users = await get('/api/users').catch(() => []);
  const persons = users.map((u) => u.full_name);

  const monthKey = new Date().toISOString().slice(0, 7);
  const kpis = [
    { label: 'Total meetings', value: rows.length, icon: 'calendar' },
    { label: 'Completed', value: rows.filter((r) => r.status === 'Completed').length, icon: 'check2', tone: 'green' },
    { label: 'Pending', value: rows.filter((r) => r.status === 'Pending').length, icon: 'clock', tone: 'amber' },
    { label: 'This month', value: rows.filter((r) => (r.meeting_date || '').slice(0, 7) === monthKey).length, icon: 'trending' },
  ];

  view.innerHTML = pageHead({
    title: 'Meeting Tracker', desc: 'Client & sales meetings — schedule, track status, and review history.',
    actions: `<div class="tabs" id="mtabs"><button class="active" data-tab="list">List</button><button data-tab="cal">Calendar</button></div>
              <button class="btn btn-primary" id="addBtn">${icon('plus')} Schedule Meeting</button>`,
  }) + kpiRow(kpis) + `<div id="mbody"></div>`;

  const body = view.querySelector('#mbody');
  let tab = 'list';
  renderTab();

  view.querySelectorAll('#mtabs button').forEach((b) => b.onclick = () => {
    tab = b.dataset.tab;
    view.querySelectorAll('#mtabs button').forEach((x) => x.classList.toggle('active', x === b));
    renderTab();
  });
  view.querySelector('#addBtn').onclick = () => openForm();

  function renderTab() { tab === 'list' ? renderList() : renderCalendar(); }

  function renderList() {
    listView({
      mount: body, rows,
      searchKeys: ['client_name', 'business_category', 'remarks', 'confirmed_by'],
      filters: [
        { key: 'status', label: 'Status', options: ['All', ...STATUSES], match: (r, v) => r.status === v },
        { key: 'type', label: 'Type', options: ['All', ...TYPES], match: (r, v) => r.meeting_type === v },
        { key: 'mode', label: 'Mode', options: ['All', ...MODES], match: (r, v) => r.meeting_mode === v },
      ],
      empty: 'No meetings yet. Click “Schedule Meeting” to add one.',
      columns: [
        { label: 'Date', sort: (r) => r.meeting_date || '', render: (r) => `<strong>${fmtDate(r.meeting_date)}</strong>${r.meeting_time ? `<div class="muted" style="font-size:12px">${r.meeting_time}</div>` : ''}` },
        { label: 'Client', sort: (r) => r.client_name || '', render: (r) => `<strong>${escapeHtml(r.client_name)}</strong>${r.business_category ? `<div class="muted" style="font-size:12px">${escapeHtml(r.business_category)}</div>` : ''}` },
        { label: 'Type', sort: (r) => r.meeting_type, render: (r) => escapeHtml(r.meeting_type) },
        { label: 'Mode', sort: (r) => r.meeting_mode, render: (r) => escapeHtml(r.meeting_mode) },
        { label: 'Confirmed by', render: (r) => escapeHtml(r.confirmed_by || '—') },
        { label: 'Status', sort: (r) => r.status, render: (r) => badge(r.status) },
        { label: 'Remarks', render: (r) => `<span class="muted" title="${escapeHtml(r.remarks || '')}">${escapeHtml((r.remarks || '').slice(0, 60))}${(r.remarks || '').length > 60 ? '…' : ''}</span>` },
        { label: '', align: 'right', render: () => rowActionButtons(isAdmin) },
      ],
      onRowsRendered: (tbody) => wireRowActions(tbody),
    });
  }

  function wireRowActions(tbody) {
    tbody.querySelectorAll('tr').forEach((tr) => {
      const row = rows.find((r) => r.id == tr.dataset.id);
      tr.querySelector('[data-edit]')?.addEventListener('click', (e) => { e.stopPropagation(); openForm(row); });
      tr.querySelector('[data-del]')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (await confirmDialog(`Delete meeting with ${row.client_name}?`)) {
          await del('/api/meetings/' + row.id); rows = rows.filter((r) => r.id !== row.id);
          toast('Meeting deleted', 'ok'); renderTab();
        }
      });
    });
  }

  let calMonth = new Date();
  function renderCalendar() {
    const y = calMonth.getFullYear(), m = calMonth.getMonth();
    const first = new Date(y, m, 1); const startDow = (first.getDay() + 6) % 7; // Mon-first
    const days = new Date(y, m + 1, 0).getDate();
    const monthName = calMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const todayStr = new Date().toISOString().slice(0, 10);
    const dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    let cells = '';
    for (let i = 0; i < startDow; i++) cells += `<div class="cal-cell blank"></div>`;
    for (let d = 1; d <= days; d++) {
      const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const evs = rows.filter((r) => r.meeting_date === ds);
      cells += `<div class="cal-cell ${ds === todayStr ? 'today' : ''}"><div class="d">${d}</div>` +
        evs.map((e) => `<div class="cal-ev" data-ev="${e.id}" title="${escapeHtml(e.client_name)}">${escapeHtml(e.client_name)}</div>`).join('') + `</div>`;
    }
    body.innerHTML = `<div class="cal">
      <div class="cal-head"><strong>${monthName}</strong>
        <div style="display:flex;gap:6px">
          <button class="btn btn-outline btn-icon btn-sm" data-prev>${icon('chevronL')}</button>
          <button class="btn btn-outline btn-sm" data-today>Today</button>
          <button class="btn btn-outline btn-icon btn-sm" data-next>${icon('chevronR')}</button>
        </div></div>
      <div class="cal-grid">${dow.map((d) => `<div class="cal-dow">${d}</div>`).join('')}${cells}</div></div>`;
    body.querySelector('[data-prev]').onclick = () => { calMonth = new Date(y, m - 1, 1); renderCalendar(); };
    body.querySelector('[data-next]').onclick = () => { calMonth = new Date(y, m + 1, 1); renderCalendar(); };
    body.querySelector('[data-today]').onclick = () => { calMonth = new Date(); renderCalendar(); };
    body.querySelectorAll('[data-ev]').forEach((el) => el.onclick = () => openForm(rows.find((r) => r.id == el.dataset.ev)));
  }

  function openForm(row) {
    const r = row || {};
    openModal({
      title: row ? 'Edit meeting' : 'Schedule meeting',
      body: `<form id="mf">
        <div class="grid-2">
          <div class="field"><label>Date</label><input class="input" type="date" name="meeting_date" value="${r.meeting_date || ''}" required></div>
          <div class="field"><label>Time</label><input class="input" type="time" name="meeting_time" value="${r.meeting_time || ''}"></div>
        </div>
        <div class="field"><label>Client name</label><input class="input" name="client_name" value="${escapeHtml(r.client_name || '')}" required></div>
        <div class="field"><label>Business category</label><input class="input" name="business_category" value="${escapeHtml(r.business_category || '')}" placeholder="e.g. Supermarket, Trading"></div>
        <div class="grid-2">
          <div class="field"><label>Type</label><select class="select" name="meeting_type">${optionList(TYPES, r.meeting_type || 'Sales/Demo')}</select></div>
          <div class="field"><label>Mode</label><select class="select" name="meeting_mode">${optionList(MODES, r.meeting_mode || 'In-Person')}</select></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>Confirmed by</label><select class="select" name="confirmed_by"><option value="">—</option>${optionList(persons, r.confirmed_by || '')}</select></div>
          <div class="field"><label>Status</label><select class="select" name="status">${optionList(STATUSES, r.status || 'Pending')}</select></div>
        </div>
        <div class="field"><label>Remarks / notes</label><textarea class="input" name="remarks" rows="3">${escapeHtml(r.remarks || '')}</textarea></div>
      </form>`,
      footer: `<button class="btn btn-outline" data-close>Cancel</button><button class="btn btn-primary" data-save>${row ? 'Save changes' : 'Schedule'}</button>`,
      onMount: (back, close) => {
        back.querySelector('[data-save]').onclick = async () => {
          const fd = Object.fromEntries(new FormData(back.querySelector('#mf')));
          if (!fd.client_name || !fd.meeting_date) return toast('Client and date are required', 'err');
          try {
            if (row) { const u = await put('/api/meetings/' + row.id, fd); Object.assign(rows.find((x) => x.id === row.id), u); }
            else { rows.unshift(await post('/api/meetings', fd)); }
            toast(row ? 'Meeting updated' : 'Meeting scheduled', 'ok'); close(); renderTab();
          } catch (e) { toast(e.message, 'err'); }
        };
      },
    });
  }
}
