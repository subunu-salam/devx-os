import { get, icon, escapeHtml, fmtDateTime, badge } from '../api.js';
import { pageHead, listView } from '../ui.js';

const ACTION_BADGE = { login: 'b-blue', logout: 'b-gray', create: 'b-green', update: 'b-amber', delete: 'b-red' };

export default async function activity(view, ctx) {
  if (ctx.user.role !== 'admin') { view.innerHTML = `<div class="empty">${icon('lock')}<p>Admins only.</p></div>`; return; }
  const rows = await get('/api/activity');

  view.innerHTML = pageHead({ title: 'Activity Logs', desc: 'Every sign-in and change across DevX OS — full audit trail.' }) + `<div id="abody"></div>`;

  listView({
    mount: view.querySelector('#abody'), rows,
    searchKeys: ['user_name', 'action', 'entity_type', 'description'],
    filters: [
      { key: 'action', label: 'Action', options: ['All', 'login', 'logout', 'create', 'update', 'delete'], match: (r, v) => r.action === v },
      { key: 'entity', label: 'Module', options: ['All', ...[...new Set(rows.map((r) => r.entity_type).filter(Boolean))]], match: (r, v) => r.entity_type === v },
    ],
    empty: 'No activity recorded yet.',
    columns: [
      { label: 'When', sort: (r) => r.created_at, render: (r) => fmtDateTime(r.created_at) },
      { label: 'User', sort: (r) => r.user_name, render: (r) => `<strong>${escapeHtml(r.user_name || '—')}</strong>` },
      { label: 'Action', sort: (r) => r.action, render: (r) => `<span class="badge ${ACTION_BADGE[r.action] || 'b-gray'}">${escapeHtml(r.action)}</span>` },
      { label: 'Module', render: (r) => escapeHtml(r.entity_type || '—') },
      { label: 'Detail', render: (r) => `<span class="muted">${escapeHtml(r.description || '')}</span>` },
    ],
  });
}
