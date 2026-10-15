// DevX OS — SPA bootstrap: auth gate, app shell, hash router.
import { api, get, post, icon, escapeHtml, toast } from './api.js';
import { animateView } from './motion.js';

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
  if (!t) t = 'dark'; // glass theme is designed dark-first
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
  const bars = [38, 52, 44, 66, 58, 74, 62, 88, 70, 96, 80, 64];
  appEl().innerHTML = `
    <div class="login-wrap">
      <section class="login-art">
        <div class="eyebrow">DevX Technologies — Business OS</div>
        <div>
          <h2>Run the whole <em>business</em> from one place.</h2>
          <div class="login-bars" style="margin-top:40px">
            ${bars.map((h, i) => `<span class="${i === 9 ? 'hot' : ''}" style="height:${h}%;animation-delay:${i * 60}ms"></span>`).join('')}
          </div>
        </div>
        <div class="login-meta">
          <div><b>CRM</b>Leads · Deals</div>
          <div><b>Books</b>Sales · Purchases</div>
          <div><b>Reports</b>P&amp;L · VAT</div>
        </div>
      </section>
      <section class="login-side">
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
            <button class="btn btn-primary" style="width:100%;height:46px" type="submit" id="loginBtn">Sign in</button>
          </form>
          <p class="login-note">${icon('lock')} Invite-only access for the DevX Technologies team</p>
        </div>
      </section>
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
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

function buildNav(filter = '') {
  const q = filter.trim().toLowerCase();
  const collapsedGroups = lsGet('devx-nav-groups', {});
  const groups = [];
  NAV.forEach((n) => {
    if (n.group) groups.push({ name: n.group, items: [] });
    else if (!(n.adminOnly && currentUser.role !== 'admin')) groups[groups.length - 1].items.push(n);
  });
  const mark = (label) => {
    if (!q) return escapeHtml(label);
    const i = label.toLowerCase().indexOf(q);
    if (i < 0) return escapeHtml(label);
    return escapeHtml(label.slice(0, i)) + '<mark>' + escapeHtml(label.slice(i, i + q.length)) + '</mark>' + escapeHtml(label.slice(i + q.length));
  };
  let html = '', count = 0;
  groups.forEach((g) => {
    const items = q ? g.items.filter((n) => n.label.toLowerCase().includes(q) || g.name.toLowerCase().includes(q)) : g.items;
    if (!items.length) return;
    count += items.length;
    const collapsed = !q && collapsedGroups[g.name];
    html += `<button class="nav-group${collapsed ? ' collapsed' : ''}" data-group="${g.name}" type="button">${g.name}${icon('chevron')}</button>
      <div class="nav-items"><div>${items.map((n) =>
        `<a href="#/${n.key}" data-nav="${n.key}" data-label="${escapeHtml(n.label)}">${icon(n.icon)}<span class="nav-lbl">${mark(n.label)}</span></a>`).join('')}</div></div>`;
  });
  if (!count) html = `<div class="nav-empty">No modules match “${escapeHtml(filter)}”</div>`;
  return '<div class="nav-indicator" id="navInd"></div>' + html;
}

function moveIndicator() {
  const ind = document.getElementById('navInd');
  const nav = document.getElementById('nav');
  const a = nav?.querySelector('a.active');
  if (!ind || !a) { if (ind) ind.style.opacity = 0; return; }
  // hidden inside a collapsed group?
  const wrap = a.closest('.nav-items');
  const hidden = wrap && wrap.previousElementSibling?.classList.contains('collapsed') && !document.documentElement.classList.contains('sb-collapsed');
  if (hidden) { ind.style.opacity = 0; return; }
  ind.style.opacity = 1;
  ind.style.transform = `translateY(${a.offsetTop + (a.offsetParent === nav ? 0 : a.offsetParent.offsetTop)}px)`;
}

function renderShell() {
  document.body.classList.add('shell');
  document.documentElement.classList.toggle('sb-collapsed', !!lsGet('devx-sb-collapsed', false));
  const initials = (currentUser.full_name || 'U').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  appEl().innerHTML = `
    <div class="shell">
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-brand">
          <img src="/assets/devx-mark-green.png" alt="DevX" />
          <div><div class="t">DevX OS</div><div class="s">Technologies</div></div>
          <button class="sb-collapse" id="sbCollapse" title="Collapse sidebar" type="button">${icon('chevronLeft')}</button>
        </div>
        <div class="sb-search">${icon('search')}<input id="navSearch" placeholder="Jump to module…" autocomplete="off"><kbd>/</kbd></div>
        <nav class="nav" id="nav">${buildNav()}</nav>
        <div class="sidebar-foot">
          <div class="sidebar-theme">
            <div class="theme-toggle" id="themeToggle">
              <button data-theme-set="light" title="Light">${icon('sun')}<span>Light</span></button>
              <button data-theme-set="dark" title="Dark">${icon('moon')}<span>Dark</span></button>
            </div>
          </div>
          <div class="sidebar-user">
            <div class="avatar">${initials}</div>
            <div style="flex:1;min-width:0"><div class="nm">${escapeHtml(currentUser.full_name)}</div>
              <div class="rl">${escapeHtml(roleLabel(currentUser))}</div></div>
            <button class="btn btn-ghost btn-icon" id="logoutBtn" title="Sign out">${icon('logout')}</button>
          </div>
        </div>
      </aside>
      <div class="main">
        <div class="topbar">
          <button class="btn btn-ghost btn-icon" id="menuBtn">${icon('menu')}</button>
          <img src="/assets/devx-mark-green.png" alt="DevX" /><span class="t">DevX OS</span>
          <div class="crumbs" id="crumbs"></div>
          <div class="top-actions">
            <span class="top-pill" title="Connected"><span class="live"></span><span class="tp-lbl">Live</span></span>
            <span class="top-pill tp-date"><span class="tp-lbl">${new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span>${icon('calendar')}</span>
            <button class="top-pill" id="topTheme" title="Toggle theme" type="button">${icon(currentTheme() === 'dark' ? 'sun' : 'moon')}</button>
          </div>
        </div>
        <div class="content" id="view"><div class="spinner"></div></div>
      </div>
    </div>`;

  document.getElementById('logoutBtn').onclick = async () => {
    try { await post('/api/auth/logout'); } catch {}
    currentUser = null; location.hash = ''; renderLogin();
  };
  const sidebar = document.getElementById('sidebar');
  const nav = document.getElementById('nav');
  const openMenu = () => { sidebar.classList.add('open'); addBackdrop(); };
  const closeMenu = () => { sidebar.classList.remove('open'); removeBackdrop(); };
  document.getElementById('menuBtn').onclick = openMenu;
  sidebar.addEventListener('click', (e) => { if (e.target.closest('[data-nav]')) closeMenu(); });
  window._closeMenu = closeMenu;

  // Collapsible groups
  nav.addEventListener('click', (e) => {
    const g = e.target.closest('[data-group]');
    if (!g) return;
    g.classList.toggle('collapsed');
    const state = lsGet('devx-nav-groups', {});
    state[g.dataset.group] = g.classList.contains('collapsed');
    lsSet('devx-nav-groups', state);
    moveIndicator(); setTimeout(moveIndicator, 380);
  });

  // Rail collapse
  document.getElementById('sbCollapse').onclick = () => {
    const c = !document.documentElement.classList.contains('sb-collapsed');
    document.documentElement.classList.toggle('sb-collapsed', c);
    lsSet('devx-sb-collapsed', c);
    setTimeout(() => { moveIndicator(); window.dispatchEvent(new Event('resize')); }, 380);
  };

  // Tooltips in rail mode
  const tip = document.createElement('div'); tip.className = 'nav-tip'; document.body.appendChild(tip);
  nav.addEventListener('mouseover', (e) => {
    const a = e.target.closest('a[data-nav]');
    if (!a || !document.documentElement.classList.contains('sb-collapsed')) return;
    const r = a.getBoundingClientRect();
    tip.textContent = a.dataset.label; tip.style.left = (r.right + 12) + 'px'; tip.style.top = (r.top + r.height / 2 - 14) + 'px';
    tip.classList.add('show');
  });
  nav.addEventListener('mouseout', () => tip.classList.remove('show'));
  nav.addEventListener('scroll', () => tip.classList.remove('show'));

  // Module search (+ keyboard: "/" focus, Enter opens first match, Esc clears)
  const search = document.getElementById('navSearch');
  search.addEventListener('input', () => { nav.innerHTML = buildNav(search.value); syncActive(); });
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const a = nav.querySelector('a[data-nav]'); if (a) { location.hash = a.getAttribute('href'); search.value = ''; nav.innerHTML = buildNav(); syncActive(); search.blur(); closeMenu(); } }
    if (e.key === 'Escape') { search.value = ''; nav.innerHTML = buildNav(); syncActive(); search.blur(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) {
      e.preventDefault();
      if (document.documentElement.classList.contains('sb-collapsed')) document.getElementById('sbCollapse').click();
      if (window.innerWidth <= 1024) openMenu();
      search.focus();
    }
  });

  const setTheme = (t) => {
    applyTheme(t);
    document.getElementById('topTheme').innerHTML = icon(t === 'dark' ? 'sun' : 'moon');
    route();
  };
  document.querySelectorAll('#themeToggle [data-theme-set]').forEach((b) => { b.onclick = () => setTheme(b.dataset.themeSet); });
  document.getElementById('topTheme').onclick = () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  applyTheme(currentTheme()); // sync active state
  window.addEventListener('resize', moveIndicator);
}
function addBackdrop() {
  if (document.querySelector('.backdrop')) return;
  const b = document.createElement('div'); b.className = 'backdrop';
  b.onclick = () => window._closeMenu?.(); document.querySelector('.main').appendChild(b);
}
function removeBackdrop() { document.querySelector('.backdrop')?.remove(); }

let activeKey = 'dashboard';
function syncActive() {
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === activeKey));
  requestAnimationFrame(moveIndicator);
}
function setCrumbs(key) {
  const el = document.getElementById('crumbs');
  if (!el) return;
  let group = '';
  for (const n of NAV) { if (n.group) group = n.group; else if (n.key === key) { el.innerHTML = `<span>DevX OS</span><i></i><span>${group}</span><i></i><b>${escapeHtml(n.label)}</b>`; return; } }
}

/* ---------------- Router ---------------- */
window.addEventListener('hashchange', route);
async function route() {
  if (!currentUser) return;
  let key = (location.hash.replace(/^#\//, '') || 'dashboard').split('/')[0];
  if (!PAGES[key]) key = 'dashboard';
  if (key === 'activity' && currentUser.role !== 'admin') key = 'dashboard';
  activeKey = key;
  syncActive();
  setCrumbs(key);
  // make sure the active module's group is expanded
  const a = document.querySelector(`#nav a[data-nav="${key}"]`);
  const g = a?.closest('.nav-items')?.previousElementSibling;
  if (g?.classList.contains('collapsed')) { g.classList.remove('collapsed'); setTimeout(moveIndicator, 380); }
  const view = document.getElementById('view');
  if (!view) return;
  view.classList.remove('view-enter');
  view.innerHTML = '<div class="spinner"></div>';
  try {
    await PAGES[key](view, { user: currentUser, navigate: (k) => { location.hash = '#/' + k; } });
    void view.offsetWidth; view.classList.add('view-enter');
    animateView(view);
  } catch (err) {
    if (err.message !== 'Not authenticated') {
      view.innerHTML = `<div class="empty">${icon('x')}<p>Could not load this page.</p><p class="muted">${escapeHtml(err.message)}</p></div>`;
    }
  }
}
