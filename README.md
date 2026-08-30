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
> `render.yaml` is set to the **starter** (paid) plan with a 1 GB persistent disk at `/var/data` so your
> data survives. If you must stay on free, expect the database to reset — that is a Render limitation,
> not a bug in the app.

**Everything else:** branded dashboard, Export Center (CSV/PDF for any module), Activity audit log,
role-based access (admin / accountant / super admin), AED currency throughout.

---

## 1. Run it locally (terminal)

You need **Node.js 18+** installed ([nodejs.org](https://nodejs.org)).

```bash
# 1. unzip the project, then from inside the folder:
npm install        # installs dependencies
npm start          # starts the server (seeds the database on first run)
```

Open **http://localhost:3000** in your browser.

The first run automatically creates the database and loads your team + all migrated data.

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

## 2. Deploy to Render

Your data (SQLite database + uploaded receipts) is stored in the `DATA_DIR` folder.
On Render, attach a **persistent disk** so it survives redeploys — the included
`render.yaml` already does this for you.

### Option A — Blueprint (easiest)
1. Push this project to a **GitHub** repo.
2. In Render: **New + → Blueprint**, connect the repo. Render reads `render.yaml`,
   creates the web service, generates a `JWT_SECRET`, and attaches a 1 GB persistent disk.
3. Click **Apply**. When it finishes, open the Render URL — done.

### Option B — Manual Web Service
1. Push to GitHub, then in Render: **New + → Web Service**, connect the repo.
2. Settings:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
3. **Environment** → add variables:
   - `NODE_ENV = production`
   - `JWT_SECRET = <a long random string>`
   - `DATA_DIR = /var/data`
4. **Disks** → add a disk, mount path **`/var/data`**, size 1 GB.
5. Create the service. Render sets `PORT` automatically; the app reads it.

---

## 3. Project structure

```
devx-os/
├── server/                 # Express backend
│   ├── index.js            # entry point
│   ├── db.js               # core SQLite schema
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
