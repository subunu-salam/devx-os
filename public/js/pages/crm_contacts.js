import { crudPage } from './_shared.js';

export default async function crmContacts(view, ctx) {
  await crudPage(view, ctx, {
    title: 'Contacts', desc: 'People in your CRM — decision-makers and points of contact.',
    addLabel: 'New Contact', apiBase: '/api/crm/contacts', entityName: 'contact',
    searchKeys: ['first_name', 'last_name', 'account_name', 'email', 'phone', 'title'],
    kpis: (rows) => [
      { label: 'Total contacts', value: rows.length, icon: 'users' },
      { label: 'With email', value: rows.filter((r) => r.email).length, icon: 'mail' },
      { label: 'Companies', value: new Set(rows.map((r) => r.account_name).filter(Boolean)).size, icon: 'building' },
    ],
    columns: [
      { label: 'Name', sort: (r) => r.last_name, render: (r) => `<strong>${esc(((r.first_name || '') + ' ' + r.last_name).trim())}</strong>${r.title ? `<div class="muted" style="font-size:12px">${esc(r.title)}</div>` : ''}` },
      { label: 'Account', render: (r) => esc(r.account_name || '—') },
      { label: 'Email', render: (r) => esc(r.email || '—') },
      { label: 'Phone', render: (r) => esc(r.phone || r.mobile || '—') },
      { label: 'Owner', render: (r) => esc(r.owner || '—') },
    ],
    fields: [
      { name: 'first_name', label: 'First name' },
      { name: 'last_name', label: 'Last name', required: true },
      { name: 'account_name', label: 'Account / company' },
      { name: 'title', label: 'Job title' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'phone', label: 'Phone' },
      { name: 'mobile', label: 'Mobile' },
      { name: 'lead_source', label: 'Lead source', type: 'select', options: ['', 'Meeting', 'Referral', 'Website', 'Cold Call', 'Social', 'Event'], allowEmpty: true },
      { name: 'owner', label: 'Owner' },
      { name: 'description', label: 'Notes', type: 'textarea', full: true },
    ],
    empty: 'No contacts yet.',
  });
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
