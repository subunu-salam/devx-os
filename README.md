# DevX OS — Business Management Platform (Zoho Books + Zoho CRM style)

A self-hosted web app for **DevX Technologies LLC** with a full **double-entry accounting core
modelled on Zoho Books** and a **CRM modelled on Zoho CRM** — plus the original Meetings, Expenses,
Leads, Reports and Activity/Audit log. Secure logins for the team, one command to run.

Built as a single Node.js app: **Express backend + SQLite database + a fast vanilla-JS frontend.**
No external services required — it runs with one command locally and deploys to Render in minutes.

## What's inside (Zoho parity)

**Accounting — Zoho Books style (real double-entry), matching the Zoho sidebar:**
- **Chart of Accounts** — Assets, Liabilities, Equity, Income, Expenses (UAE-ready, VAT accounts).
- **Customers & Vendors**, **Items** (products/services with VAT + income accounts).
- **Sales:** Estimates/Quotes, **Sales Orders**, **Delivery Challans**, Invoices,
  **Recurring Invoices** (generate on demand), Payments Received, Credit Notes — with
  one-click **convert** (estimate/SO/challan → invoice).
- **Purchases:** Vendors, Expenses, **Purchase Orders** (→ bill), Bills, Payments Made, **Vendor Credits**.
- **Time Tracking:** Projects + Timesheet (billable/non-billable hours).
- **Banking:** cash/bank accounts with balances, deposits, withdrawals, and transfers.
- **Accountant:** Manual Journals (balanced editor), Chart of Accounts (with Inventory Asset, COGS
  sub-accounts, and Other-Expense accounts), **Bulk Update**, and **Transaction Locking** (freeze the
  books up to a date).
- **Items** support **inventory tracking** — units, opening stock, stock-on-hand, and low-stock alerts.
- **Documents:** central file store.
- **Expense Tracker** kept as-is — now also posts to the ledger automatically.
- Every document posts a balanced journal, so the books always tie out.

**Financial Reports (generated from the ledger):**
- Profit & Loss, Balance Sheet, Trial Balance, General Ledger,
  A/R Aging, A/P Aging, VAT Summary (UAE 5%). Print / PDF each one.

**CRM — Zoho CRM style:**
- **Leads** (kept, original flow) — a won lead **converts to a Customer + CRM Contact + Deal** in one click,
  **Deals** pipeline (stages, probability, weighted value),
  **Contacts**, **Accounts** (companies), **Tasks**, and the **Meeting Tracker** (kept as-is).

> ⚠️ **Data persistence on Render:** the SQLite database lives on a disk. On Render's **free** plan the
> filesystem is wiped on every restart/redeploy/sleep, so all data (including activity history) resets.
> DevX OS stores all data in a **Postgres database** (e.g. a free [Neon](https://neon.com) database).
> Because the data lives in Postgres — not on the server's disk — **nothing resets on redeploy**, even
> on Render's free plan, and no persistent disk is required. Set `DATABASE_URL` and you're done.

**Everything else:** branded dashboard, Export Center (CSV/PDF for any module), Activity audit log,
role-based access (admin / accountant / super admin), AED currency throughout.

---

## 1. Run it locally (terminal)

You need **Node.js 18+** installed ([nodejs.org](https://nodejs.org)) and a **Postgres database URL**
(a free [Neon](https://neon.com) database works great — no credit card).

```bash
# 1. unzip the project, then from inside the folder:
npm install                                   # installs dependencies
export DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"   # your Neon URL
npm start                                     # starts the server (seeds the database on first run)
```

Open **http://localhost:3000** in your browser.

The first run automatically creates all tables and loads your team + all migrated data into Postgres.
`DATABASE_URL` is required — the app tells you if it's missing.

### Login accounts (default password: `DevX@2026`)

| Name    | Role                | Email                  |
|---------|---------------------|------------------------|
| Subunu  | Founder (admin)     | subinu@devxpert.ae     |
| Suhail  | Co-Founder (admin)  | suhail@devxpert.ae     |
| Anan    | Co-Founder (admin)  | anand@devxpert.ae      |
| Ajmal   | Admin & Accountant  | accounts@devxpert.ae   |
| Ayoob   | Chairman (admin)    | ayoob@devxpert.ae      |

> Everyone should change their password after first sign-in (Settings → Change password).
> **admins** can delete records and see Activity Logs; the **accountant** role has full
> finance access and read access elsewhere.

Useful commands:
```bash
npm run reset      # wipe the database and re-seed the original data (careful!)
```

---

## 2. Deploy to Render (free plan — data persists in Postgres)

Because all data lives in **Postgres** (not on the server disk), the free plan is enough and
**no persistent disk is needed**. You just need a free Neon database.

### Step 1 — Create a free Postgres database (Neon, no card)
1. Go to **[neon.com](https://neon.com)** → **Sign up** (Google/GitHub).
2. It creates a project + database automatically. Copy the **Connection string**
   (starts with `postgresql://…?sslmode=require`).

### Step 2 — Point Render at it
1. Push this project to your **GitHub** repo (Render auto-deploys from it).
2. In the Render dashboard → your **devx-os** service → **Environment** → add:
   - `DATABASE_URL = <your Neon connection string>`
   - (`JWT_SECRET` is already generated; `NODE_ENV = production`.)
3. Render redeploys. On first boot it creates the tables and seeds your data **into Neon**,
   where it stays permanently — activity log included — across every redeploy and sleep.

Render sets `PORT` automatically. No disk, no paid plan required.

---

## 3. Project structure

```
devx-os/
├── server/                 # Express backend
│   ├── index.js            # entry point
│   ├── db.js               # Postgres connection + core schema (async data layer)
│   ├── schema.js           # Books + CRM tables (accounts, journals, bills, deals…)
│   ├── accounting.js       # double-entry engine + report queries (P&L, BS, TB, aging, VAT)
│   ├── auth.js             # login / JWT cookie / roles
│   ├── activity.js         # audit-log helper
│   ├── crud.js             # reusable CRUD routes
│   ├── routes.js           # core API endpoints (+ invoice journal posting)
│   ├── routes_ext.js       # Books + CRM API endpoints + reports
│   ├── seed.js             # team + migrated Excel data
│   └── seed_accounting.js  # chart of accounts + migrates existing data into the ledger
├── public/                 # frontend (served by Express)
│   ├── index.html
│   ├── css/styles.css
│   ├── js/                 # app shell, router, pages, charts
│   ├── assets/             # DevX logos
│   └── vendor/chart.min.js # bundled Chart.js (no CDN needed)
├── render.yaml             # one-click Render blueprint
├── package.json
└── README.md
```

## 4. Notes
- **Currency:** AED throughout.
- **Receipts/attachments** upload to `DATA_DIR/uploads` and are served behind login.
- **Migrated data:** 6 meetings, 17 expenses (with receipt links), the AED 250,000 founder
  investment in the ledger, and 27 leads — all from your original Excel files.
- To change the default seed password or data, edit `server/seed.js` before first run.

---
© DevX Technologies LLC · Dubai, UAE · Building Beyond Next
# devx-os
