import { get, put, icon, fmtDate, escapeHtml, toast } from '../api.js';
import { pageHead } from '../ui.js';

export default async function transactionLocking(view, ctx) {
  const isAdmin = ctx.user.role === 'admin';
  let { lock_date } = await get('/api/transaction-lock');

  function render() {
    view.innerHTML = pageHead({
      title: 'Transaction Locking', desc: 'Freeze your books up to a date so past transactions can’t be changed.',
    }) + `
      <div class="grid cols-2">
        <div class="card"><div class="card-head"><h3>Lock status</h3></div>
          <div class="card-pad">
            ${lock_date
              ? `<div class="detail-row"><span class="k">${icon('lock')} Books locked up to</span><strong>${fmtDate(lock_date)}</strong></div>
                 <p class="muted" style="margin-top:10px">No transactions dated on or before this date can be created or edited.</p>`
              : `<div class="detail-row"><span class="k">${icon('check2')} Status</span><strong class="pos">Open — nothing locked</strong></div>`}
          </div></div>
        <div class="card"><div class="card-head"><h3>Set a lock date</h3></div>
          <div class="card-pad">
            ${isAdmin ? `<form id="lf">
              <div class="field"><label>Lock all transactions on or before</label>
                <input class="input" type="date" name="lock_date" value="${lock_date || ''}"></div>
              <div style="display:flex;gap:8px">
                <button class="btn btn-primary" id="saveBtn" type="submit">${icon('lock')} Lock books</button>
                ${lock_date ? `<button class="btn btn-outline" id="clearBtn" type="button">Remove lock</button>` : ''}
              </div>
            </form>` : `<p class="muted">${icon('lock')} Only admins can lock or unlock the books.</p>`}
          </div></div>
      </div>`;

    if (isAdmin) {
      view.querySelector('#lf').addEventListener('submit', async (e) => {
        e.preventDefault();
        const d = new FormData(e.target).get('lock_date');
        if (!d) return toast('Pick a date', 'err');
        try { ({ lock_date } = await put('/api/transaction-lock', { lock_date: d })); toast('Books locked', 'ok'); render(); }
        catch (err) { toast(err.message, 'err'); }
      });
      view.querySelector('#clearBtn')?.addEventListener('click', async () => {
        try { ({ lock_date } = await put('/api/transaction-lock', { lock_date: null })); toast('Lock removed', 'ok'); render(); }
        catch (err) { toast(err.message, 'err'); }
      });
    }
  }
  render();
}
