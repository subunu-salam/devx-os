import { fmtAED } from '../api.js';
import { crudPage } from './_shared.js';

export default async function crmAccounts(view, ctx) {
  await crudPage(view, ctx, {
    title: 'Accounts', desc: 'Companies and organisations in your CRM.',
    addLabel: 'New Account', apiBase: '/api/crm/accounts', entityName: 'account',
    searchKeys: ['name', 'industry', 'billing_city', 'phone'],
    kpis: (rows) => [
      { label: 'Total accounts', value: rows.length, icon: 'building' },
      { label: 'Industries', value: new Set(rows.map((r) => r.industry).filter(Boolean)).size, icon: 'layers' },
    ],
    columns: [
      { label: 'Name', sort: (r) => r.name, render: (r) => `<strong>${esc(r.name)}</strong>` },
      { label: 'Industry', render: (r) => esc(r.industry || '—') },
      { label: 'City', render: (r) => esc(r.billing_city || '—') },
      { label: 'Phone', render: (r) => esc(r.phone || '—') },
      { label: 'Owner', render: (r) => esc(r.owner || '—') },
    ],
    fields: [
      { name: 'name', label: 'Account name', required: true, full: true },
      { name: 'industry', label: 'Industry' },
      { name: 'website', label: 'Website' },
      { name: 'phone', label: 'Phone' },
      { name: 'billing_city', label: 'City' },
      { name: 'employees', label: 'Employees' },
      { name: 'annual_revenue', label: 'Annual revenue (AED)', type: 'number' },
      { name: 'owner', label: 'Owner' },
      { name: 'description', label: 'Notes', type: 'textarea', full: true },
    ],
    empty: 'No accounts yet.',
  });
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
