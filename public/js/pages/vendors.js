import { get } from '../api.js';
import { crudPage } from './_shared.js';

export default async function vendors(view, ctx) {
  await crudPage(view, ctx, {
    title: 'Vendors', desc: 'Suppliers you buy from and pay — the purchases side of your books.',
    addLabel: 'New Vendor', apiBase: '/api/contacts', entityName: 'vendor',
    fetch: async () => (await get('/api/contacts')).filter((c) => c.contact_type === 'vendor'),
    searchKeys: ['display_name', 'company_name', 'email', 'phone', 'trn'],
    kpis: (rows) => [
      { label: 'Total vendors', value: rows.length, icon: 'users' },
      { label: 'Active', value: rows.filter((r) => r.is_active).length, icon: 'check2', tone: 'green' },
      { label: 'With TRN', value: rows.filter((r) => r.trn).length, icon: 'shield' },
    ],
    columns: [
      { label: 'Name', sort: (r) => r.display_name, render: (r) => `<strong>${esc(r.display_name)}</strong>${r.company_name ? `<div class="muted" style="font-size:12px">${esc(r.company_name)}</div>` : ''}` },
      { label: 'Email', render: (r) => esc(r.email || '—') },
      { label: 'Phone', render: (r) => esc(r.phone || '—') },
      { label: 'TRN', render: (r) => esc(r.trn || '—') },
    ],
    fields: [
      { name: 'display_name', label: 'Display name', required: true },
      { name: 'company_name', label: 'Company name' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'phone', label: 'Phone' },
      { name: 'trn', label: 'Tax Registration No. (TRN)' },
      { name: 'payment_terms', label: 'Payment terms', type: 'select', options: ['Due on Receipt', 'Net 15', 'Net 30', 'Net 45', 'Net 60'] },
      { name: 'billing_address', label: 'Address', type: 'textarea', full: true },
      { name: 'notes', label: 'Notes', type: 'textarea', full: true },
    ],
    toPayload: (fd) => ({ ...fd, contact_type: 'vendor', is_active: 1 }),
    empty: 'No vendors yet.',
  });
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
