// Seeds the database with the DevX team logins and the migrated Excel data.
// Idempotent: only seeds when the users table is empty. Run `npm run reset` to wipe + reseed.
import bcrypt from 'bcryptjs';
import db, { initCoreSchema } from './db.js';
import { initExtSchema } from './schema.js';
import { seedAccounting } from './seed_accounting.js';

export async function initDb() { await initCoreSchema(); await initExtSchema(); }

const DEFAULT_PASSWORD = 'DevX@2026';

const USERS = [
  { full_name: 'Subunu', email: 'subinu@devxpert.ae',  title: 'Founder',            role: 'admin',      is_super: 1 },
  { full_name: 'Suhail', email: 'suhail@devxpert.ae',  title: 'Co-Founder',         role: 'admin',      is_super: 0 },
  { full_name: 'Anan',   email: 'anand@devxpert.ae',   title: 'Co-Founder',         role: 'admin',      is_super: 0 },
  { full_name: 'Ajmal',  email: 'accounts@devxpert.ae', title: 'Admin & Accountant', role: 'accountant', is_super: 0 },
  { full_name: 'Ayoob',  email: 'ayoob@devxpert.ae',   title: 'Chairman',           role: 'admin',      is_super: 0 },
];

const D = (id) => `https://drive.google.com/open?id=${id}`;

const MEETINGS = [
  ['2026-06-05', null, 'Multy Hands', 'Visa and Typing', 'Sales/Demo', 'In-Person', 'Suhail', 'Completed', 'Satisfied and currently not planning to invest, but soon they will need a CRM. Got a referral client: Rebel Foods.'],
  ['2026-06-08', null, 'Rebel Foods', 'Cloud kitchen', 'Sales/Demo', 'In-Person', 'Subunu', 'Completed', 'They need a CRM for their team.'],
  ['2026-06-14', null, 'Cee Port', 'Trading', 'Sales/Demo', 'In-Person', 'Suhail', 'Completed', 'Created an AI forecast tool for them and researching on it.'],
  ['2026-06-24', '16:00', 'Prince Paul', 'Construction', 'Sales/Demo', 'In-Person', null, 'Completed', 'Interested and they will let us know their requirement.'],
  ['2026-06-25', '15:00', 'Haseeb (Al Madheena Market)', 'Super market', 'Sales/Demo', 'In-Person', null, 'Completed', 'Interested and asked for the website quote; they need WhatsApp integration.'],
  ['2026-06-29', null, 'Al Madeena / Lloyd Design', null, 'Sales/Demo', 'In-Person', null, 'Pending', 'Imported from tracker — meeting noted, details to be confirmed.'],
];

// [date, person, category, other_details, amount, description, receipt_url, month]
const EXPENSES = [
  ['2026-06-17', 'Anan', 'Other Expense', 'T-SHIRT', 357.00, null, D('1WW7pRZmgcG7JOCVYmugDEMyXZeMCMz2H'), 'Jun'],
  ['2026-08-06', 'Anan', 'Office Expense', 'DOMAIN', 135.45, null, D('1a5OUa2z0dlFn2YU7W36rlAmP0RdTEHtR'), 'Aug'],
  ['2026-06-19', 'Anan', 'Office Expense', 'DOMAIN', 63.34, null, D('1FAsWiYb-HMYjVcjsf2wOaDoeJbXrFOfH'), 'Jun'],
  ['2026-06-22', 'Anan', 'Office Expense', 'Email-Microsoft', 113.40, null, D('17B1GsMI3PaoIRxGvqmo51N9kVG4xLcLp'), 'Jun'],
  ['2026-07-01', 'Anan', 'Office Expense', 'Salary Paid [June-26]', 17500.00, 'Anan & Subunu', null, 'Jul'],
  ['2026-07-01', 'Anan', 'Office Expense', 'Ejari and DLD Approval', 4500.00, null, D('13C5gGaTw7oMj1vVFyBWu1mHyVKn2VSZX'), 'Jul'],
  ['2026-07-02', 'Anan', 'Office Expense', 'DED Payment Voucher', 16820.00, null, null, 'Jul'],
  ['2026-07-12', 'Anan', 'Office Expense', 'Immigration and Labour Card', 1340.00, null, D('1gYTYRCRRPpToAMdoGD8INdPy9crtO3rg'), 'Jul'],
  ['2026-08-04', 'Anan', 'Office Expense', 'Email For Employee -1 Year', 365.40, null, D('1PpQmvPobrBO-yhfMc4ON3O2rKjoSgIWS'), 'Aug'],
  ['2026-08-04', 'Anan', 'Office Expense', 'Email Upgrade -1 Year', 222.59, null, D('1yMKC1s4S_fk9ER_vGv56eK9JJJIQ4M7S'), 'Aug'],
  ['2026-06-24', 'Suhail', 'Office Expense', 'Business card charge', 160.00, null, D('1Ij0ek1T5sdBHpXzpUmCFFTsI2-NMs_r-'), 'Jun'],
  ['2026-06-17', 'Suhail', 'Office Expense', 'Uniform logo charge', 60.00, null, D('1phxk5ywwHq_p7YCZqiDzt1SoNbygyqCZ'), 'Jun'],
  ['2026-07-13', 'Anan', 'Office Expense', 'License Service Charge, Trade Name and Initial Approval', 2424.00, null, D('1Aol8jz0bZ9kugpzvDmyAyXEuKbh0SL8d'), 'Jul'],
  ['2026-08-10', 'Anan', 'Office Expense', 'Visa Expense', 5590.00, null, D('1z4gbeWPqkP4h0-EHmBjJBeMIYdbzskw5'), 'Aug'],
  ['2026-08-01', 'Anan', 'Office Expense', 'Salary Paid [July]', 15000.00, 'Subinu', null, 'Aug'],
  ['2026-08-01', 'Anan', 'Office Expense', 'New Employee gift', 200.00, 'Subinu', null, 'Aug'],
  ['2026-08-20', 'Suhail', 'Office Expense', 'Aqueous domain purchase', 135.45, null, D('1eimDR_vj5OguTa8z3JbjETkfo_Zyoyz9'), 'Aug'],
];

const LEDGER = [
  ['2026-07-01', 'credit', 'Investment', 'Founder investment into DevX Technologies (5 cheques of AED 50,000)', 250000.00, 'Founders', 'cheque', '5 x AED 50,000', null],
];

// [name, business_category, status, source, notes, next_action, next_action_date]
const LEADS = [
  ['Madheena Market (Haris)', 'Supermarket', 'Lost', 'Imported from tracker', null, null, null],
  ['Nisar Travels', 'Travel', 'Interested', 'Imported from tracker', null, null, null],
  ['Faisal', null, 'Lost', 'Imported from tracker', null, null, null],
  ['Ismayil (Supermarket)', 'Supermarket', 'Lost', 'Imported from tracker', null, null, null],
  ['Shahin Sha', 'Naattil', 'Follow-up', 'Imported from tracker', null, null, null],
  ['Advance Care (Musthafa)', 'Healthcare', 'Lost', 'Imported from tracker', null, null, null],
  ['Multi Hand', 'Visa and Typing', 'Interested', 'Imported from tracker', 'Referred Rebel Foods', null, null],
  ['Rebel Foods', 'Cloud Kitchen', 'Interested', 'Imported from tracker', 'Needs a CRM for their team', null, null],
  ['Ismayil (Dmart)', 'Retail', 'Lost', 'Imported from tracker', null, null, null],
  ['Nabeel and Firoze', null, 'Interested', 'Imported from tracker', null, null, null],
  ['Hilaal (Pakistani)', null, 'Lost', 'Imported from tracker', null, null, null],
  ['Mansoor (Epza)', null, 'Follow-up', 'Imported from tracker', null, null, null],
  ['Thambi', 'Water', 'Follow-up', 'Imported from tracker', null, null, null],
  ['Malabar (Epza)', null, 'Follow-up', 'Imported from tracker', null, null, null],
  ['Favas Lalu', 'Logistics', 'Follow-up', 'Imported from tracker', null, null, null],
  ['Saudi (Salim)', null, 'Follow-up', 'Imported from tracker', null, null, null],
  ['Prince', 'Construction', 'Interested', 'Imported from tracker', 'Met 24 Jun; will share requirement', null, null],
  ['Amsetergi FZ', null, 'Lost', 'Imported from tracker', null, null, null],
  ['Ramy Automotive', 'Automotive', 'Lost', 'Imported from tracker', null, null, null],
  ['Al Madina (Saqer)', 'Supermarket', 'Follow-up', 'Imported from tracker', null, null, null],
  ['Tech-Orbit', 'Technology', 'Follow-up', 'Imported from tracker', null, null, null],
  ['Salkara and Paragon', null, 'Follow-up', 'Imported from tracker', null, null, null],
  ['Haseeb Usthad', null, 'Follow-up', 'Imported from tracker', null, null, null],
  ['Muhsin (Echova)', null, 'Follow-up', 'Imported from tracker', null, null, null],
  ['Safar Al Bahar (Waleed)', null, 'Follow-up', 'Imported from tracker', null, null, null],
  ['Saju', 'Pharmacy', 'Follow-up', 'Reminder (via Suhail)', 'Reminder: call Saju', 'Call Saju', null],
  ['Shain Sha', 'Hospital', 'Follow-up', 'Reminder', 'Remind in 2 weeks', 'Follow up in 2 weeks', null],
];

export async function seedAll() {
  const hash = bcrypt.hashSync(DEFAULT_PASSWORD, 10);
  const insUser = db.prepare('INSERT INTO users (full_name, email, title, role, is_super, password_hash) VALUES (?,?,?,?,?,?)');
  const idByName = {};
  for (const u of USERS) {
    const info = await insUser.run(u.full_name, u.email, u.title, u.role, u.is_super || 0, hash);
    idByName[u.full_name] = info.lastInsertRowid;
  }
  const founder = idByName['Subunu'];
  const personToId = (p) => idByName[p] ?? founder;

  const insMeeting = db.prepare(`INSERT INTO meetings
    (meeting_date, meeting_time, client_name, business_category, meeting_type, meeting_mode, confirmed_by, status, remarks, created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);
  for (const m of MEETINGS) await insMeeting.run(...m, m[6] ? personToId(m[6]) : founder);

  const insExpense = db.prepare(`INSERT INTO expenses
    (expense_date, person, category, other_details, amount, description, receipt_url, month, created_by)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  for (const e of EXPENSES) await insExpense.run(...e, personToId(e[1]));

  const insLedger = db.prepare(`INSERT INTO ledger_entries
    (entry_date, type, category, description, amount, party, method, reference, attachment_url, created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);
  for (const l of LEDGER) await insLedger.run(...l, founder);

  const insLead = db.prepare(`INSERT INTO leads
    (name, business_category, status, source, notes, next_action, next_action_date, created_by)
    VALUES (?,?,?,?,?,?,?,?)`);
  for (const ld of LEADS) await insLead.run(...ld, founder);

  console.log(`Seeded: ${USERS.length} users, ${MEETINGS.length} meetings, ${EXPENSES.length} expenses, ${LEDGER.length} ledger entries, ${LEADS.length} leads.`);
  await seedAccounting(founder);

  const insAct = db.prepare(`INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, description, created_at) VALUES (?,?,?,?,?,?,?)`);
  const HISTORY = [
    ['create', 'system', null, 'Migrated 6 meetings from the Excel tracker', '2026-07-01 09:05:00'],
    ['create', 'expense', null, 'Migrated 17 expenses with receipts from the Excel sheet', '2026-07-01 09:06:00'],
    ['create', 'ledger', null, 'Recorded founder investment AED 250,000 (opening journal)', '2026-07-01 09:07:00'],
    ['create', 'lead', null, 'Migrated 27 leads from the outreach tracker', '2026-07-01 09:08:00'],
    ['create', 'account', null, 'Set up the chart of accounts (Zoho Books structure)', '2026-07-01 09:10:00'],
  ];
  for (const hh of HISTORY) await insAct.run(founder, 'Subunu', hh[0], hh[1], hh[2], hh[3], hh[4]);
}

export async function ensureSeed() {
  await initDb();
  const n = (await db.prepare('SELECT COUNT(*) n FROM users').get()).n;
  if (n === 0) {
    console.log('Empty database — seeding initial data...');
    await seedAll();
  } else {
    const founder = (await db.prepare("SELECT id FROM users WHERE lower(email)='subinu@devxpert.ae'").get())?.id
      || (await db.prepare('SELECT id FROM users ORDER BY id LIMIT 1').get())?.id;
    try { await seedAccounting(founder); } catch (e) { console.error('accounting backfill failed:', e.message); }
  }
}

// CLI: `node server/seed.js` seeds if empty; `--reset` wipes everything first.
const isMain = process.argv[1] && process.argv[1].endsWith('seed.js');
if (isMain) {
  (async () => {
    await initDb();
    if (process.argv.includes('--reset')) {
      for (const t of ['activity_logs', 'journal_lines', 'journals', 'accounts', 'invoice_items', 'invoices',
                       'estimate_items', 'estimates', 'bill_items', 'bills', 'payments',
                       'credit_note_items', 'credit_notes', 'sales_order_items', 'sales_orders',
                       'purchase_order_items', 'purchase_orders', 'vendor_credit_items', 'vendor_credits',
                       'recurring_invoice_items', 'recurring_invoices', 'delivery_challan_items', 'delivery_challans',
                       'documents', 'time_entries', 'projects', 'items', 'contacts', 'settings',
                       'crm_accounts', 'crm_contacts', 'deals', 'tasks',
                       'leads', 'ledger_entries', 'expenses', 'meetings', 'users']) {
        try { await db.prepare(`TRUNCATE ${t} RESTART IDENTITY CASCADE`).run(); } catch (e) { /* table may not exist */ }
      }
      console.log('Database wiped.');
      await seedAll();
    } else {
      await ensureSeed();
    }
    console.log('Done.');
    process.exit(0);
  })().catch((e) => { console.error(e); process.exit(1); });
}
