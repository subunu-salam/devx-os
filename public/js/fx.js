// DevX OS — "Full effects" layer: live background, glow cursor, page transitions,
// draggable dashboard widgets, typewriter text, live clock and success confetti.
// Everything here is presentation only. Users can switch it off (stored per browser),
// and it stays off automatically for people who prefer reduced motion.

const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const prefersReduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const touchOnly = () => window.matchMedia?.('(hover: none)').matches;

export function fxOn() { return lsGet('devx-fx') !== 'off' && !prefersReduced(); }
function syncClass() { document.documentElement.classList.toggle('fx-off', !fxOn()); }
syncClass();

export function setFx(on) {
  lsSet('devx-fx', on ? 'on' : 'off');
  syncClass();
  on ? startBackground() : stopBackground();
  on ? startCursor() : stopCursor();
  window.dispatchEvent(new CustomEvent('fxchange', { detail: on }));
}
export function toggleFx() { setFx(!fxOn()); return fxOn(); }

const accent = () => (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#46B37D').trim();

/* ---------------- "Revenue Streams" background ----------------
   Flowing chart-like lines that bend away from the cursor.
   Built to cost nothing at load time:
   - starts only after the page has painted and the browser is idle
   - ~30 fps cap (~24 on small screens), capped pixel ratio
   - pure sine maths, no noise tables, no shadowBlur (glow = one wide faint pass)
   - pauses when the tab is hidden, when effects are off, or after a quiet spell with no motion
*/
let bg = null;
function startBackground() {
  if (bg || !fxOn()) return;
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 300));
  let cancelled = false, cleanup = null;
  const handle = idle(() => { if (!cancelled) cleanup = run(); }, { timeout: 1500 });
  bg = () => { cancelled = true; (window.cancelIdleCallback || clearTimeout)(handle); cleanup?.(); };
}
function run() {
  const c = document.createElement('canvas');
  c.className = 'fx-bg';
  c.setAttribute('aria-hidden', 'true');
  document.body.prepend(c);
  const ctx = c.getContext('2d', { alpha: true });
  const small = () => innerWidth < 768;
  const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999 };
  let w = 0, h = 0, lines = [], raf = 0, last = 0, running = true, lastMove = performance.now(), t = 0;

  const resize = () => {
    const dpr = Math.min(small() ? 1 : 1.5, window.devicePixelRatio || 1);
    w = innerWidth; h = innerHeight;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    c.style.width = w + 'px'; c.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = small() ? 8 : 12;
    lines = Array.from({ length: n }, (_, i) => ({
      y: h * (0.1 + (i / (n - 1)) * 0.82),
      amp: 16 + (i % 5) * 7,
      f1: 0.0042 + (i % 3) * 0.0011,
      f2: 0.0093 + (i % 4) * 0.0007,
      sp: 0.00045 + (i % 5) * 0.00008,
      ph: i * 1.7,
      hero: i % 4 === 1,
    }));
  };
  const onMove = (e) => { mouse.tx = e.clientX; mouse.ty = e.clientY; lastMove = performance.now(); wake(); };
  const onLeave = () => { mouse.tx = mouse.ty = -9999; };

  const step = small() ? 10 : 8;           // horizontal sampling in px
  const R = 160, R2 = R * R;               // cursor influence radius
  const frameGap = small() ? 1000 / 24 : 1000 / 30;

  const draw = (now) => {
    raf = 0;
    if (!running) return;
    if (now - last < frameGap) { raf = requestAnimationFrame(draw); return; }
    const dt = Math.min(64, now - last); last = now; t += dt;
    // ease the bend point toward the pointer (smooth, no jitter)
    if (mouse.tx < -9000) { mouse.x = mouse.tx; mouse.y = mouse.ty; }
    else if (mouse.x < -9000) { mouse.x = mouse.tx; mouse.y = mouse.ty; }
    else { mouse.x += (mouse.tx - mouse.x) * 0.2; mouse.y += (mouse.ty - mouse.y) * 0.2; }

    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    const k = dark ? 1 : 0.75;
    ctx.clearRect(0, 0, w, h);
    for (const L of lines) {
      ctx.beginPath();
      for (let x = -step; x <= w + step; x += step) {
        let y = L.y + Math.sin(x * L.f1 + t * L.sp + L.ph) * L.amp + Math.sin(x * L.f2 - t * L.sp * 1.6 + L.ph * 0.5) * L.amp * 0.45;
        const dx = x - mouse.x, dy = y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < R2) { const d = Math.sqrt(d2) || 1; y += (dy / d) * (R - d) * 0.5; }
        x === -step ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      if (L.hero) {
        ctx.strokeStyle = `rgba(70,179,125,${0.05 * k})`; ctx.lineWidth = 6; ctx.stroke();   // soft glow pass
        ctx.strokeStyle = `rgba(127,216,168,${0.26 * k})`; ctx.lineWidth = 1.5; ctx.stroke();
      } else {
        ctx.strokeStyle = `rgba(70,179,125,${0.10 * k})`; ctx.lineWidth = 1; ctx.stroke();
      }
    }
    // after ~8s with no pointer movement, slow to ~10 fps to save battery
    const quiet = now - lastMove > 8000;
    if (quiet) setTimeout(() => { if (running && !raf) raf = requestAnimationFrame(draw); }, 100);
    else raf = requestAnimationFrame(draw);
  };
  const wake = () => { if (running && !raf) raf = requestAnimationFrame(draw); };
  const onVis = () => { running = !document.hidden; if (running) { last = performance.now(); wake(); } else { cancelAnimationFrame(raf); raf = 0; } };
  let rT = 0;
  const onResize = () => { clearTimeout(rT); rT = setTimeout(resize, 150); };

  resize();
  c.style.opacity = '0';
  requestAnimationFrame(() => { c.style.transition = 'opacity .8s ease'; c.style.opacity = '1'; });
  last = performance.now(); wake();
  addEventListener('resize', onResize, { passive: true });
  addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerleave', onLeave);
  document.addEventListener('visibilitychange', onVis);
  return () => {
    running = false; cancelAnimationFrame(raf); c.remove();
    removeEventListener('resize', onResize); removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerleave', onLeave); document.removeEventListener('visibilitychange', onVis);
  };
}
function stopBackground() { if (bg) { bg(); bg = null; } }

/* ---------------- Glow cursor (dot + lagging ring) ---------------- */
let cur = null;
function startCursor() {
  if (cur || !fxOn() || touchOnly()) return;
  const dot = document.createElement('div'); dot.className = 'fx-dot';
  const ring = document.createElement('div'); ring.className = 'fx-ring';
  document.body.append(dot, ring);
  let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y, raf = 0;
  const move = (e) => {
    x = e.clientX; y = e.clientY;
    dot.style.transform = `translate(${x}px,${y}px)`;
    const hot = e.target.closest?.('a, button, input, select, textarea, .kpi, [data-i], .cal-ev, .kan-card, th, .legend button');
    ring.classList.toggle('hot', !!hot);
    ring.classList.toggle('text', !!e.target.closest?.('input, textarea'));
  };
  const down = () => ring.classList.add('down');
  const up = () => ring.classList.remove('down');
  const out = () => { dot.style.opacity = ring.style.opacity = 0; };
  const over = () => { dot.style.opacity = ring.style.opacity = ''; };
  const loop = () => { rx += (x - rx) * .18; ry += (y - ry) * .18; ring.style.transform = `translate(${rx}px,${ry}px)`; raf = requestAnimationFrame(loop); };
  loop();
  addEventListener('pointermove', move); addEventListener('pointerdown', down); addEventListener('pointerup', up);
  document.addEventListener('mouseleave', out); document.addEventListener('mouseenter', over);
  cur = () => { cancelAnimationFrame(raf); dot.remove(); ring.remove(); removeEventListener('pointermove', move); removeEventListener('pointerdown', down); removeEventListener('pointerup', up); document.removeEventListener('mouseleave', out); document.removeEventListener('mouseenter', over); };
}
function stopCursor() { if (cur) { cur(); cur = null; } }

/* ---------------- Scroll progress bar ---------------- */
function startProgress() {
  const bar = document.createElement('div'); bar.className = 'fx-progress'; document.body.appendChild(bar);
  const upd = () => { const h = document.documentElement.scrollHeight - innerHeight; bar.style.transform = `scaleX(${h > 0 ? scrollY / h : 0})`; };
  addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd();
}

/* ---------------- Success confetti on "ok" toasts ---------------- */
export function burst(x, y, n = 28) {
  if (!fxOn()) return;
  const colors = [accent(), '#169347', '#7FD8A8', '#F2A33A', '#4C8DFF', '#ffffff'];
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i'); p.className = 'fx-confetti';
    const ang = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 140;
    p.style.cssText = `left:${x}px;top:${y}px;background:${colors[i % colors.length]};--dx:${Math.cos(ang) * sp}px;--dy:${Math.sin(ang) * sp - 60}px;--rot:${Math.random() * 720 - 360}deg;animation-delay:${Math.random() * 60}ms`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1100);
  }
}
function watchToasts() {
  const root = document.getElementById('toast-root');
  if (!root) return;
  new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => {
    if (n.classList?.contains('ok')) { requestAnimationFrame(() => { const r = n.getBoundingClientRect(); burst(r.left + 24, r.top + r.height / 2); }); }
  }))).observe(root, { childList: true });
}

/* ---------------- Typewriter + live clock ---------------- */
export function typewrite(el, speed = 28) {
  if (!el || !fxOn()) return;
  const full = el.textContent; el.textContent = ''; el.classList.add('fx-typing');
  let i = 0;
  const step = () => { el.textContent = full.slice(0, ++i); if (i < full.length) setTimeout(step, speed); else setTimeout(() => el.classList.remove('fx-typing'), 900); };
  step();
}
export function startClock(el) {
  if (!el) return;
  const upd = () => { el.textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); };
  upd(); clearInterval(el._t); el._t = setInterval(() => { if (!el.isConnected) return clearInterval(el._t); upd(); }, 1000);
}

/* ---------------- Page transitions + skeleton loading ---------------- */
export function skeleton() {
  const blk = (h, w = '100%') => `<div class="sk" style="height:${h}px;width:${w}"></div>`;
  return `<div class="sk-wrap">
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:24px">${blk(34, '320px')}${blk(40, '220px')}</div>
    <div class="kpi-row">${blk(150).repeat(4)}</div>
    <div class="grid cols-2" style="margin-top:16px">${blk(300)}${blk(300)}</div></div>`;
}
export function leave(view) {
  if (!fxOn() || !view.firstElementChild || view.querySelector('.sk-wrap')) return Promise.resolve();
  view.classList.remove('view-enter'); view.classList.add('view-leave');
  return new Promise((r) => setTimeout(() => { view.classList.remove('view-leave'); r(); }, 170));
}

/* ---------------- Draggable, persistent dashboard widgets ---------------- */
export function sortable(container, key) {
  const widgets = () => [...container.querySelectorAll(':scope > [data-widget]')];
  // restore saved order
  try {
    const saved = JSON.parse(lsGet(key) || '[]');
    saved.forEach((id) => { const w = container.querySelector(`:scope > [data-widget="${id}"]`); if (w) container.appendChild(w); });
  } catch {}
  widgets().forEach((w) => {
    if (w.querySelector(':scope > .fx-handle')) return;
    const h = document.createElement('button');
    h.type = 'button'; h.className = 'fx-handle'; h.title = 'Drag to rearrange';
    h.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>';
    w.prepend(h);
    h.addEventListener('pointerdown', (e) => startDrag(e, w));
  });
  function flip(fn) {
    const first = new Map(widgets().map((w) => [w, w.getBoundingClientRect()]));
    fn();
    widgets().forEach((w) => {
      if (w.classList.contains('fx-dragging')) return;
      const a = first.get(w), b = w.getBoundingClientRect();
      const dy = a.top - b.top; if (!dy) return;
      w.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)' });
    });
  }
  function startDrag(e, w) {
    e.preventDefault();
    const r0 = w.getBoundingClientRect();
    const grab = e.clientY - r0.top;
    let ty = 0;
    w.classList.add('fx-dragging'); container.classList.add('fx-sorting');
    const place = (clientY) => {
      const naturalTop = w.getBoundingClientRect().top - ty;
      ty = clientY - grab - naturalTop;
      w.style.transform = `translateY(${ty}px) scale(1.01)`;
    };
    const move = (ev) => {
      const sibs = widgets().filter((x) => x !== w);
      for (const s of sibs) {
        const r = s.getBoundingClientRect(), mid = r.top + r.height / 2;
        const sIsBefore = w.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_PRECEDING;
        if (sIsBefore && ev.clientY < mid) { flip(() => container.insertBefore(w, s)); break; }
        if (!sIsBefore && ev.clientY > mid) { flip(() => container.insertBefore(w, s.nextSibling)); break; }
      }
      place(ev.clientY);
      if (ev.clientY < 60) scrollBy(0, -12); else if (ev.clientY > innerHeight - 60) scrollBy(0, 12);
    };
    const up = () => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', up);
      w.style.transition = 'transform .3s cubic-bezier(.2,.8,.2,1)'; w.style.transform = '';
      setTimeout(() => { w.style.transition = ''; w.classList.remove('fx-dragging'); container.classList.remove('fx-sorting'); }, 300);
      lsSet(key, JSON.stringify(widgets().map((x) => x.dataset.widget)));
      window.dispatchEvent(new Event('resize'));
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
  }
}
export function resetLayout(key) { try { localStorage.removeItem(key); } catch {} }

/* ---------------- Nav stagger ---------------- */
export function staggerNav() {
  if (!fxOn()) return;
  document.querySelectorAll('#nav a').forEach((a, i) => { a.style.animationDelay = `${Math.min(i, 30) * 18}ms`; a.classList.add('fx-nav-in'); });
}

/* ---------------- Boot ---------------- */
export function initFx() {
  startProgress();
  watchToasts();
  if (fxOn()) { startBackground(); startCursor(); }
  window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change', () => setFx(fxOn()));
}
