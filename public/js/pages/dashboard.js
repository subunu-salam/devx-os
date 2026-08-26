import { get, icon, fmtAED, fmtDate, badge, escapeHtml } from '../api.js';
import { pageHead, kpiRow } from '../ui.js';
import { makeChart, chartCard } from '../charts.js';

export default async function dashboard(view, ctx) {
  const d = await get('/api/dashboard');
  const k = d.kpi;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  view.innerHTML = pageHead({
    title: `${greet}, ${ctx.user.full_name.split(' ')[0]}`,
    desc: 'Your DevX Technologies operations at a glance.',
    actions: `<button class="btn btn-outline" id="qMeet">${icon('calendar')} Schedule Meeting</button>
              <button class="btn btn-primary" id="qExp">${icon('plus')} Add Expense</button>`,
  }) + kpiRow([
    { label: 'Meetings this month', value: k.monthMeetings, sub: `${k.totalMeetings} all time`, icon: 'calendar' },
    { label: 'Expenses this month', value: fmtAED(k.monthExpenses), sub: `${fmtAED(k.totalExpenses)} all time`, icon: 'wallet', tone: 'amber' },
    { label: 'Net cash position', value: fmtAED(k.netPosition), sub: 'Credits − debits − expenses', icon: 'trending', tone: k.netPosition >= 0 ? 'green' : 'red' },
    { label: 'Active leads', value: k.interestedLeads, sub: `${k.leads} total · ${k.wonLeads} won`, icon: 'target' },
  ]) + `
    <div class="grid cols-2 mb16">
      ${chartCard('Monthly expenses', 'dMonth')}
      ${chartCard('Meetings by status', 'dStatus')}
    </div>
    <div class="grid cols-2">
      <div class="card"><div class="card-head"><h3>Recent meetings</h3><a href="#/meetings">View all</a></div>
        <div id="recMeet"></div></div>
      <div class="card"><div class="card-head"><h3>Recent expenses</h3><a href="#/expenses">View all</a></div>
        <div id="recExp"></div></div>
    </div>`;

  view.querySelector('#qMeet').onclick = () => ctx.navigate('meetings');
  view.querySelector('#qExp').onclick = () => ctx.navigate('expenses');

  // Charts
  const em = d.charts.expenseByMonth;
  makeChart('dMonth', 'line', {
    labels: em.map((r) => new Date(r.ym + '-01').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })),
    datasets: [{ label: 'AED', data: em.map((r) => r.total) }],
  });
  const ms = d.charts.meetingsByStatus;
  makeChart('dStatus', 'doughnut', { labels: ms.map((r) => r.status), datasets: [{ data: ms.map((r) => r.n) }] });

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

function listBlock(items, tpl, empty) {
  if (!items.length) return `<div class="empty" style="padding:30px">${icon('inbox')}<p class="muted">${empty}</p></div>`;
  return `<div class="card-pad" style="padding-top:6px;padding-bottom:6px">${items.map(tpl).join('')}</div>`;
}
