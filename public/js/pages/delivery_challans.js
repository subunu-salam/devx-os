import { post, toast, confirmDialog } from '../api.js';
import { docPage } from './_doc.js';

export default docPage({
  title: 'Delivery Challans', desc: 'Goods delivered to customers — convert to an invoice to bill them.',
  addLabel: 'New Delivery Challan', apiBase: '/api/delivery-challans', entity: 'delivery challan',
  numberKey: 'dc_number', numberLabel: 'Challan #', nameKey: 'client_name', nameLabel: 'Customer',
  dateKey: 'dc_date', dateLabel: 'Challan date', extra: ['reference'],
  contactType: 'customer', taxLabel: 'VAT %',
  statuses: ['Draft', 'Delivered', 'Invoiced', 'Returned'], formStatuses: ['Draft', 'Delivered', 'Returned'],
  statusBadge: (s) => s === 'Delivered' ? 'Confirmed' : s === 'Invoiced' ? 'Won' : s === 'Returned' ? 'Lost' : s,
  kpis: (rows) => [
    { label: 'Total challans', value: rows.length, icon: 'file' },
    { label: 'Delivered', value: rows.filter((r) => r.status === 'Delivered').length, icon: 'check2', tone: 'green' },
    { label: 'Invoiced', value: rows.filter((r) => r.status === 'Invoiced').length, icon: 'invoice' },
  ],
  rowActions: [{
    key: 'convert', icon: 'invoice', title: 'Convert to invoice', show: (r) => r.status !== 'Invoiced',
    run: async (r, reload) => { if (await confirmDialog('Convert this delivery challan into an invoice?', { danger: false, confirmText: 'Convert' })) { try { await post(`/api/delivery-challans/${r.id}/convert`); toast('Converted to invoice', 'ok'); reload(); } catch (e) { toast(e.message, 'err'); } } },
  }],
});
