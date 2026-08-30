import { fmtAED } from '../api.js';
import { docPage } from './_doc.js';

export default docPage({
  title: 'Vendor Credits', desc: 'Credits received from vendors — reduce what you owe (Accounts Payable).',
  addLabel: 'New Vendor Credit', apiBase: '/api/vendor-credits', entity: 'vendor credit',
  numberKey: 'vc_number', numberLabel: 'VC #', nameKey: 'vendor_name', nameLabel: 'Vendor',
  dateKey: 'vc_date', dateLabel: 'Date',
  contactType: 'vendor', withAccount: true, reason: true, taxLabel: 'VAT %', amountClass: 'neg',
  kpis: (rows) => [
    { label: 'Total credits', value: fmtAED(rows.reduce((s, r) => s + r.total, 0)), icon: 'receipt', tone: 'green' },
    { label: 'Vendor credits', value: rows.length, icon: 'file' },
  ],
});
