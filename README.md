# DevX OS — Internal Business Management Platform

A self-hosted web app for **DevX Technologies LLC** — Meetings, Expenses, Finance Ledger,
Invoices, Leads, Reports, and an Activity/Audit log, with secure logins for the team.

Built as a single Node.js app: **Express backend + SQLite database + a fast vanilla-JS frontend.**
No external services required — it runs with one command locally and deploys to Render in minutes.

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
│   ├── db.js               # SQLite schema
│   ├── auth.js             # login / JWT cookie / roles
│   ├── activity.js         # audit-log helper
│   ├── crud.js             # reusable CRUD routes
│   ├── routes.js           # all API endpoints
│   └── seed.js             # team + migrated Excel data
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
