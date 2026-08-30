import { get, post, put, del, icon, fmtAED, escapeHtml, toast, openModal, confirmDialog, optionList } from '../api.js';
import { pageHead, kpiRow } from '../ui.js';

const TYPES = ['asset', 'liability', 'equity', 'income', 'expense'];
const SUBTYPES = {
  asset: ['bank', 'cash', 'accounts_receivable', 'current_asset', 'fixed_asset', 'stock'],
  liability: ['accounts_payable', 'current_liability', 'tax', 'long_term_liability'],
  equity: ['equity'],
  income: ['income', 'other_income'],
  expense: ['cost_of_goods_sold', 'expense', 'other_expense'],
};
const TYPE_LABEL = { asset: 'Assets', liability: 'Liabilities', equity: 'Equity', income: 'Income', expense: 'Expenses' };

export default async function accounts(view, ctx) {
  const isAdmin = ctx.user.role === 'admin';
  let rows = await get('/api/accounts');
  const tb = await get('/api/reports/trial-balance').catch(() => ({ rows: [] }));
  const balOf = (id) => {
    const r = tb.rows.find((x) => x.id === id);
    if (!r) return 0;
    return r.debit - r.credit;   // signed, debit-positive
  };

  const byType = (t) => rows.filter((r) => r.account_type === t);

  view.innerHTML = pageHead({
    title: 'Chart of Accounts', desc: 'Every account your books post to — the backbone of double-entry accounting.',
    actions: `<button class="btn btn-primary" id="addBtn">${icon('plus')} New Account</button>`,
  }) + kpiRow([
    { label: 'Total accounts', value: rows.length, icon: 'ledger' },
    { label: 'Asset accounts', value: byType('asset').length, icon: 'wallet', tone: 'green' },
    { label: 'Income accounts', value: byType('income').length, icon: 'trending' },
    { label: 'Expense accounts', value: byType('expense').length, icon: 'receipt', tone: 'amber' },
  ]) + `<div id="coaBody"></div>`;

  view.querySelector('#addBtn').onclick = () => openForm();
  render();

  function render() {
    const el = view.querySelector('#coaBody');
    el.innerHTML = TYPES.map((t) => {
      const list = byType(t);
      if (!list.length) return '';
      return `<div class="card mb16"><div class="card-head"><h3>${TYPE_LABEL[t]}</h3><span class="muted" style="font-size:12px">${list.length} account${list.length > 1 ? 's' : ''}</span></div>
        <div class="table-wrap" style="border:none;box-shadow:none"><table class="data">
        <thead><tr><th class="nosort">Code</th><th class="nosort">Account name</th><th class="nosort">Type</th><th class="nosort num">Balance</th><th class="nosort"></th></tr></thead>
        <tbody>${list.map((r) => {
          const bal = balOf(r.id);
          return `<tr>
            <td><strong>${escapeHtml(r.code || '—')}</strong></td>
            <td>${escapeHtml(r.name)} ${r.is_system ? `<span class="badge b-gray" style="margin-left:6px">system</span>` : ''}${r.is_active ? '' : ' <span class="badge b-red">inactive</span>'}</td>
            <td class="muted">${escapeHtml(r.account_subtype || r.account_type)}</td>
            <td class="num"><strong>${fmtAED(Math.abs(bal))}</strong> <span class="muted" style="font-size:11px">${bal >= 0 ? 'Dr' : 'Cr'}</span></td>
            <td class="num"><div class="row-actions">
              <button class="btn btn-ghost btn-icon btn-sm" data-edit="${r.id}" title="Edit">${icon('edit')}</button>
              ${isAdmin && !r.is_system ? `<button class="btn btn-ghost btn-icon btn-sm" data-del="${r.id}" title="Delete" style="color:var(--red)">${icon('trash')}</button>` : ''}
            </div></td>
          </tr>`;
        }).join('')}</tbody></table></div></div>`;
    }).join('');

    el.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => openForm(rows.find((r) => r.id == b.dataset.edit)));
    el.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
      const r = rows.find((x) => x.id == b.dataset.del);
      if (await confirmDialog(`Delete account “${r.name}”?`)) {
        try { await del('/api/accounts/' + r.id); rows = rows.filter((x) => x.id !== r.id); toast('Account deleted', 'ok'); render(); }
        catch (e) { toast(e.message, 'err'); }
      }
    });
  }

  function openForm(row) {
    const r = row || { account_type: 'expense' };
    const subOpts = (t) => SUBTYPES[t] || [];
    openModal({
      title: row ? `Edit ${row.name}` : 'New account',
      body: `<form id="af">
        <div class="grid-2">
          <div class="field"><label>Account code</label><input class="input" name="code" value="${escapeHtml(r.code || '')}" placeholder="e.g. 6100"></div>
          <div class="field"><label>Account type</label><select class="select" name="account_type" ${r.is_system ? 'disabled' : ''}>${optionList(TYPES, r.account_type)}</select></div>
        </div>
        <div class="field"><label>Account name</label><input class="input" name="name" value="${escapeHtml(r.name || '')}" required></div>
        <div class="grid-2">
          <div class="field"><label>Sub-type</label><select class="select" name="account_subtype">${optionList(subOpts(r.account_type), r.account_subtype || subOpts(r.account_type)[0] || '')}</select></div>
          <div class="field"><label>Status</label><select class="select" name="is_active">${optionList(['1', '0'], String(r.is_active ?? 1))}</select></div>
        </div>
        <div class="field"><label>Description</label><input class="input" name="description" value="${escapeHtml(r.description || '')}"></div>
      </form>`,
      footer: `<button class="btn btn-outline" data-close>Cancel</button><button class="btn btn-primary" data-save>${row ? 'Save' : 'Create'}</button>`,
      onMount: (back, close) => {
        const typeSel = back.querySelector('[name=account_type]');
        const subSel = back.querySelector('[name=account_subtype]');
        typeSel.addEventListener('change', () => { subSel.innerHTML = optionList(subOpts(typeSel.value), subOpts(typeSel.value)[0] || ''); });
        back.querySelector('[data-save]').onclick = async () => {
          const fd = Object.fromEntries(new FormData(back.querySelector('#af')));
          if (!fd.name) return toast('Account name is required', 'err');
          fd.is_active = Number(fd.is_active);
          if (r.is_system) fd.account_type = r.account_type;
          try {
            if (row) { const u = await put('/api/accounts/' + row.id, fd); Object.assign(rows.find((x) => x.id === row.id), u); }
            else { rows.push(await post('/api/accounts', fd)); }
            toast(row ? 'Account updated' : 'Account created', 'ok'); close(); render();
          } catch (e) { toast(e.message, 'err'); }
        };
      },
    });
  }
}
