import { post, fmtAED, toast, confirmDialog } from '../api.js';
import { docPage } from './_doc.js';

export default docPage({
  title: 'Sales Orders', desc: 'Confirmed customer orders — convert them into invoices when ready.',
  addLabel: 'New Sales Order', apiBase: '/api/sales-orders', entity: 'sales order',
  numberKey: 'so_number', numberLabel: 'SO #', nameKey: 'client_name', nameLabel: 'Customer',
  dateKey: 'so_date', dateLabel: 'Order date', extraDateKey: 'shipment_date', extraDateLabel: 'Shipment date',
  contactType: 'customer', statuses: ['Draft', 'Confirmed', 'Closed', 'Invoiced'], formStatuses: ['Draft', 'Confirmed', 'Closed'],
  statusBadge: (s) => s === 'Confirmed' ? 'Interested' : s === 'Invoiced' ? 'Won' : s,
  kpis: (rows) => [
    { label: 'Total orders', value: rows.length, icon: 'file' },
    { label: 'Confirmed', value: fmtAED(rows.filter((r) => r.status === 'Confirmed').reduce((s, r) => s + r.total, 0)), icon: 'check2', tone: 'green' },
    { label: 'Invoiced', value: rows.filter((r) => r.status === 'Invoiced').length, icon: 'invoice' },
  ],
  rowActions: [{
    key: 'convert', icon: 'invoice', title: 'Convert to invoice', show: (r) => r.status !== 'Invoiced',
    run: async (r, reload) => { if (await confirmDialog('Convert this sales order into an invoice?', { danger: false, confirmText: 'Convert' })) { try { await post(`/api/sales-orders/${r.id}/convert`); toast('Converted to invoice', 'ok'); reload(); } catch (e) { toast(e.message, 'err'); } } },
  }],
});
