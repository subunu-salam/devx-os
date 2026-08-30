import { get, fmtAED } from '../api.js';
import { crudPage } from './_shared.js';

const BILLING = ['Fixed Cost', 'Based on Project Hours', 'Based on Staff Hours'];
const STATUS = ['Active', 'On Hold', 'Completed'];

export default async function projects(view, ctx) {
  let customers = (await get('/api/contacts').catch(() => [])).filter((c) => c.contact_type === 'customer');
  await crudPage(view, ctx, {
    title: 'Projects', desc: 'Client projects for time tracking and billing.',
    addLabel: 'New Project', apiBase: '/api/projects', entityName: 'project',
    searchKeys: ['name', 'customer_name'],
    kpis: (rows) => [
      { label: 'Total projects', value: rows.length, icon: 'layers' },
      { label: 'Active', value: rows.filter((r) => r.status === 'Active').length, icon: 'zap', tone: 'green' },
      { label: 'Completed', value: rows.filter((r) => r.status === 'Completed').length, icon: 'check2' },
    ],
    filters: [{ key: 'status', label: 'Status', options: ['All', ...STATUS], match: (r, v) => r.status === v }],
    columns: [
      { label: 'Project', sort: (r) => r.name, render: (r) => `<strong>${esc(r.name)}</strong>` },
      { label: 'Customer', render: (r) => esc(r.customer_name || '—') },
      { label: 'Billing', render: (r) => esc(r.billing_method) },
      { label: 'Rate', align: 'right', render: (r) => r.rate ? fmtAED(r.rate) + '/hr' : '—' },
      { label: 'Status', sort: (r) => r.status, render: (r) => `<span class="badge ${r.status === 'Active' ? 'b-green' : r.status === 'Completed' ? 'b-blue' : 'b-gray'}">${esc(r.status)}</span>` },
    ],
    fields: [
      { name: 'name', label: 'Project name', required: true, full: true },
      { name: 'customer_name', label: 'Customer', type: 'select', allowEmpty: true, options: customers.map((c) => ({ value: c.display_name, label: c.display_name })) },
      { name: 'billing_method', label: 'Billing method', type: 'select', options: BILLING },
      { name: 'rate', label: 'Hourly rate (AED)', type: 'number' },
      { name: 'budget_hours', label: 'Budget (hours)', type: 'number', step: '1' },
      { name: 'status', label: 'Status', type: 'select', options: STATUS },
      { name: 'description', label: 'Description', type: 'textarea', full: true },
    ],
    empty: 'No projects yet.',
  });
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
