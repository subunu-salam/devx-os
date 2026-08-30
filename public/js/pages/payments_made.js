import { paymentsPage } from './_payments.js';

export default paymentsPage({
  type: 'made',
  title: 'Payments Made',
  desc: 'Money paid to vendors — settles your outstanding bills.',
  contactType: 'vendor',
  docApi: '/api/bills',
  docLabel: 'Apply to bill',
  docNumberKey: 'bill_number',
  docNameKey: 'vendor_name',
});
