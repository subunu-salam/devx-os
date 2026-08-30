import { get, post, icon, fmtAED, fmtDate, escapeHtml, toast, openModal, optionList } from '../api.js';
import { pageHead, kpiRow } from '../ui.js';

export default async function banking(view, ctx) {
  let accounts = await get('/api/banking/accounts');
  let allAccounts = await get('/api/accounts').catch(() => []);
  let txns = await get('/api/banking/transactions').catch(() => []);

  const total = accounts.reduce((s, a) => s + Number(a.balance || 0), 0);

  view.innerHTML = pageHead({
    title: 'Banking', desc: 'Bank and cash accounts — record deposits, withdrawals, and transfers.',
    actions: `<button class="btn btn-outline" id="txBtn">${icon('plus')} Money In / Out</button>
              <button class="btn btn-primary" id="trBtn">${icon('trending')} Transfer</button>`,
  }) + kpiRow([
    { label: 'Total cash & bank', value: fmtAED(total), icon: 'wallet', tone: 'green' },
    { label: 'Accounts', value: accounts.length, icon: 'ledger' },
    { label: 'Transactions', value: txns.length, icon: 'receipt' },
  ]) + `
    <div class="grid cols-2 mb16" id="acctCards"></div>
    <div class="card"><div class="card-head"><h3>Recent bank transactions</h3></div>
      <div class="table-wrap" style="border:none;box-shadow:none" id="txTable"></div></div>`;

  renderAccounts();
  renderTxns();
  view.querySelector('#txBtn').onclick = () => moneyForm();
  view.querySelector('#trBtn').onclick = () => transferForm();

  function renderAccounts() {
    view.querySelector('#acctCards').innerHTML = accounts.map((a) => `
      <div class="card"><div class="card-pad">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div><div class="muted" style="font-size:12px">${escapeHtml(a.account_subtype === 'bank' ? 'Bank' : 'Cash')} · ${escapeHtml(a.code)}</div>
            <strong style="font-size:16px">${escapeHtml(a.name)}</strong></div>
          <div class="ic">${icon(a.account_subtype === 'bank' ? 'building' : 'wallet')}</div>
        </div>
        <div style="font-size:24px;font-weight:800;margin-top:10px" class="${a.balance >= 0 ? 'pos' : 'neg'}">${fmtAED(a.balance)}</div>
      </div></div>`).join('') || `<div class="muted">No bank or cash accounts. Add one in Chart of Accounts.</div>`;
  }

  function renderTxns() {
    const el = view.querySelector('#txTable');
    if (!txns.length) { el.innerHTML = `<div class="empty" style="padding:30px">${icon('inbox')}<p class="muted">No bank transactions yet.</p></div>`; return; }
    el.innerHTML = `<table class="data"><thead><tr><th class="nosort">Date</th><th class="nosort">Reference</th><th class="nosort">Description</th><th class="nosort num">Amount</th></tr></thead>
      <tbody>${txns.map((t) => `<tr><td>${fmtDate(t.journal_date)}</td><td><strong>${escapeHtml(t.reference || '—')}</strong></td><td>${escapeHtml(t.notes || '—')}</td><td class="num">${fmtAED(t.amount)}</td></tr>`).join('')}</tbody></table>`;
  }

  function bankOpts(sel) { return accounts.map((a) => `<option value="${a.id}"${a.id == sel ? ' selected' : ''}>${escapeHtml(a.name)}</option>`).join(''); }
  function otherOpts(types) { return allAccounts.filter((a) => types.includes(a.account_type)).map((a) => `<option value="${a.id}">${escapeHtml(a.code + ' · ' + a.name)}</option>`).join(''); }

  function moneyForm() {
    openModal({
      title: 'Record money in / out',
      body: `<form id="mf">
        <div class="grid-2">
          <div class="field"><label>Direction</label><select class="select" name="type">${optionList(['deposit', 'withdrawal'], 'deposit')}</select></div>
          <div class="field"><label>Bank / cash account</label><select class="select" name="account_id">${bankOpts()}</select></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>Amount (AED)</label><input class="input" type="number" step="0.01" name="amount" required></div>
          <div class="field"><label>Date</label><input class="input" type="date" name="date" value="${new Date().toISOString().slice(0, 10)}"></div>
        </div>
        <div class="field"><label id="otherLbl">Received as (income)</label><select class="select" name="other_account_id" id="otherSel">${otherOpts(['income'])}</select></div>
        <div class="field"><label>Description</label><input class="input" name="description"></div>
      </form>`,
      footer: `<button class="btn btn-outline" data-close>Cancel</button><button class="btn btn-primary" data-save>Record</button>`,
      onMount: (back, close) => {
        const typeSel = back.querySelector('[name=type]');
        const otherSel = back.querySelector('#otherSel');
        const otherLbl = back.querySelector('#otherLbl');
        typeSel.onchange = () => {
          if (typeSel.value === 'deposit') { otherLbl.textContent = 'Received as (income)'; otherSel.innerHTML = otherOpts(['income']); }
          else { otherLbl.textContent = 'Paid for (expense)'; otherSel.innerHTML = otherOpts(['expense']); }
        };
        back.querySelector('[data-save]').onclick = async () => {
          const fd = Object.fromEntries(new FormData(back.querySelector('#mf')));
          if (!fd.amount) return toast('Amount is required', 'err');
          try { await post('/api/banking/transaction', { ...fd, amount: Number(fd.amount) }); await reload(); toast('Recorded', 'ok'); close(); }
          catch (e) { toast(e.message, 'err'); }
        };
      },
    });
  }

  function transferForm() {
    openModal({
      title: 'Transfer between accounts',
      body: `<form id="tf">
        <div class="field"><label>From account</label><select class="select" name="from_account_id">${bankOpts()}</select></div>
        <div class="field"><label>To account</label><select class="select" name="to_account_id">${bankOpts(accounts[1]?.id)}</select></div>
        <div class="grid-2">
          <div class="field"><label>Amount (AED)</label><input class="input" type="number" step="0.01" name="amount" required></div>
          <div class="field"><label>Date</label><input class="input" type="date" name="date" value="${new Date().toISOString().slice(0, 10)}"></div>
        </div>
        <div class="field"><label>Description</label><input class="input" name="description" value="Fund transfer"></div>
      </form>`,
      footer: `<button class="btn btn-outline" data-close>Cancel</button><button class="btn btn-primary" data-save>Transfer</button>`,
      onMount: (back, close) => {
        back.querySelector('[data-save]').onclick = async () => {
          const fd = Object.fromEntries(new FormData(back.querySelector('#tf')));
          if (fd.from_account_id === fd.to_account_id) return toast('Pick two different accounts', 'err');
          if (!fd.amount) return toast('Amount is required', 'err');
          try { await post('/api/banking/transaction', { type: 'transfer', ...fd, amount: Number(fd.amount) }); await reload(); toast('Transfer recorded', 'ok'); close(); }
          catch (e) { toast(e.message, 'err'); }
        };
      },
    });
  }

  async function reload() {
    accounts = await get('/api/banking/accounts');
    txns = await get('/api/banking/transactions').catch(() => []);
    renderAccounts(); renderTxns();
  }
}
