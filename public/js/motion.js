// Motion helpers: count-up numbers, KPI tilt + spotlight, progressive bar fills.
const reduce = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Animate a formatted number string (e.g. "AED 12,345.00", "42", "-3,000") from 0 to its value. */
export function countUp(el, duration = 1100) {
  const text = el.textContent;
  const m = text.match(/-?[\d,]+(\.\d+)?/);
  if (!m || reduce()) return;
  const raw = m[0];
  const target = parseFloat(raw.replace(/,/g, ''));
  if (!isFinite(target) || target === 0) return;
  const decimals = (m[1] || '').length ? m[1].length - 1 : 0;
  const pre = text.slice(0, m.index), post = text.slice(m.index + raw.length);
  const useGroup = raw.includes(',') || Math.abs(target) >= 1000;
  const fmt = (v) => v.toLocaleString('en-AE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: useGroup });
  const t0 = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - t0) / duration);
    const e = 1 - Math.pow(1 - p, 4);
    el.textContent = pre + fmt(target * e) + post;
    if (p < 1) requestAnimationFrame(step); else el.textContent = text;
  };
  requestAnimationFrame(step);
}

/** Run after any page renders. */
export function animateView(root) {
  root.querySelectorAll('.kpi .val, [data-count]').forEach((el, i) => setTimeout(() => countUp(el), i * 40));
  root.querySelectorAll('.stat-strip .n').forEach((el) => countUp(el));
  requestAnimationFrame(() => root.querySelectorAll('.bar-list .fill[data-w]').forEach((f) => { f.style.width = f.dataset.w; }));
}

// Global, delegated pointer effects for KPI cards (tilt + cursor spotlight).
let bound = false;
export function bindPointerFx() {
  if (bound) return; bound = true;
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest?.('.kpi');
    if (!card || reduce() || e.pointerType === 'touch') return;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    card.style.setProperty('--mx', `${x * 100}%`);
    card.style.setProperty('--my', `${y * 100}%`);
    card.style.transform = `perspective(800px) rotateX(${(0.5 - y) * 5}deg) rotateY(${(x - 0.5) * 6}deg) translateY(-2px)`;
  });
  document.addEventListener('pointerout', (e) => {
    const card = e.target.closest?.('.kpi');
    if (card && !card.contains(e.relatedTarget)) card.style.transform = '';
  });
}
bindPointerFx();
