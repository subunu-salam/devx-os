// DevX OS — SPA bootstrap: auth gate, app shell, hash router.
import { api, get, post, icon, escapeHtml, toast } from './api.js';

import dashboard from './pages/dashboard.js';
import meetings from './pages/meetings.js';
import expenses from './pages/expenses.js';
import invoices from './pages/invoices.js';
import leads from './pages/leads.js';
import company from './pages/company.js';
import reports from './pages/reports.js';
import activity from './pages/activity.js';
import settings from './pages/settings.js';
// Zoho Books modules
import coa from './pages/accounts.js';
import customers from './pages/customers.js';
import vendors from './pages/vendors.js';
import items from './pages/items.js';
import estimates from './pages/estimates.js';
import salesorders from './pages/sales_orders.js';
import deliverychallans from './pages/delivery_challans.js';
import recurringinvoices from './pages/recurring_invoices.js';
import paymentsin from './pages/payments_received.js';
import paymentsout from './pages/payments_made.js';
import purchaseorders from './pages/purchase_orders.js';
import bills from './pages/bills.js';
import vendorcredits from './pages/vendor_credits.js';
import creditnotes from './pages/credit_notes.js';
import journals from './pages/journals.js';
import banking from './pages/banking.js';
import transactionlocking from './pages/transaction_locking.js';
import bulkupdate from './pages/bulk_update.js';
import financials from './pages/financials.js';
import documents from './pages/documents.js';
import projects from './pages/projects.js';
import timesheet from './pages/timesheet.js';
// Zoho CRM modules
import deals from './pages/deals.js';
import crmcontacts from './pages/crm_contacts.js';
import crmaccounts from './pages/crm_accounts.js';
import tasks from './pages/tasks.js';

const PAGES = {
  dashboard, leads, deals, crmcontacts, crmaccounts, meetings, tasks,
  customers, items, estimates, salesorders, deliverychallans, invoices, recurringinvoices, paymentsin, creditnotes,
  vendors, expenses, purchaseorders, bills, paymentsout, vendorcredits,
  projects, timesheet, banking, coa, journals, transactionlocking, bulkupdate, financials, reports, documents,
  company, activity, settings,
};

const NAV = [
  { group: 'Overview' },
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { group: 'CRM' },
  { key: 'leads', label: 'Leads', icon: 'leads' },
  { key: 'deals', label: 'Deals', icon: 'target' },
  { key: 'crmcontacts', label: 'Contacts', icon: 'users' },
  { key: 'crmaccounts', label: 'Accounts', icon: 'building' },
  { key: 'meetings', label: 'Meetings', icon: 'calendar' },
  { key: 'tasks', label: 'Tasks', icon: 'check2' },
  { group: 'Sales' },
  { key: 'customers', label: 'Customers', icon: 'users' },
  { key: 'items', label: 'Items', icon: 'layers' },
  { key: 'estimates', label: 'Estimates / Quotes', icon: 'file' },
  { key: 'salesorders', label: 'Sales Orders', icon: 'file' },
  { key: 'deliverychallans', label: 'Delivery Challans', icon: 'inbox' },
  { key: 'invoices', label: 'Invoices', icon: 'invoice' },
  { key: 'recurringinvoices', label: 'Recurring Invoices', icon: 'clock' },
  { key: 'paymentsin', label: 'Payments Received', icon: 'wallet' },
  { key: 'creditnotes', label: 'Credit Notes', icon: 'receipt' },
  { group: 'Purchases' },
  { key: 'vendors', label: 'Vendors', icon: 'users' },
  { key: 'expenses', label: 'Expenses', icon: 'receipt' },
  { key: 'purchaseorders', label: 'Purchase Orders', icon: 'file' },
  { key: 'bills', label: 'Bills', icon: 'invoice' },
  { key: 'paymentsout', label: 'Payments Made', icon: 'wallet' },
  { key: 'vendorcredits', label: 'Vendor Credits', icon: 'receipt' },
  { group: 'Time Tracking' },
  { key: 'projects', label: 'Projects', icon: 'layers' },
  { key: 'timesheet', label: 'Timesheet', icon: 'clock' },
  { group: 'Accounting' },
  { key: 'banking', label: 'Banking', icon: 'wallet' },
  { key: 'coa', label: 'Chart of Accounts', icon: 'ledger' },
  { key: 'journals', label: 'Manual Journals', icon: 'ledger' },
  { key: 'bulkupdate', label: 'Bulk Update', icon: 'layers', adminOnly: true },
  { key: 'transactionlocking', label: 'Transaction Locking', icon: 'lock', adminOnly: true },
  { group: 'Reports' },
  { key: 'financials', label: 'Financial Reports', icon: 'report' },
  { key: 'reports', label: 'Export Center', icon: 'download' },
  { group: 'Company' },
  { key: 'documents', label: 'Documents', icon: 'file' },
  { key: 'company', label: 'Company', icon: 'building' },
  { group: 'Admin' },
  { key: 'activity', label: 'Activity Logs', icon: 'activity', adminOnly: true },
  { key: 'settings', label: 'Settings', icon: 'settings' },
];

let currentUser = null;
const appEl = () => document.getElementById('app');

window.addEventListener('unauthorized', () => { currentUser = null; renderLogin(); });

/* ---------------- Theme ---------------- */
function initTheme() {
  let t; try { t = localStorage.getItem('devx-theme'); } catch {}
  if (!t) t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t);
}
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('devx-theme', t); } catch {}
  document.querySelectorAll('[data-theme-set]').forEach((b) => b.classList.toggle('active', b.dataset.themeSet === t));
}
function currentTheme() { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
function roleLabel(u) {
  if (u.is_super) return `${u.title || 'Admin'} · Super Admin`;
  return u.title || u.role;
}
initTheme();

init();

async function init() {
  try {
    const { user } = await get('/api/auth/me');
    currentUser = user;
    renderShell();
    route();
  } catch {
    renderLogin();
  }
}

/* ---------------- Login ---------------- */
function renderLogin() {
  document.body.classList.remove('shell');
  appEl().innerHTML = `
    <div class="login-wrap">
      <div class="login-glow a"></div><div class="login-glow b"></div>
      <div class="login-card">
        <img class="logo" src="/assets/devx-logo-full.png" alt="DevX Technologies" />
        <h1>DevX OS</h1>
        <p class="sub">Internal business management platform</p>
        <form id="loginForm" style="margin-top:26px">
          <div class="field"><label>Work email</label>
            <input class="input" type="email" id="email" placeholder="you@devxpert.ae" autocomplete="email" required></div>
          <div class="field"><label>Password</label>
            <input class="input" type="password" id="password" placeholder="••••••••" autocomplete="current-password" required></div>
          <button class="btn btn-primary" style="width:100%;height:44px" type="submit" id="loginBtn">Sign in</button>
        </form>
        <p class="login-note">${icon('lock')} Invite-only access for the DevX Technologies team</p>
      </div>
    </div>`;
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    btn.disabled = true; btn.textContent = 'Signing in…';
    try {
      const { user } = await post('/api/auth/login', {
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
      });
      currentUser = user;
      toast(`Welcome back, ${user.full_name}`, 'ok');
      renderShell();
      location.hash = '#/dashboard';
      route();
    } catch (err) {
      toast(err.message, 'err');
      btn.disabled = false; btn.textContent = 'Sign in';
    }
  });
}

/* ---------------- Shell ---------------- */
function renderShell() {
  document.body.classList.add('shell');
  const initials = (currentUser.full_name || 'U').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const navHtml = NAV.map((n) => {
    if (n.group) return `<div class="nav-group">${n.group}</div>`;
    if (n.adminOnly && currentUser.role !== 'admin') return '';
    return `<a href="#/${n.key}" data-nav="${n.key}">${icon(n.icon)}<span>${n.label}</span></a>`;
  }).join('');

  appEl().innerHTML = `
    <div class="shell">
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-brand">
          <img src="/assets/devx-mark-green.png" alt="DevX" />
          <div><div class="t">DevX OS</div><div class="s">Technologies</div></div>
        </div>
        <nav class="nav">${navHtml}</nav>
        <div class="sidebar-foot">
          <div class="sidebar-theme">
            <div class="theme-toggle" id="themeToggle">
              <button data-theme-set="light">${icon('sun')} Light</button>
              <button data-theme-set="dark">${icon('moon')} Dark</button>
            </div>
          </div>
          <div class="sidebar-user">
            <div class="avatar">${initials}</div>
            <div style="flex:1;min-width:0"><div class="nm">${escapeHtml(currentUser.full_name)}</div>
              <div class="rl">${escapeHtml(roleLabel(currentUser))}</div></div>
            <button class="btn btn-ghost btn-icon" id="logoutBtn" title="Sign out" style="color:rgba(255,255,255,.6)">${icon('logout')}</button>
          </div>
        </div>
      </aside>
      <div class="main">
        <div class="topbar">
          <button class="btn btn-ghost btn-icon" id="menuBtn">${icon('menu')}</button>
          <img src="/assets/devx-mark-green.png" alt="DevX" /><span class="t">DevX OS</span>
        </div>
        <div class="content" id="view"><div class="spinner"></div></div>
      </div>
    </div>`;

  document.getElementById('logoutBtn').onclick = async () => {
    try { await post('/api/auth/logout'); } catch {}
    currentUser = null; location.hash = ''; renderLogin();
  };
  const sidebar = document.getElementById('sidebar');
  const openMenu = () => { sidebar.classList.add('open'); addBackdrop(); };
  const closeMenu = () => { sidebar.classList.remove('open'); removeBackdrop(); };
  document.getElementById('menuBtn').onclick = openMenu;
  sidebar.addEventListener('click', (e) => { if (e.target.closest('[data-nav]')) closeMenu(); });
  window._closeMenu = closeMenu;

  document.querySelectorAll('#themeToggle [data-theme-set]').forEach((b) => {
    b.onclick = () => { applyTheme(b.dataset.themeSet); route(); };
  });
  applyTheme(currentTheme()); // sync active state
}
function addBackdrop() {
  if (document.querySelector('.backdrop')) return;
  const b = document.createElement('div'); b.className = 'backdrop';
  b.onclick = () => window._closeMenu?.(); document.querySelector('.main').appendChild(b);
}
function removeBackdrop() { document.querySelector('.backdrop')?.remove(); }

/* ---------------- Router ---------------- */
window.addEventListener('hashchange', route);
async function route() {
  if (!currentUser) return;
  let key = (location.hash.replace(/^#\//, '') || 'dashboard').split('/')[0];
  if (!PAGES[key]) key = 'dashboard';
  if (key === 'activity' && currentUser.role !== 'admin') key = 'dashboard';
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === key));
  const view = document.getElementById('view');
  if (!view) return;
  view.innerHTML = '<div class="spinner"></div>';
  try {
    await PAGES[key](view, { user: currentUser, navigate: (k) => { location.hash = '#/' + k; } });
  } catch (err) {
    if (err.message !== 'Not authenticated') {
      view.innerHTML = `<div class="empty">${icon('x')}<p>Could not load this page.</p><p class="muted">${escapeHtml(err.message)}</p></div>`;
    }
  }
}
