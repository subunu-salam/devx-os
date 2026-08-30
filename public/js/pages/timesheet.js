import { get, fmtDate } from '../api.js';
import { crudPage } from './_shared.js';

export default async function timesheet(view, ctx) {
  let projects = await get('/api/projects').catch(() => []);
  let users = await get('/api/users').catch(() => []);
  const projName = (id) => projects.find((p) => p.id == id)?.name || '';

  await crudPage(view, ctx, {
    title: 'Timesheet', desc: 'Log billable and non-billable hours against projects.',
    addLabel: 'Log Time', apiBase: '/api/time-entries', entityName: 'time entry',
    searchKeys: ['project_name', 'task', 'user_name'],
    kpis: (rows) => [
      { label: 'Total hours', value: rows.reduce((s, r) => s + Number(r.hours || 0), 0).toFixed(1), icon: 'clock' },
      { label: 'Billable hours', value: rows.filter((r) => r.billable).reduce((s, r) => s + Number(r.hours || 0), 0).toFixed(1), icon: 'wallet', tone: 'green' },
      { label: 'Entries', value: rows.length, icon: 'receipt' },
    ],
    filters: [{ key: 'project', label: 'Project', options: ['All', ...[...new Set(projects.map((p) => p.name))]], match: (r, v) => r.project_name === v }],
    columns: [
      { label: 'Date', sort: (r) => r.entry_date, render: (r) => fmtDate(r.entry_date) },
      { label: 'Project', sort: (r) => r.project_name, render: (r) => `<strong>${esc(r.project_name || '—')}</strong>${r.task ? `<div class="muted" style="font-size:12px">${esc(r.task)}</div>` : ''}` },
      { label: 'User', render: (r) => esc(r.user_name || '—') },
      { label: 'Hours', align: 'right', sort: (r) => Number(r.hours), render: (r) => `<strong>${Number(r.hours).toFixed(2)}</strong>` },
      { label: 'Billable', render: (r) => r.billable ? `<span class="badge b-green">Billable</span>` : `<span class="badge b-gray">Non-billable</span>` },
    ],
    fields: [
      { name: 'project_id', label: 'Project', type: 'select', options: projects.map((p) => ({ value: p.id, label: p.name })), required: true },
      { name: 'entry_date', label: 'Date', type: 'date', required: true, value: new Date().toISOString().slice(0, 10) },
      { name: 'task', label: 'Task' },
      { name: 'user_name', label: 'User', type: 'select', allowEmpty: true, options: users.map((u) => ({ value: u.full_name, label: u.full_name })) },
      { name: 'hours', label: 'Hours', type: 'number', required: true },
      { name: 'billable', label: 'Billable?', type: 'select', options: [{ value: '1', label: 'Billable' }, { value: '0', label: 'Non-billable' }] },
      { name: 'notes', label: 'Notes', type: 'textarea', full: true },
    ],
    toPayload: (fd) => ({ ...fd, project_id: Number(fd.project_id), project_name: projName(fd.project_id), billable: Number(fd.billable), hours: Number(fd.hours) }),
    empty: 'No time logged yet.',
  });
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
