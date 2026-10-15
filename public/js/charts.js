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

const fxOn = () => !document.documentElement.classList.contains('fx-off');

// Vertical crosshair + glowing line strokes (registered once).
const fxPlugin = {
  id: 'devxFx',
  beforeDatasetDraw(chart, args) {
    if (!fxOn() || chart.config.type !== 'line') return;
    const c = chart.ctx; c.save();
    c.shadowColor = args.meta.dataset?.options?.borderColor || '#46B37D'; c.shadowBlur = 14;
  },
  afterDatasetDraw(chart) { if (fxOn() && chart.config.type === 'line') chart.ctx.restore(); },
  afterDraw(chart) {
    const act = chart.tooltip?.getActiveElements?.();
    if (!fxOn() || !act?.length || !chart.scales?.x || chart.config.type === 'doughnut') return;
    const { ctx: c, chartArea: a } = chart, x = act[0].element.x;
    c.save();
    const g = c.createLinearGradient(0, a.top, 0, a.bottom);
    g.addColorStop(0, 'rgba(70,179,125,0)'); g.addColorStop(.5, 'rgba(70,179,125,.7)'); g.addColorStop(1, 'rgba(70,179,125,0)');
    c.strokeStyle = g; c.lineWidth = 1.5; c.setLineDash([4, 4]);
    c.beginPath(); c.moveTo(x, a.top); c.lineTo(x, a.bottom); c.stroke();
    c.restore();
  },
};
let fxRegistered = false;

const registry = {};
export function getChart(id) { return registry[id]; }

export function makeChart(canvasId, type, data, options = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === 'undefined') return;
  if (registry[canvasId]) { registry[canvasId].destroy(); }
  if (!fxRegistered) { Chart.register(fxPlugin); fxRegistered = true; }

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
      : (type === 'line' && fxOn()) ? {}
      : { duration: 1000, easing: 'easeOutQuart', delay: (ctx) => (ctx.type === 'data' && ctx.mode === 'default' ? ctx.dataIndex * 45 : 0) },
    // "draws itself" line animation (point by point, left to right)
    animations: (type === 'line' && fxOn()) ? (() => {
      const n = data.labels?.length || 1, step = 900 / n;
      const prevY = (ctx) => ctx.index === 0 ? ctx.chart.scales.y.getPixelForValue(0) : ctx.chart.getDatasetMeta(ctx.datasetIndex).data[ctx.index - 1].getProps(['y'], true).y;
      return {
        x: { type: 'number', easing: 'linear', duration: step, from: NaN, delay: (ctx) => ctx.type === 'data' && !ctx.xStarted ? (ctx.xStarted = true, ctx.index * step) : 0 },
        y: { type: 'number', easing: 'linear', duration: step, from: prevY, delay: (ctx) => ctx.type === 'data' && !ctx.yStarted ? (ctx.yStarted = true, ctx.index * step) : 0 },
      };
    })() : undefined,
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
