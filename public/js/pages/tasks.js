import { fmtDate, badge } from '../api.js';
import { crudPage } from './_shared.js';

const STATUSES = ['Open', 'In Progress', 'Completed', 'Deferred'];
const TYPES = ['Call', 'Email', 'Meeting', 'Follow-up', 'To-Do'];
const PRIOS = ['Low', 'Normal', 'High'];

export default async function tasks(view, ctx) {
  await crudPage(view, ctx, {
    title: 'Tasks', desc: 'Activities and follow-ups across your CRM pipeline.',
    addLabel: 'New Task', apiBase: '/api/tasks', entityName: 'task',
    searchKeys: ['subject', 'related_to', 'owner'],
    kpis: (rows) => [
      { label: 'Open', value: rows.filter((r) => r.status === 'Open').length, icon: 'clock', tone: 'amber' },
      { label: 'In progress', value: rows.filter((r) => r.status === 'In Progress').length, icon: 'zap' },
      { label: 'Completed', value: rows.filter((r) => r.status === 'Completed').length, icon: 'check2', tone: 'green' },
      { label: 'High priority', value: rows.filter((r) => r.priority === 'High' && r.status !== 'Completed').length, icon: 'target', tone: 'red' },
    ],
    filters: [
      { key: 'status', label: 'Status', options: ['All', ...STATUSES], match: (r, v) => r.status === v },
      { key: 'type', label: 'Type', options: ['All', ...TYPES], match: (r, v) => r.task_type === v },
    ],
    columns: [
      { label: 'Subject', sort: (r) => r.subject, render: (r) => `<strong>${esc(r.subject)}</strong>${r.related_to ? `<div class="muted" style="font-size:12px">${esc(r.related_to)}</div>` : ''}` },
      { label: 'Type', render: (r) => esc(r.task_type) },
      { label: 'Due', sort: (r) => r.due_date || '', render: (r) => fmtDate(r.due_date) },
      { label: 'Priority', sort: (r) => r.priority, render: (r) => `<span class="badge ${r.priority === 'High' ? 'b-red' : r.priority === 'Low' ? 'b-gray' : 'b-blue'}">${esc(r.priority)}</span>` },
      { label: 'Status', sort: (r) => r.status, render: (r) => badge(r.status === 'Completed' ? 'Completed' : r.status === 'Open' ? 'Pending' : r.status) },
      { label: 'Owner', render: (r) => esc(r.owner || '—') },
    ],
    fields: [
      { name: 'subject', label: 'Subject', required: true, full: true },
      { name: 'task_type', label: 'Type', type: 'select', options: TYPES },
      { name: 'related_to', label: 'Related to (deal / contact)' },
      { name: 'due_date', label: 'Due date', type: 'date' },
      { name: 'priority', label: 'Priority', type: 'select', options: PRIOS, value: 'Normal' },
      { name: 'status', label: 'Status', type: 'select', options: STATUSES },
      { name: 'owner', label: 'Owner' },
      { name: 'notes', label: 'Notes', type: 'textarea', full: true },
    ],
    empty: 'No tasks yet.',
  });
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
