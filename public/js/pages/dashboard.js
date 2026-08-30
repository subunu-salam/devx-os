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
    { label: 'Net profit', value: fmtAED(k.netProfit ?? 0), sub: `Income ${fmtAED(k.credit || 0)} · Exp ${fmtAED(k.debit || 0)}`, icon: 'trending', tone: (k.netProfit ?? 0) >= 0 ? 'green' : 'red' },
    { label: 'Cash & bank', value: fmtAED(k.cashBank ?? 0), sub: `Net worth ${fmtAED(k.netPosition || 0)}`, icon: 'wallet', tone: 'green' },
    { label: 'Receivables', value: fmtAED(k.receivables ?? 0), sub: `Payables ${fmtAED(k.payables || 0)}`, icon: 'invoice', tone: 'amber' },
    { label: 'Pipeline', value: fmtAED(k.pipelineValue ?? 0), sub: `${k.openDeals || 0} open deals`, icon: 'target' },
  ]) + kpiRow([
    { label: 'Meetings this month', value: k.monthMeetings, sub: `${k.totalMeetings} all time`, icon: 'calendar' },
    { label: 'Expenses this month', value: fmtAED(k.monthExpenses), sub: `${fmtAED(k.totalExpenses)} all time`, icon: 'receipt', tone: 'amber' },
    { label: 'VAT payable', value: fmtAED(k.vatPayable ?? 0), sub: 'Output − input VAT', icon: 'ledger' },
    { label: 'Active leads', value: k.interestedLeads, sub: `${k.leads} total · ${k.wonLeads} won`, icon: 'leads' },
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
