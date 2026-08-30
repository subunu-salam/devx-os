import { get, post, del, uploadFile, icon, fmtDate, escapeHtml, toast, openModal, confirmDialog } from '../api.js';
import { pageHead, kpiRow, listView } from '../ui.js';

export default async function documents(view, ctx) {
  const isAdmin = ctx.user.role === 'admin';
  let rows = await get('/api/documents');

  view.innerHTML = pageHead({
    title: 'Documents', desc: 'Central store for receipts, contracts, and any files your team needs.',
    actions: `<button class="btn btn-primary" id="addBtn">${icon('plus')} Upload Document</button>`,
  }) + kpiRow([
    { label: 'Documents', value: rows.length, icon: 'file' },
    { label: 'Folders', value: new Set(rows.map((r) => r.folder || 'Files')).size, icon: 'layers' },
  ]) + `<div id="dbody"></div>`;

  view.querySelector('#addBtn').onclick = () => openForm();
  renderList();

  function renderList() {
    listView({
      mount: view.querySelector('#dbody'), rows,
      searchKeys: ['name', 'folder', 'notes', 'uploaded_by'],
      filters: [{ key: 'folder', label: 'Folder', options: ['All', ...[...new Set(rows.map((r) => r.folder || 'Files'))]], match: (r, v) => (r.folder || 'Files') === v }],
      empty: 'No documents yet. Upload your first file.',
      columns: [
        { label: 'Name', sort: (r) => r.name, render: (r) => `<a href="${escapeHtml(r.file_url)}" target="_blank" rel="noopener">${icon('paperclip')} ${escapeHtml(r.name)}</a>` },
        { label: 'Folder', sort: (r) => r.folder, render: (r) => escapeHtml(r.folder || 'Files') },
        { label: 'Type', render: (r) => escapeHtml(r.file_type || '—') },
        { label: 'Uploaded', sort: (r) => r.created_at, render: (r) => `${fmtDate(r.created_at)}${r.uploaded_by ? `<div class="muted" style="font-size:12px">${escapeHtml(r.uploaded_by)}</div>` : ''}` },
        { label: '', align: 'right', render: (r) => `<div class="row-actions">${isAdmin ? `<button class="btn btn-ghost btn-icon btn-sm" data-del="${r.id}" title="Delete" style="color:var(--red)">${icon('trash')}</button>` : ''}</div>` },
      ],
      onRowsRendered: (tbody) => tbody.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
        const r = rows.find((x) => x.id == b.dataset.del);
        if (await confirmDialog(`Delete “${r.name}”?`)) { await del('/api/documents/' + r.id); rows = rows.filter((x) => x.id !== r.id); toast('Deleted', 'ok'); renderList(); }
      }),
    });
  }

  function openForm() {
    openModal({
      title: 'Upload document',
      body: `<form id="uf">
        <div class="field"><label>File</label><input class="input" type="file" name="file" required></div>
        <div class="grid-2">
          <div class="field"><label>Name (optional)</label><input class="input" name="name" placeholder="Defaults to file name"></div>
          <div class="field"><label>Folder</label><input class="input" name="folder" value="Files" list="folders">
            <datalist id="folders">${[...new Set(rows.map((r) => r.folder || 'Files'))].map((f) => `<option value="${escapeHtml(f)}">`).join('')}</datalist></div>
        </div>
        <div class="field"><label>Notes</label><input class="input" name="notes"></div>
      </form>`,
      footer: `<button class="btn btn-outline" data-close>Cancel</button><button class="btn btn-primary" data-save>Upload</button>`,
      onMount: (back, close) => {
        back.querySelector('[data-save]').onclick = async () => {
          const form = back.querySelector('#uf');
          const fd = Object.fromEntries(new FormData(form));
          const file = form.file.files[0];
          if (!file) return toast('Choose a file', 'err');
          const btn = back.querySelector('[data-save]'); btn.disabled = true;
          try {
            const up = await uploadFile(file);
            const payload = { name: fd.name || up.name, file_url: up.url, file_type: (file.type || '').split('/').pop() || 'file', folder: fd.folder || 'Files', notes: fd.notes, uploaded_by: ctx.user.full_name };
            rows.unshift(await post('/api/documents', payload));
            toast('Uploaded', 'ok'); close(); renderList();
          } catch (e) { toast(e.message, 'err'); btn.disabled = false; }
        };
      },
    });
  }
}
