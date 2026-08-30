// Shared page helpers — a compact generic CRUD page used by the simpler modules
// (customers, vendors, items, CRM contacts/accounts, tasks). Heavier modules
// (invoices, estimates, bills, reports) have their own bespoke files.
import { get, post, put, del, icon, escapeHtml, toast, openModal, confirmDialog, optionList } from '../api.js';
import { pageHead, kpiRow, listView, rowActionButtons } from '../ui.js';

/**
 * cfg:
 *  title, desc, addLabel, apiBase, entityName,
 *  fetch: async () => rows           (optional; defaults to get(apiBase))
 *  kpis: (rows) => [ {label,value,icon,tone,sub} ]   (optional)
 *  searchKeys: []
 *  filters: [ {key,label,options,match} ]            (optional)
 *  columns: listView columns WITHOUT the trailing actions column
 *  fields: [ {name,label,type,options,required,placeholder,full,step,value} ]
 *  toPayload: (formObject, row) => payload           (optional transform)
 *  beforeOpen: async () => void                      (optional, e.g. load dropdown data)
 *  empty: string
 */
export async function crudPage(view, ctx, cfg) {
  const isAdmin = ctx.user.role === 'admin';
  let rows = cfg.fetch ? await cfg.fetch() : await get(cfg.apiBase);
  if (cfg.beforeOpen) await cfg.beforeOpen();

  function head() {
    view.innerHTML = pageHead({
      title: cfg.title, desc: cfg.desc,
      actions: `<button class="btn btn-primary" id="addBtn">${icon('plus')} ${cfg.addLabel || 'Add'}</button>`,
    }) + (cfg.kpis ? kpiRow(cfg.kpis(rows)) : '') + `<div id="body"></div>`;
    view.querySelector('#addBtn').onclick = () => openForm();
    renderList();
  }

  function renderList() {
    const columns = cfg.columns.concat([{ label: '', align: 'right', render: () => rowActionButtons(isAdmin) }]);
    listView({
      mount: view.querySelector('#body'), rows,
      searchKeys: cfg.searchKeys || [],
      filters: cfg.filters || [],
      empty: cfg.empty || 'No records yet.',
      columns,
      onRowsRendered: (tbody) => tbody.querySelectorAll('tr').forEach((tr) => {
        const row = rows.find((r) => r.id == tr.dataset.id);
        tr.querySelector('[data-edit]')?.addEventListener('click', () => openForm(row));
        tr.querySelector('[data-del]')?.addEventListener('click', async () => {
          if (await confirmDialog(`Delete this ${cfg.entityName}?`)) {
            try {
              await del(`${cfg.apiBase}/${row.id}`);
              rows = rows.filter((r) => r.id !== row.id);
              toast(`${cap(cfg.entityName)} deleted`, 'ok'); renderList();
            } catch (e) { toast(e.message, 'err'); }
          }
        });
      }),
    });
  }

  function fieldHtml(f, r) {
    const val = r[f.name] ?? f.value ?? '';
    const wrap = (inner) => `<div class="field${f.full ? ' full' : ''}"><label>${escapeHtml(f.label)}</label>${inner}</div>`;
    if (f.type === 'select') {
      const opts = (f.options || []).map((o) => {
        const value = (o && typeof o === 'object') ? o.value : o;
        const label = (o && typeof o === 'object') ? o.label : o;
        const sel = String(value) === String(val) ? ' selected' : '';
        return `<option value="${escapeHtml(value)}"${sel}>${escapeHtml(label)}</option>`;
      }).join('');
      return wrap(`<select class="select" name="${f.name}">${f.allowEmpty ? '<option value="">—</option>' : ''}${opts}</select>`);
    }
    if (f.type === 'textarea') return wrap(`<textarea class="input" name="${f.name}" rows="${f.rows || 2}">${escapeHtml(val)}</textarea>`);
    const type = f.type || 'text';
    const step = f.type === 'number' ? ` step="${f.step || '0.01'}"` : '';
    return wrap(`<input class="input" type="${type}"${step} name="${f.name}" value="${escapeHtml(val)}" placeholder="${escapeHtml(f.placeholder || '')}"${f.required ? ' required' : ''}>`);
  }

  function openForm(row) {
    const r = row || {};
    const grouped = [];
    let buf = [];
    for (const f of cfg.fields) {
      if (f.full) { if (buf.length) { grouped.push(buf); buf = []; } grouped.push([f]); }
      else { buf.push(f); if (buf.length === 2) { grouped.push(buf); buf = []; } }
    }
    if (buf.length) grouped.push(buf);
    const bodyHtml = `<form id="f">${grouped.map((g) =>
      g.length === 2 ? `<div class="grid-2">${g.map((f) => fieldHtml(f, r)).join('')}</div>` : fieldHtml(g[0], r)
    ).join('')}</form>`;
    openModal({
      title: row ? `Edit ${cfg.entityName}` : `New ${cfg.entityName}`,
      size: cfg.modalSize || '',
      body: bodyHtml,
      footer: `<button class="btn btn-outline" data-close>Cancel</button><button class="btn btn-primary" data-save>${row ? 'Save' : 'Create'}</button>`,
      onMount: (back, close) => {
        back.querySelector('[data-save]').onclick = async () => {
          const fd = Object.fromEntries(new FormData(back.querySelector('#f')));
          for (const f of cfg.fields) if (f.type === 'number') fd[f.name] = Number(fd[f.name] || 0);
          const missing = cfg.fields.find((f) => f.required && !fd[f.name]);
          if (missing) return toast(`${missing.label} is required`, 'err');
          const payload = cfg.toPayload ? cfg.toPayload(fd, row) : fd;
          try {
            if (row) { const u = await put(`${cfg.apiBase}/${row.id}`, payload); Object.assign(rows.find((x) => x.id === row.id), u); }
            else { rows.unshift(await post(cfg.apiBase, payload)); }
            toast(row ? `${cap(cfg.entityName)} updated` : `${cap(cfg.entityName)} created`, 'ok');
            close(); renderList();
          } catch (e) { toast(e.message, 'err'); }
        };
      },
    });
  }

  head();
  return { reload: async () => { rows = cfg.fetch ? await cfg.fetch() : await get(cfg.apiBase); head(); } };
}

export const cap = (s) => String(s || '').replace(/^\w/, (c) => c.toUpperCase());
