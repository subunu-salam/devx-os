import { post, fmtAED, toast, confirmDialog } from '../api.js';
import { docPage } from './_doc.js';

export default docPage({
  title: 'Purchase Orders', desc: 'Orders you send to vendors — convert to a bill when goods arrive.',
  addLabel: 'New Purchase Order', apiBase: '/api/purchase-orders', entity: 'purchase order',
  numberKey: 'po_number', numberLabel: 'PO #', nameKey: 'vendor_name', nameLabel: 'Vendor',
  dateKey: 'po_date', dateLabel: 'PO date', extraDateKey: 'delivery_date', extraDateLabel: 'Delivery date',
  contactType: 'vendor', withAccount: true, taxLabel: 'VAT %', amountClass: 'neg',
  statuses: ['Draft', 'Issued', 'Billed', 'Cancelled'], formStatuses: ['Draft', 'Issued'],
  statusBadge: (s) => s === 'Issued' ? 'Sent' : s === 'Billed' ? 'Won' : s,
  kpis: (rows) => [
    { label: 'Total POs', value: rows.length, icon: 'file' },
    { label: 'Open value', value: fmtAED(rows.filter((r) => r.status === 'Issued').reduce((s, r) => s + r.total, 0)), icon: 'clock', tone: 'amber' },
    { label: 'Billed', value: rows.filter((r) => r.status === 'Billed').length, icon: 'invoice' },
  ],
  rowActions: [{
    key: 'convert', icon: 'invoice', title: 'Convert to bill', show: (r) => r.status !== 'Billed',
    run: async (r, reload) => { if (await confirmDialog('Convert this purchase order into a bill?', { danger: false, confirmText: 'Convert' })) { try { await post(`/api/purchase-orders/${r.id}/convert`); toast('Converted to bill', 'ok'); reload(); } catch (e) { toast(e.message, 'err'); } } },
  }],
});
