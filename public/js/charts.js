// Chart.js wrappers with DevX brand palette.
const PALETTE = ['#46B37D', '#169347', '#E8A33D', '#3B82F6', '#E5484D', '#8A938F', '#0B7A57', '#9AD3B5'];

export function chartCard(title, canvasId) {
  return `<div class="card"><div class="card-head"><h3>${title}</h3></div>
    <div class="card-pad"><div class="chart-box"><canvas id="${canvasId}"></canvas></div></div></div>`;
}

const registry = {};
export function makeChart(canvasId, type, data, options = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === 'undefined') return;
  if (registry[canvasId]) { registry[canvasId].destroy(); }

  const css = getComputedStyle(document.documentElement);
  const gridColor = (css.getPropertyValue('--row-border') || '#eef2f0').trim();
  const tickColor = (css.getPropertyValue('--muted') || '#6B7674').trim();

  const isPie = type === 'doughnut' || type === 'pie';
  data.datasets = data.datasets.map((ds, i) => {
    if (isPie) return { ...ds, backgroundColor: PALETTE, borderWidth: 0, hoverOffset: 6 };
    return {
      ...ds,
      backgroundColor: ds.backgroundColor || (type === 'line' ? 'rgba(70,179,125,.12)' : PALETTE[i] || PALETTE[0]),
      borderColor: ds.borderColor || PALETTE[i % PALETTE.length],
      borderWidth: type === 'line' ? 2.5 : 0,
      borderRadius: type === 'bar' ? 6 : 0,
      fill: type === 'line',
      tension: .35,
      pointRadius: type === 'line' ? 3 : 0,
      pointBackgroundColor: '#169347',
      maxBarThickness: 46,
    };
  });

  registry[canvasId] = new Chart(canvas, {
    type, data,
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: isPie, position: 'bottom', labels: { color: tickColor, boxWidth: 10, boxHeight: 10, padding: 14, font: { family: 'Inter', size: 12 } } },
        tooltip: { backgroundColor: '#0B0F0E', padding: 10, cornerRadius: 8, titleFont: { family: 'Inter' }, bodyFont: { family: 'Inter' } },
      },
      scales: isPie ? {} : {
        x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 11 }, color: tickColor } },
        y: { beginAtZero: true, grid: { color: gridColor }, ticks: { font: { family: 'Inter', size: 11 }, color: tickColor } },
      },
      ...options,
    },
  });
  return registry[canvasId];
}
