import { get, post, put, icon, escapeHtml, toast, openModal, optionList } from '../api.js';
import { pageHead } from '../ui.js';

export default async function settings(view, ctx) {
  const isSuper = !!ctx.user.is_super;
  let team = [];
  if (isSuper) team = await get('/api/admin/users').catch(() => []);

  view.innerHTML = pageHead({ title: 'Settings', desc: 'Your account' + (isSuper ? ' and team management.' : '.') }) + `
    <div class="grid cols-2">
      <div class="card"><div class="card-head"><h3>Your profile</h3></div>
        <div class="card-pad">
          <div class="detail-row"><span class="k">Name</span><strong>${escapeHtml(ctx.user.full_name)}</strong></div>
          <div class="detail-row"><span class="k">Email</span><strong>${escapeHtml(ctx.user.email)}</strong></div>
          <div class="detail-row"><span class="k">Title</span><strong>${escapeHtml(ctx.user.title || '—')}</strong></div>
          <div class="detail-row"><span class="k">Access</span><span class="badge ${isSuper ? 'b-green' : ctx.user.role === 'admin' ? 'b-blue' : 'b-gray'}">${isSuper ? 'Super Admin' : escapeHtml(ctx.user.role)}</span></div>
        </div></div>
      <div class="card"><div class="card-head"><h3>Change your password</h3></div>
        <div class="card-pad">
          <form id="pwf">
            <div class="field"><label>Current password</label><input class="input" type="password" name="current_password" required></div>
            <div class="field"><label>New password</label><input class="input" type="password" name="new_password" minlength="6" required></div>
            <div class="field"><label>Confirm new password</label><input class="input" type="password" name="confirm" minlength="6" required></div>
            <button class="btn btn-primary" id="pwBtn">${icon('lock')} Update password</button>
          </form>
        </div></div>
    </div>
    ${isSuper ? superTeamSection(team) : restrictedNote()}`;

  view.querySelector('#pwf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    if (fd.new_password !== fd.confirm) return toast('New passwords do not match', 'err');
    const btn = view.querySelector('#pwBtn'); btn.disabled = true;
    try {
      await post('/api/auth/change-password', { current_password: fd.current_password, new_password: fd.new_password });
      toast('Password updated', 'ok'); e.target.reset();
    } catch (err) { toast(err.message, 'err'); }
    btn.disabled = false;
  });

  if (isSuper) wireTeam();

  function wireTeam() {
    view.querySelectorAll('[data-edit-user]').forEach((b) => {
      b.onclick = () => editUser(team.find((u) => u.id == b.dataset.editUser));
    });
  }

  function editUser(u) {
    openModal({
      title: `Manage ${u.full_name}`,
      body: `<form id="uf">
        <div class="field"><label>Full name</label><input class="input" name="full_name" value="${escapeHtml(u.full_name)}"></div>
        <div class="grid-2">
          <div class="field"><label>Title</label><input class="input" name="title" value="${escapeHtml(u.title || '')}"></div>
          <div class="field"><label>Finance role</label><select class="select" name="role">${optionList(['admin', 'accountant'], u.role)}</select></div>
        </div>
        <div class="field"><label>Email</label><input class="input" value="${escapeHtml(u.email)}" disabled></div>
        <div class="field"><label>${icon('key')} Reset password (leave blank to keep current)</label>
          <input class="input" type="text" name="new_password" placeholder="New password" minlength="6"></div>
      </form>`,
      footer: `<button class="btn btn-outline" data-close>Cancel</button><button class="btn btn-primary" data-save>Save changes</button>`,
      onMount: (back, close) => {
        back.querySelector('[data-save]').onclick = async () => {
          const fd = Object.fromEntries(new FormData(back.querySelector('#uf')));
          try {
            const updated = await put('/api/admin/users/' + u.id, fd);
            Object.assign(u, updated);
            toast(fd.new_password ? 'Saved — password reset' : 'Member updated', 'ok');
            close();
            // re-render team table
            const host = view.querySelector('#teamHost'); if (host) host.outerHTML = superTeamSection(team); wireTeam();
          } catch (e) { toast(e.message, 'err'); }
        };
      },
    });
  }
}

function superTeamSection(team) {
  return `<div id="teamHost"><div class="card mt16"><div class="card-head"><h3>${'Team members'}</h3>
      <span class="badge b-green">${icon('shield')} Super Admin</span></div>
    <div class="table-wrap" style="border:none;box-shadow:none"><table class="data">
      <thead><tr><th class="nosort">Name</th><th class="nosort">Email</th><th class="nosort">Title</th><th class="nosort">Access</th><th class="nosort"></th></tr></thead>
      <tbody>${team.map((u) => `<tr>
        <td><strong>${escapeHtml(u.full_name)}</strong></td>
        <td>${escapeHtml(u.email)}</td>
        <td>${escapeHtml(u.title || '—')}</td>
        <td><span class="badge ${u.is_super ? 'b-green' : u.role === 'admin' ? 'b-blue' : 'b-gray'}">${u.is_super ? 'Super Admin' : u.role}</span></td>
        <td class="num"><button class="btn btn-outline btn-sm" data-edit-user="${u.id}">${icon('edit')} Manage</button></td>
      </tr>`).join('')}</tbody>
    </table></div></div></div>`;
}

function restrictedNote() {
  return `<div class="card mt16"><div class="card-pad" style="display:flex;align-items:center;gap:12px;color:var(--muted)">
    ${icon('lock')}<div>Team member accounts and passwords are managed by the <strong>Super Admin</strong> only.
    You can change your own password above.</div></div></div>`;
}
