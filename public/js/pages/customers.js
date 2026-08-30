import { get, fmtAED } from '../api.js';
import { crudPage } from './_shared.js';

export default async function customers(view, ctx) {
  await crudPage(view, ctx, {
    title: 'Customers', desc: 'People and companies you bill — the sales side of your books.',
    addLabel: 'New Customer', apiBase: '/api/contacts', entityName: 'customer',
    fetch: async () => (await get('/api/contacts')).filter((c) => c.contact_type === 'customer'),
    searchKeys: ['display_name', 'company_name', 'email', 'phone', 'trn'],
    kpis: (rows) => [
      { label: 'Total customers', value: rows.length, icon: 'users' },
      { label: 'Active', value: rows.filter((r) => r.is_active).length, icon: 'check2', tone: 'green' },
      { label: 'With TRN', value: rows.filter((r) => r.trn).length, icon: 'shield' },
    ],
    columns: [
      { label: 'Name', sort: (r) => r.display_name, render: (r) => `<strong>${esc(r.display_name)}</strong>${r.company_name ? `<div class="muted" style="font-size:12px">${esc(r.company_name)}</div>` : ''}` },
      { label: 'Email', render: (r) => esc(r.email || '—') },
      { label: 'Phone', render: (r) => esc(r.phone || '—') },
      { label: 'TRN', render: (r) => esc(r.trn || '—') },
      { label: 'Terms', render: (r) => esc(r.payment_terms || '—') },
    ],
    fields: [
      { name: 'display_name', label: 'Display name', required: true },
      { name: 'company_name', label: 'Company name' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'phone', label: 'Phone' },
      { name: 'trn', label: 'Tax Registration No. (TRN)' },
      { name: 'payment_terms', label: 'Payment terms', type: 'select', options: ['Due on Receipt', 'Net 15', 'Net 30', 'Net 45', 'Net 60'] },
      { name: 'billing_address', label: 'Billing address', type: 'textarea', full: true },
      { name: 'notes', label: 'Notes', type: 'textarea', full: true },
    ],
    toPayload: (fd) => ({ ...fd, contact_type: 'customer', is_active: 1 }),
    empty: 'No customers yet. Add your first customer.',
  });
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
