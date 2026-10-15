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

/* ---------- Extra interaction layer ---------- */

// Click ripple on buttons, tabs, nav links and quick tiles.
document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest?.('.btn, .seg button, .tabs button, .quick-grid a, .nav a, .top-pill, .kpi-link');
  if (!el || reduce()) return;
  const r = el.getBoundingClientRect();
  const s = Math.max(r.width, r.height) * 2;
  const dot = document.createElement('span');
  dot.className = 'ripple';
  dot.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  el.style.overflow = 'hidden';
  el.appendChild(dot);
  setTimeout(() => dot.remove(), 650);
});

// Cursor spotlight on every glass card / table.
document.addEventListener('pointermove', (e) => {
  const c = e.target.closest?.('.card, .table-wrap, .kan-card');
  if (!c || e.pointerType === 'touch') return;
  const r = c.getBoundingClientRect();
  c.style.setProperty('--cx', `${e.clientX - r.left}px`);
  c.style.setProperty('--cy', `${e.clientY - r.top}px`);
});

// Magnetic pull on primary buttons.
document.addEventListener('pointermove', (e) => {
  const b = e.target.closest?.('.btn-primary');
  if (!b || reduce() || e.pointerType === 'touch') return;
  const r = b.getBoundingClientRect();
  b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.12}px, ${(e.clientY - r.top - r.height / 2) * 0.2}px)`;
});
document.addEventListener('pointerout', (e) => {
  const b = e.target.closest?.('.btn-primary');
  if (b && !b.contains(e.relatedTarget)) b.style.transform = '';
});

// Reveal cards/rows as they scroll into view.
const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
  entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
}, { rootMargin: '0px 0px -40px 0px' }) : null;
export function revealOnScroll(root) {
  if (!io || reduce()) return;
  root.querySelectorAll('.grid > .card, .card.mb16, .table-wrap, .kanban, .cal').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.top > window.innerHeight) { el.classList.add('reveal'); io.observe(el); }
  });
  // stagger table rows on first paint
  root.querySelectorAll('table.data tbody tr').forEach((tr, i) => { if (i < 25) tr.style.animationDelay = `${i * 22}ms`; tr.classList.add('row-in'); });
}

// Circular theme transition from the click point (falls back to an instant switch).
export function themeTransition(x, y, apply) {
  if (!document.startViewTransition || reduce()) { apply(); return; }
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const t = document.startViewTransition(apply);
  t.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 550, easing: 'cubic-bezier(.2,.8,.2,1)', pseudoElement: '::view-transition-new(root)' },
    );
  }).catch(() => {});
}
