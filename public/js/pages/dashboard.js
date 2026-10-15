import { get, icon, fmtAED, fmtDate, badge, escapeHtml } from '../api.js';
import { pageHead, kpiRow } from '../ui.js';
import { makeChart, getChart, PALETTE } from '../charts.js';
import { countUp } from '../motion.js';

export default async function dashboard(view, ctx) {
  const d = await get('/api/dashboard');
  const k = d.kpi;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const income = k.credit || 0, spend = k.debit || 0;
  const margin = income > 0 ? Math.max(-100, Math.min(100, ((k.netProfit ?? 0) / income) * 100)) : 0;

  view.innerHTML = pageHead({
    title: `${greet}, ${ctx.user.full_name.split(' ')[0]}`,
    desc: 'Your DevX Technologies operations at a glance.',
    actions: `<button class="btn btn-outline" id="qMeet">${icon('calendar')} Schedule Meeting</button>
              <button class="btn btn-primary" id="qExp">${icon('plus')} Add Expense</button>`,
  }) + kpiRow([
    { label: 'Net profit', href: '#/financials', value: fmtAED(k.netProfit ?? 0), sub: `Income ${fmtAED(income)} · Exp ${fmtAED(spend)}`, icon: 'trending', tone: 'hero-kpi' },
    { label: 'Cash & bank', href: '#/banking', value: fmtAED(k.cashBank ?? 0), sub: `Net worth ${fmtAED(k.netPosition || 0)}`, icon: 'wallet', tone: 'green' },
    { label: 'Receivables', href: '#/invoices', value: fmtAED(k.receivables ?? 0), sub: `Payables ${fmtAED(k.payables || 0)}`, icon: 'invoice', tone: 'amber' },
    { label: 'Pipeline', href: '#/deals', value: fmtAED(k.pipelineValue ?? 0), sub: `${k.openDeals || 0} open deals`, icon: 'target' },
  ]) + kpiRow([
    { label: 'Meetings this month', href: '#/meetings', value: k.monthMeetings, sub: `${k.totalMeetings} all time`, icon: 'calendar' },
    { label: 'Expenses this month', href: '#/expenses', value: fmtAED(k.monthExpenses), sub: `${fmtAED(k.totalExpenses)} all time`, icon: 'receipt', tone: 'amber' },
    { label: 'VAT payable', href: '#/financials', value: fmtAED(k.vatPayable ?? 0), sub: 'Output − input VAT', icon: 'ledger' },
    { label: 'Active leads', href: '#/leads', value: k.interestedLeads, sub: `${k.leads} total · ${k.wonLeads} won`, icon: 'leads' },
  ]) + `
    <div class="dash-hero">
      <div class="card">
        <div class="card-head">
          <div><h3>Monthly expenses</h3><div class="muted" style="font-size:12px;margin-top:2px" id="mSub"></div></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <div class="seg" id="mRange"><button data-r="6">6M</button><button data-r="12" class="active">12M</button><button data-r="0">All</button></div>
            <div class="seg" id="mType"><button data-t="line" class="active">Area</button><button data-t="bar">Bars</button></div>
          </div>
        </div>
        <div class="card-pad">
          <div style="display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:10px">
            <div class="big-num" id="mTotal">AED 0.00</div><span id="mChip"></span>
          </div>
          <div class="chart-box" style="height:250px"><canvas id="dMonth"></canvas></div>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h3>Meetings by status</h3><a href="#/meetings">Open</a></div>
        <div class="card-pad">
          <div class="donut-wrap chart-box" style="height:200px"><canvas id="dStatus"></canvas>
            <div class="donut-center"><b id="dTot" data-count>${k.totalMeetings}</b><span id="dLbl">Meetings</span></div></div>
          <div class="legend" id="dLegend"></div>
        </div>
      </div>
    </div>

    <div class="grid cols-3 mb16">
      <div class="card"><div class="card-head"><h3>Spend by category</h3><a href="#/expenses">Details</a></div>
        <div class="card-pad">${barList(d.charts.expenseByCategory, 'category')}</div></div>
      <div class="card"><div class="card-head"><h3>Spend by team member</h3></div>
        <div class="card-pad">${barList(d.charts.expenseByPerson, 'person')}</div></div>
      <div class="card"><div class="card-head"><h3>Profit margin</h3><a href="#/financials">P&amp;L</a></div>
        <div class="card-pad">
          <div class="gauge">${gauge(margin)}</div>
          <div class="mini-stat" style="justify-content:space-around;margin-top:6px">
            <div>Income<b>${fmtAED(income)}</b></div><div>Expense<b>${fmtAED(spend)}</b></div>
          </div>
        </div></div>
    </div>

    <div class="card mb16"><div class="card-head"><h3>Quick actions</h3></div>
      <div class="card-pad quick-grid">
        ${[['invoices', 'invoice', 'Invoices'], ['leads', 'leads', 'Leads'], ['deals', 'target', 'Deals pipeline'], ['financials', 'report', 'Financial reports']]
          .map(([h, i, l]) => `<a href="#/${h}">${icon(i)}<span>${l}</span></a>`).join('')}
      </div></div>

    <div class="grid cols-2">
      <div class="card"><div class="card-head"><h3>Recent meetings</h3><a href="#/meetings">View all</a></div>
        <div id="recMeet"></div></div>
      <div class="card"><div class="card-head"><h3>Recent expenses</h3><a href="#/expenses">View all</a></div>
        <div id="recExp"></div></div>
    </div>`;

  view.querySelector('#qMeet').onclick = () => ctx.navigate('meetings');
  view.querySelector('#qExp').onclick = () => ctx.navigate('expenses');

  /* ---- Monthly expenses: interactive range + chart type ---- */
  const em = d.charts.expenseByMonth;
  let range = 12, type = 'line';
  const drawMonth = () => {
    const rows = range ? em.slice(-range) : em;
    const total = rows.reduce((s, r) => s + Number(r.total || 0), 0);
    const totEl = view.querySelector('#mTotal');
    totEl.textContent = fmtAED(total); countUp(totEl, 800);
    view.querySelector('#mSub').textContent = rows.length ? `${rows.length} month${rows.length > 1 ? 's' : ''} · avg ${fmtAED(total / rows.length)}` : 'No data yet';
    const last = Number(rows.at(-1)?.total || 0), prev = Number(rows.at(-2)?.total || 0);
    const chip = view.querySelector('#mChip');
    if (rows.length > 1 && prev > 0) {
      const ch = ((last - prev) / prev) * 100;
      // for spend, going down is good
      chip.innerHTML = `<span class="chip ${ch <= 0 ? 'up' : 'down'}">${icon(ch <= 0 ? 'arrowDown' : 'arrowUp')}${Math.abs(ch).toFixed(1)}% vs prev month</span>`;
    } else chip.innerHTML = '';
    makeChart('dMonth', type, {
      labels: rows.map((r) => new Date(r.ym + '-01').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })),
      datasets: [{ label: 'AED', data: rows.map((r) => r.total) }],
    }, {
      onClick: (_e, els) => { if (els.length) ctx.navigate('expenses'); },
      onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; },
    });
  };
  const seg = (id, fn) => view.querySelector(id).addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    view.querySelectorAll(`${id} button`).forEach((x) => x.classList.toggle('active', x === b));
    fn(b); drawMonth();
  });
  seg('#mRange', (b) => { range = Number(b.dataset.r); });
  seg('#mType', (b) => { type = b.dataset.t; });
  drawMonth();

  /* ---- Meetings donut with toggleable legend ---- */
  const ms = d.charts.meetingsByStatus;
  const totEl = view.querySelector('#dTot'), lblEl = view.querySelector('#dLbl');
  const resetCenter = () => {
    const ch = getChart('dStatus');
    const sum = ms.reduce((s, r, i) => s + (ch && !ch.getDataVisibility(i) ? 0 : Number(r.n)), 0);
    totEl.textContent = sum; lblEl.textContent = 'Meetings';
  };
  makeChart('dStatus', 'doughnut', { labels: ms.map((r) => r.status), datasets: [{ data: ms.map((r) => r.n) }] }, {
    plugins: { legend: { display: false } },
    onClick: (_e, els) => { if (els.length) ctx.navigate('meetings'); },
    onHover: (e, els) => {
      e.native.target.style.cursor = els.length ? 'pointer' : 'default';
      if (els.length) { const i = els[0].index; totEl.textContent = ms[i].n; lblEl.textContent = ms[i].status; }
      else resetCenter();
    },
  });
  const legend = view.querySelector('#dLegend');
  legend.innerHTML = ms.length ? ms.map((r, i) => `<button data-i="${i}" type="button"><i style="background:${PALETTE[i % PALETTE.length]}"></i><span>${escapeHtml(r.status)}</span><b>${r.n}</b></button>`).join('')
    : '<div class="muted" style="text-align:center">No meetings yet</div>';
  legend.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const ch = getChart('dStatus'); const i = Number(b.dataset.i);
    ch.toggleDataVisibility(i); ch.update(); b.classList.toggle('off'); resetCenter();
  });
  legend.addEventListener('mouseover', (e) => {
    const b = e.target.closest('button'); const ch = getChart('dStatus'); if (!b || !ch) return;
    const i = Number(b.dataset.i);
    ch.setActiveElements([{ datasetIndex: 0, index: i }]); ch.update();
    totEl.textContent = ms[i].n; lblEl.textContent = ms[i].status;
  });
  legend.addEventListener('mouseleave', () => { const ch = getChart('dStatus'); if (ch) { ch.setActiveElements([]); ch.update(); } resetCenter(); });

  // Recent lists
  view.querySelector('#recMeet').innerHTML = listBlock(d.recentMeetings, (m) => `
    <div class="detail-row"><div><strong>${escapeHtml(m.client_name)}</strong>
      <div class="muted" style="font-size:12px">${fmtDate(m.meeting_date)}${m.business_category ? ' · ' + escapeHtml(m.business_category) : ''}</div></div>
      ${badge(m.status)}</div>`, 'No meetings yet');
  view.querySelector('#recExp').innerHTML = listBlock(d.recentExpenses, (e) => `
    <div class="detail-row"><div><strong>${escapeHtml(e.other_details || e.category)}</strong>
      <div class="muted" style="font-size:12px">${escapeHtml(e.person)} · ${fmtDate(e.expense_date)}</div></div>
      <span class="neg">${fmtAED(e.amount)}</span></div>`, 'No expenses yet');
}

function barList(rows, key) {
  if (!rows?.length) return `<div class="empty" style="padding:24px">${icon('inbox')}<p class="muted">No data yet</p></div>`;
  const top = rows.slice(0, 6);
  const max = Math.max(...top.map((r) => Number(r.total) || 0), 1);
  return `<div class="bar-list">${top.map((r) => `
    <div class="row" title="${escapeHtml(r[key] || '—')}: ${fmtAED(r.total)}"><span>${escapeHtml(r[key] || '—')}</span><span class="amt">${fmtAED(r.total)}</span>
      <div class="track"><div class="fill" data-w="${((Number(r.total) || 0) / max) * 100}%"></div></div></div>`).join('')}</div>`;
}

function gauge(pct) {
  const r = 80, c = Math.PI * r, off = c * (1 - Math.max(0, pct) / 100);
  const id = 'gg' + Math.random().toString(36).slice(2, 7);
  setTimeout(() => { const el = document.getElementById(id); if (el) el.style.strokeDashoffset = off; }, 80);
  return `<svg viewBox="0 0 200 116">
    <defs><linearGradient id="${id}g" x1="0" x2="1"><stop offset="0" stop-color="#7FD8A8"/><stop offset="1" stop-color="#46B37D"/></linearGradient></defs>
    <path class="g-track" d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke-width="14" stroke-linecap="round"/>
    <path id="${id}" class="g-fill" d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="url(#${id}g)" stroke-width="14" stroke-linecap="round"
      stroke-dasharray="${c}" style="stroke-dashoffset:${c}"/>
    <text x="100" y="88" text-anchor="middle" fill="currentColor" style="font:700 30px 'Inter Tight',sans-serif;letter-spacing:-1px">${pct.toFixed(1)}%</text>
    <text x="100" y="108" text-anchor="middle" fill="var(--muted)" style="font:500 9px 'JetBrains Mono',monospace;letter-spacing:1.5px">NET MARGIN</text>
  </svg>`;
}

function listBlock(items, tpl, empty) {
  if (!items.length) return `<div class="empty" style="padding:30px">${icon('inbox')}<p class="muted">${empty}</p></div>`;
  return `<div class="card-pad" style="padding-top:6px;padding-bottom:6px">${items.map(tpl).join('')}</div>`;
}
