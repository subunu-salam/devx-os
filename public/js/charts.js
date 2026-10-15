// Chart.js wrappers — Raster Glass palette, gradient fills, animated entrances.
export const PALETTE = ['#46B37D', '#4C8DFF', '#F2A33A', '#7C6CFF', '#169347', '#7FD8A8', '#8B8B92', '#E5484D'];

export function chartCard(title, canvasId, extra = '') {
  return `<div class="card"><div class="card-head"><h3>${title}</h3>${extra}</div>
    <div class="card-pad"><div class="chart-box"><canvas id="${canvasId}"></canvas></div></div></div>`;
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function vGrad(ctx, area, from, to) {
  const g = ctx.createLinearGradient(0, area.bottom, 0, area.top);
  g.addColorStop(0, from); g.addColorStop(1, to); return g;
}

const registry = {};
export function getChart(id) { return registry[id]; }

export function makeChart(canvasId, type, data, options = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === 'undefined') return;
  if (registry[canvasId]) { registry[canvasId].destroy(); }

  const css = getComputedStyle(document.documentElement);
  const gridColor = (css.getPropertyValue('--row-border') || 'rgba(0,0,0,.06)').trim();
  const tickColor = (css.getPropertyValue('--muted') || '#8E8E99').trim();
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';

  const isPie = type === 'doughnut' || type === 'pie';
  data.datasets = data.datasets.map((ds, i) => {
    const c = PALETTE[i % PALETTE.length];
    if (isPie) return { backgroundColor: PALETTE, borderWidth: 0, hoverOffset: 10, spacing: 3, borderRadius: 6, ...ds };
    return {
      backgroundColor: ds.backgroundColor || ((ctx) => {
        const { chart } = ctx; if (!chart.chartArea) return hexA(c, .3);
        return type === 'line'
          ? vGrad(chart.ctx, chart.chartArea, hexA(c, 0), hexA(c, dark ? .35 : .22))
          : vGrad(chart.ctx, chart.chartArea, hexA(c, .35), c);
      }),
      hoverBackgroundColor: type === 'bar' ? (ctx) => {
        const { chart } = ctx; if (!chart.chartArea) return c;
        return vGrad(chart.ctx, chart.chartArea, '#7FD8A8', '#A6E8C4');
      } : undefined,
      borderColor: ds.borderColor || c,
      borderWidth: type === 'line' ? 2.5 : 0,
      borderRadius: type === 'bar' ? 8 : 0,
      borderSkipped: false,
      fill: type === 'line',
      tension: .42,
      pointRadius: type === 'line' ? 0 : 0,
      pointHoverRadius: 6,
      pointHoverBorderWidth: 3,
      pointHoverBorderColor: dark ? '#0A0A0A' : '#fff',
      pointBackgroundColor: c,
      maxBarThickness: 38,
      ...ds,
    };
  });

  const cfgOpts = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: isPie ? 'nearest' : 'index', intersect: isPie },
    animation: isPie
      ? { animateRotate: true, animateScale: true, duration: 1100, easing: 'easeOutQuart' }
      : { duration: 1000, easing: 'easeOutQuart', delay: (ctx) => (ctx.type === 'data' && ctx.mode === 'default' ? ctx.dataIndex * 45 : 0) },
    cutout: isPie && type === 'doughnut' ? '72%' : undefined,
    plugins: {
      legend: { display: isPie, position: 'bottom', labels: { color: tickColor, usePointStyle: true, pointStyle: 'rectRounded', boxWidth: 8, boxHeight: 8, padding: 14, font: { family: "Inter, system-ui, sans-serif", size: 12 } } },
      tooltip: {
        backgroundColor: dark ? 'rgba(20,20,28,.92)' : 'rgba(10,10,12,.92)', borderColor: 'rgba(255,255,255,.12)', borderWidth: 1,
        padding: 12, cornerRadius: 10, displayColors: true, boxPadding: 4, usePointStyle: true,
        titleFont: { family: "'JetBrains Mono', ui-monospace, monospace", size: 11, weight: '500' }, bodyFont: { family: "Inter, system-ui, sans-serif", size: 13, weight: '600' },
      },
    },
    scales: isPie ? {} : {
      x: { grid: { display: false }, border: { display: false }, ticks: { font: { family: "'JetBrains Mono', ui-monospace, monospace", size: 10.5 }, color: tickColor } },
      y: { beginAtZero: true, grid: { color: gridColor, drawTicks: false }, border: { display: false, dash: [4, 4] }, ticks: { padding: 8, font: { family: "'JetBrains Mono', ui-monospace, monospace", size: 10.5 }, color: tickColor, maxTicksLimit: 6 } },
    },
  };
  // shallow-merge plugins so callers can override parts
  const merged = { ...cfgOpts, ...options, plugins: { ...cfgOpts.plugins, ...(options.plugins || {}) } };

  registry[canvasId] = new Chart(canvas, { type, data, options: merged });
  return registry[canvasId];
}
