import { paymentsPage } from './_payments.js';

export default paymentsPage({
  type: 'received',
  title: 'Payments Received',
  desc: 'Money collected from customers — clears their outstanding invoices.',
  contactType: 'customer',
  docApi: '/api/invoices',
  docLabel: 'Apply to invoice',
  docNumberKey: 'invoice_number',
  docNameKey: 'client_name',
});
