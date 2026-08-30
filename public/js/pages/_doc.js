// Generic "document with line items" page — powers Sales Orders, Purchase Orders, Vendor Credits.
import { get, post, put, del, icon, badge, fmtAED, fmtDate, escapeHtml, toast, openModal, confirmDialog, optionList } from '../api.js';
import { pageHead, kpiRow, listView } from '../ui.js';

export function docPage(cfg) {
  return async function (view, ctx) {
    const isAdmin = ctx.user.role === 'admin';
    let rows = await get(cfg.apiBase);
    let contacts = cfg.contactType ? (await get('/api/contacts').catch(() => [])).filter((c) => c.contact_type === cfg.contactType) : [];
    let accts = [];
    if (cfg.withAccount) accts = (await get('/api/accounts').catch(() => [])).filter((a) => ['expense', 'asset'].includes(a.account_type) && a.is_active);

    render();
    function render() {
      view.innerHTML = pageHead({
        title: cfg.title, desc: cfg.desc,
        actions: `<button class="btn btn-primary" id="addBtn">${icon('plus')} ${cfg.addLabel}</button>`,
      }) + kpiRow(cfg.kpis(rows)) + `<div id="body"></div>`;
      view.querySelector('#addBtn').onclick = () => openForm();
      renderList();
    }

    function renderList() {
      listView({
        mount: view.querySelector('#body'), rows,
        searchKeys: [cfg.numberKey, cfg.nameKey],
        filters: cfg.statuses ? [{ key: 'status', label: 'Status', options: ['All', ...cfg.statuses], match: (r, v) => r.status === v }] : [],
        empty: `No ${cfg.entity}s yet.`,
        columns: [
          { label: cfg.numberLabel || '#', sort: (r) => r[cfg.numberKey], render: (r) => `<strong>${escapeHtml(r[cfg.numberKey])}</strong>` },
          { label: cfg.nameLabel, sort: (r) => r[cfg.nameKey], render: (r) => escapeHtml(r[cfg.nameKey]) },
          { label: 'Date', sort: (r) => r[cfg.dateKey], render: (r) => fmtDate(r[cfg.dateKey]) },
          ...(cfg.statuses ? [{ label: 'Status', sort: (r) => r.status, render: (r) => badge(cfg.statusBadge ? cfg.statusBadge(r.status) : r.status) }] : []),
          { label: 'Total', align: 'right', sort: (r) => Number(r.total), render: (r) => `<strong class="${cfg.amountClass || ''}">${fmtAED(r.total)}</strong>` },
          { label: '', align: 'right', render: (r) => `<div class="row-actions">
            ${(cfg.rowActions || []).filter((a) => !a.show || a.show(r)).map((a) => `<button class="btn btn-ghost btn-icon btn-sm" data-act="${a.key}" data-id="${r.id}" title="${a.title}">${icon(a.icon)}</button>`).join('')}
            <button class="btn btn-ghost btn-icon btn-sm" data-edit="${r.id}" title="Edit">${icon('edit')}</button>
            ${isAdmin ? `<button class="btn btn-ghost btn-icon btn-sm" data-del="${r.id}" title="Delete" style="color:var(--red)">${icon('trash')}</button>` : ''}
          </div>` },
        ],
        onRowsRendered: (tbody) => {
          tbody.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => openForm(rows.find((r) => r.id == b.dataset.edit)));
          tbody.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
            const r = rows.find((x) => x.id == b.dataset.del);
            if (await confirmDialog(`Delete ${r[cfg.numberKey]}?`)) { try { await del(`${cfg.apiBase}/${r.id}`); rows = rows.filter((x) => x.id !== r.id); toast('Deleted', 'ok'); renderList(); } catch (e) { toast(e.message, 'err'); } }
          });
          tbody.querySelectorAll('[data-act]').forEach((b) => b.onclick = async () => {
            const action = cfg.rowActions.find((a) => a.key === b.dataset.act);
            const r = rows.find((x) => x.id == b.dataset.id);
            await action.run(r, async () => { rows = await get(cfg.apiBase); renderList(); });
          });
        },
      });
    }

    function acctSelect(sel) {
      return `<select class="select" data-f="account_id">${accts.map((a) => `<option value="${a.id}"${a.id == sel ? ' selected' : ''}>${escapeHtml(a.code + ' · ' + a.name)}</option>`).join('')}</select>`;
    }
    function lineRow(it = {}) {
      return `<tr class="li">
        ${cfg.withAccount ? `<td>${acctSelect(it.account_id)}</td>` : ''}
        <td><input class="input" data-f="description" value="${escapeHtml(it.description || '')}" placeholder="Item / description"></td>
        <td style="width:70px"><input class="input" data-f="qty" type="number" step="0.01" value="${it.qty ?? 1}"></td>
        <td style="width:110px"><input class="input" data-f="unit_price" type="number" step="0.01" value="${it.unit_price ?? ''}"></td>
        <td style="width:110px" class="num amt">0.00</td>
        <td style="width:32px"><button class="btn btn-ghost btn-icon btn-sm" data-rm style="color:var(--red)">${icon('x')}</button></td>
      </tr>`;
    }

    function openForm(row) {
      const r = row || {};
      const colspan = cfg.withAccount ? 6 : 5;
      openModal({
        title: row ? `Edit ${row[cfg.numberKey]}` : `New ${cfg.entity}`, size: 'lg',
        body: `<form id="df">
          <div class="grid-3">
            <div class="field"><label>${cfg.nameLabel}</label><input class="input" name="${cfg.nameKey}" list="dList" value="${escapeHtml(r[cfg.nameKey] || '')}" required>
              <datalist id="dList">${contacts.map((c) => `<option value="${escapeHtml(c.display_name)}">`).join('')}</datalist></div>
            <div class="field"><label>${cfg.dateLabel}</label><input class="input" type="date" name="${cfg.dateKey}" value="${r[cfg.dateKey] || new Date().toISOString().slice(0, 10)}"></div>
            ${cfg.extraDateKey ? `<div class="field"><label>${cfg.extraDateLabel}</label><input class="input" type="date" name="${cfg.extraDateKey}" value="${r[cfg.extraDateKey] || ''}"></div>` : '<div></div>'}
          </div>
          ${cfg.reason ? `<div class="field"><label>Reason</label><input class="input" name="reason" value="${escapeHtml(r.reason || '')}"></div>` : ''}
          <label style="font-weight:600;font-size:13px">Line items</label>
          <div class="table-wrap" style="margin:6px 0 10px"><table class="data" style="min-width:${cfg.withAccount ? 640 : 520}px"><thead><tr>
            ${cfg.withAccount ? '<th class="nosort">Account</th>' : ''}<th class="nosort">Description</th><th class="nosort">Qty</th><th class="nosort">Price</th><th class="nosort num">Amount</th><th class="nosort"></th></tr></thead>
            <tbody id="items">${lineRow()}</tbody></table></div>
          <button type="button" class="btn btn-outline btn-sm" id="addItem">${icon('plus')} Add line</button>
          <div class="grid-2" style="margin-top:14px">
            <div class="field"><label>${cfg.taxLabel || 'VAT %'}</label><input class="input" type="number" step="0.01" name="tax_percent" value="${r.tax_percent ?? 5}"></div>
            ${cfg.statuses ? `<div class="field"><label>Status</label><select class="select" name="status">${optionList(cfg.formStatuses || cfg.statuses, r.status || (cfg.formStatuses || cfg.statuses)[0])}</select></div>` : '<div></div>'}
          </div>
          <div class="field"><label>Notes</label><input class="input" name="notes" value="${escapeHtml(r.notes || '')}"></div>
          <div class="card-pad" style="background:var(--subtle);border-radius:10px;text-align:right">
            <div>Subtotal: <strong id="sSub">AED 0.00</strong></div><div>Tax: <strong id="sTax">AED 0.00</strong></div>
            <div style="font-size:18px;margin-top:4px">Total: <strong id="sTot" class="${cfg.amountClass || 'pos'}">AED 0.00</strong></div>
          </div>
        </form>`,
        footer: `<button class="btn btn-outline" data-close>Cancel</button><button class="btn btn-primary" data-save>${row ? 'Save' : 'Create'}</button>`,
        onMount: async (back, close) => {
          const itemsEl = back.querySelector('#items');
          if (row) { const full = await get(`${cfg.apiBase}/${row.id}`); itemsEl.innerHTML = (full.items.length ? full.items : [{}]).map(lineRow).join(''); }
          const recalc = () => {
            let sub = 0;
            itemsEl.querySelectorAll('tr.li').forEach((tr) => { const q = Number(tr.querySelector('[data-f=qty]').value || 0), p = Number(tr.querySelector('[data-f=unit_price]').value || 0); const a = q * p; tr.querySelector('.amt').textContent = a.toFixed(2); sub += a; });
            const tax = sub * Number(back.querySelector('[name=tax_percent]').value || 0) / 100;
            back.querySelector('#sSub').textContent = fmtAED(sub); back.querySelector('#sTax').textContent = fmtAED(tax); back.querySelector('#sTot').textContent = fmtAED(sub + tax);
          };
          back.addEventListener('input', recalc);
          back.querySelector('#addItem').onclick = () => { itemsEl.insertAdjacentHTML('beforeend', lineRow()); recalc(); };
          itemsEl.addEventListener('click', (e) => { if (e.target.closest('[data-rm]')) { e.target.closest('tr').remove(); recalc(); } });
          recalc();
          back.querySelector('[data-save]').onclick = async () => {
            const fd = Object.fromEntries(new FormData(back.querySelector('#df')));
            const items = [...itemsEl.querySelectorAll('tr.li')].map((tr) => ({
              account_id: cfg.withAccount ? Number(tr.querySelector('[data-f=account_id]').value || 0) : undefined,
              description: tr.querySelector('[data-f=description]').value,
              qty: Number(tr.querySelector('[data-f=qty]').value || 0), unit_price: Number(tr.querySelector('[data-f=unit_price]').value || 0),
            })).filter((it) => it.description || it.unit_price);
            if (!fd[cfg.nameKey]) return toast(`${cfg.nameLabel} is required`, 'err');
            if (!items.length) return toast('Add at least one line', 'err');
            const payload = { ...fd, tax_percent: Number(fd.tax_percent || 0), items };
            try {
              if (row) await put(`${cfg.apiBase}/${row.id}`, payload); else await post(cfg.apiBase, payload);
              rows = await get(cfg.apiBase); toast(row ? 'Saved' : 'Created', 'ok'); close(); renderList();
            } catch (e) { toast(e.message, 'err'); }
          };
        },
      });
    }
  };
}
