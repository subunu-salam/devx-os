// Seeds the Chart of Accounts and migrates existing data into the double-entry ledger,
// plus a little sample CRM + Books data so every report and pipeline has something to show.
import db from './schema.js';
import { postJournal, CODES, idByCode, expenseCategoryToCode } from './accounting.js';

/* [code, name, type, subtype, is_system] */
const ACCOUNTS = [
  // Assets
  ['1000', 'Petty Cash', 'asset', 'cash', 1],
  ['1001', 'Undeposited Funds', 'asset', 'cash', 1],
  ['1010', 'Business Bank Account', 'asset', 'bank', 1],
  ['1200', 'Accounts Receivable', 'asset', 'accounts_receivable', 1],
  ['1300', 'Inventory Asset', 'asset', 'stock', 0],
  ['1400', 'Prepaid Expenses', 'asset', 'current_asset', 0],
  ['1500', 'Furniture & Equipment', 'asset', 'fixed_asset', 0],
  ['1510', 'Input VAT (Recoverable)', 'asset', 'current_asset', 1],
  // Liabilities
  ['2000', 'Accounts Payable', 'liability', 'accounts_payable', 1],
  ['2100', 'VAT Payable (Output)', 'liability', 'tax', 1],
  ['2200', 'Employee Reimbursements', 'liability', 'current_liability', 0],
  // Equity
  ['3000', "Owner's Equity / Capital", 'equity', 'equity', 1],
  ['3100', "Owner's Drawings", 'equity', 'equity', 0],
  ['3200', 'Retained Earnings', 'equity', 'equity', 1],
  // Income
  ['4000', 'Sales / Services Income', 'income', 'income', 1],
  ['4100', 'Other Income', 'income', 'other_income', 0],
  // Cost of Goods Sold
  ['5000', 'Cost of Goods Sold', 'expense', 'cost_of_goods_sold', 1],
  ['5010', 'Labor', 'expense', 'cost_of_goods_sold', 0],
  ['5020', 'Materials', 'expense', 'cost_of_goods_sold', 0],
  ['5030', 'Subcontractor', 'expense', 'cost_of_goods_sold', 0],
  ['5040', 'Job Costing', 'expense', 'cost_of_goods_sold', 0],
  // Expenses
  ['6000', 'Salaries & Wages', 'expense', 'expense', 0],
  ['6010', 'Rent Expense', 'expense', 'expense', 0],
  ['6020', 'Office & Admin Expense', 'expense', 'expense', 0],
  ['6030', 'License & Government Fees', 'expense', 'expense', 0],
  ['6040', 'Travel Expense', 'expense', 'expense', 0],
  ['6050', 'Meals & Entertainment', 'expense', 'expense', 0],
  ['6060', 'Software & Subscriptions', 'expense', 'expense', 0],
  ['6070', 'Marketing & Advertising', 'expense', 'expense', 0],
  ['6080', 'Repairs & Maintenance', 'expense', 'expense', 0],
  ['6090', 'Consultant Expense', 'expense', 'expense', 0],
  ['6100', 'Depreciation Expense', 'expense', 'expense', 0],
  // Other Expenses
  ['6900', 'Other Expenses', 'expense', 'other_expense', 0],
  ['6910', 'Exchange Gain or Loss', 'expense', 'other_expense', 0],
  ['6920', 'Lodging', 'expense', 'other_expense', 0],
];

const CUSTOMERS = [
  ['customer', 'Al Madheena Market', 'Al Madheena Supermarket LLC', 'accounts@almadheena.ae', '+971 50 111 2233', ''],
  ['customer', 'Cee Port Trading', 'Cee Port Trading LLC', 'info@ceeport.ae', '+971 55 222 3344', ''],
  ['customer', 'Rebel Foods', 'Rebel Foods Cloud Kitchen', 'ops@rebelfoods.ae', '+971 52 333 4455', ''],
  ['vendor', 'Dubai Economy (DED)', 'Department of Economy & Tourism', '', '', ''],
  ['vendor', 'Microsoft', 'Microsoft Corporation', '', '', ''],
];

const ITEMS = [
  ['AI CRM Platform Setup', 'service', 'CRM-SETUP', 'One-time CRM implementation & onboarding', 15000, 0, 5, CODES.SALES],
  ['Website Development', 'service', 'WEB-DEV', 'Business website design & build', 8000, 0, 5, CODES.SALES],
  ['AI Forecasting Tool', 'service', 'AI-FORECAST', 'Custom demand-forecasting model', 12000, 0, 5, CODES.SALES],
  ['Monthly Support Retainer', 'service', 'SUPPORT-M', 'Ongoing support & maintenance', 2500, 0, 5, CODES.SALES],
];

const CRM_ACCOUNTS = [
  ['Cee Port Trading LLC', 'Trading', 'https://ceeport.ae', '+971 55 222 3344', 'Dubai', '20-50', 'Subunu'],
  ['Rebel Foods', 'Food & Beverage', '', '+971 52 333 4455', 'Dubai', '50-200', 'Suhail'],
  ['Prince Paul Construction', 'Construction', '', '', 'Sharjah', '10-20', 'Suhail'],
];
const CRM_CONTACTS = [
  ['Haseeb', '', 'Al Madheena Market', 'Owner', 'haseeb@almadheena.ae', '+971 50 111 2233', 'Suhail', 'Meeting'],
  ['Prince', 'Paul', 'Prince Paul Construction', 'Managing Director', '', '+971 50 987 6543', 'Suhail', 'Referral'],
];
const DEALS = [
  ['Al Madheena — Website + WhatsApp', 'Al Madheena Market', 'Haseeb', 8000, 'Proposal', 60, 'Website'],
  ['Cee Port — AI Forecast Tool', 'Cee Port Trading LLC', '', 12000, 'Negotiation', 75, 'Meeting'],
  ['Rebel Foods — Team CRM', 'Rebel Foods', '', 15000, 'Needs Analysis', 40, 'Referral'],
  ['Prince Paul — Business Platform', 'Prince Paul Construction', 'Prince', 25000, 'Qualification', 20, 'Meeting'],
];
const TASKS = [
  ['Send website quote to Al Madheena', 'Al Madheena — Website + WhatsApp', 'Email', 'High'],
  ['Follow up Cee Port forecast demo', 'Cee Port — AI Forecast Tool', 'Call', 'High'],
  ['Prepare CRM proposal for Rebel Foods', 'Rebel Foods — Team CRM', 'To-Do', 'Normal'],
];

export function seedAccounting(founderId) {
  const have = db.prepare('SELECT COUNT(*) n FROM accounts').get().n;
  if (have === 0) {
    const ins = db.prepare('INSERT INTO accounts (code, name, account_type, account_subtype, is_system) VALUES (?,?,?,?,?)');
    for (const a of ACCOUNTS) ins.run(...a);
  }

  // Founder investment → opening journal (Dr Bank, Cr Owner's Equity).
  const openingExists = db.prepare("SELECT COUNT(*) n FROM journals WHERE source_type='opening'").get().n;
  if (!openingExists) {
    postJournal(
      { journal_date: '2026-07-01', reference: '5 x AED 50,000 cheques', notes: 'Founder investment into DevX Technologies', source_type: 'opening' },
      [
        { code: CODES.BANK, debit: 250000, credit: 0, description: 'Founder capital introduced' },
        { code: CODES.OWNER_EQUITY, debit: 0, credit: 250000, description: 'Founder capital introduced' },
      ],
      { id: founderId });
  }

  // Migrate seeded expenses → journals (Dr expense account, Cr Bank).
  const expenses = db.prepare('SELECT * FROM expenses').all();
  for (const e of expenses) {
    const done = db.prepare("SELECT COUNT(*) n FROM journals WHERE source_type='expense' AND source_id=?").get(e.id).n;
    if (done) continue;
    const code = expenseCategoryToCode(e.category, e.other_details);
    postJournal(
      { journal_date: e.expense_date, reference: e.other_details || e.category, notes: `Expense — ${e.category}`, source_type: 'expense', source_id: e.id },
      [
        { code, debit: e.amount, credit: 0, description: e.other_details || e.category },
        { code: CODES.BANK, debit: 0, credit: e.amount, description: `Paid by ${e.person}` },
      ],
      { id: e.created_by || founderId });
  }

  // Sample Books contacts + items.
  if (db.prepare('SELECT COUNT(*) n FROM contacts').get().n === 0) {
    const ins = db.prepare('INSERT INTO contacts (contact_type, display_name, company_name, email, phone, billing_address, created_by) VALUES (?,?,?,?,?,?,?)');
    for (const c of CUSTOMERS) ins.run(...c, founderId);
  }
  if (db.prepare('SELECT COUNT(*) n FROM items').get().n === 0) {
    const ins = db.prepare('INSERT INTO items (name, item_type, sku, description, sell_price, cost_price, tax_percent, income_account_id, created_by) VALUES (?,?,?,?,?,?,?,?,?)');
    for (const it of ITEMS) ins.run(it[0], it[1], it[2], it[3], it[4], it[5], it[6], idByCode(it[7]), founderId);
  }

  // Sample CRM.
  if (db.prepare('SELECT COUNT(*) n FROM crm_accounts').get().n === 0) {
    const ins = db.prepare('INSERT INTO crm_accounts (name, industry, website, phone, billing_city, employees, owner, created_by) VALUES (?,?,?,?,?,?,?,?)');
    for (const a of CRM_ACCOUNTS) ins.run(...a, founderId);
  }
  if (db.prepare('SELECT COUNT(*) n FROM crm_contacts').get().n === 0) {
    const ins = db.prepare('INSERT INTO crm_contacts (first_name, last_name, account_name, title, email, phone, owner, lead_source, created_by) VALUES (?,?,?,?,?,?,?,?,?)');
    for (const c of CRM_CONTACTS) ins.run(...c, founderId);
  }
  if (db.prepare('SELECT COUNT(*) n FROM deals').get().n === 0) {
    const ins = db.prepare('INSERT INTO deals (name, account_name, contact_name, amount, stage, probability, lead_source, owner, closing_date, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)');
    const closeDate = '2026-09-30';
    for (const d of DEALS) ins.run(d[0], d[1], d[2], d[3], d[4], d[5], d[6], 'Subunu', closeDate, founderId);
  }
  if (db.prepare('SELECT COUNT(*) n FROM tasks').get().n === 0) {
    const ins = db.prepare('INSERT INTO tasks (subject, related_to, task_type, priority, status, owner, due_date, created_by) VALUES (?,?,?,?,?,?,?,?)');
    for (const t of TASKS) ins.run(t[0], t[1], t[2], t[3], 'Open', 'Subunu', '2026-09-05', founderId);
  }

  console.log('Seeded accounting: chart of accounts, opening journal, expense journals, sample Books + CRM data.');
}
