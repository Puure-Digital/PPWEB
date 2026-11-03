// Entry engine: decides when things build, so every section follows the same rules.
// - An element plays once it is 25% into the viewport (the middle band), so motion
//   lands while it is being looked at, not ahead of the reader.
// - It plays at most once per scroll direction. It resets only when fully off screen,
//   and only if the direction it will come back from has not played yet.
// - Elements that arrive together are staggered in document order, 80 ms apart.
// - Anything still waiting in view when scrolling stops, or at the end of the page,
//   plays then, so nothing sits blank on screen.
// Hidden states use opacity and transform only, so content stays focusable; focusing
// something that has not played yet plays it at once.
// live() reports whether a section is on screen, to run or pause its ambient motion.
import { RM } from './util.js';
import { STEP } from './motion.js';

const FLOOR = 0.06, SPREAD = 0.64;
const recs = new Map();
const lives = new Map();
let band = null, view = null, liveIO = null, queue = [], queued = false, idle = 0;

const spanOf = (r) => Math.max(1, typeof r.span === 'function' ? r.span() : r.span);

function flush() {
  queued = false;
  const batch = queue.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  queue = [];
  const steps = batch.reduce((n, r) => n + spanOf(r), 0);
  const step = Math.max(FLOOR, Math.min(STEP, SPREAD / Math.max(1, steps - 1)));
  let t = 0;
  for (const r of batch) { r.show(t); t += step * spanOf(r); }
}

function enter(r, dir) {
  if (r.shown) return;
  r.shown = true;
  r.played[dir] = true;
  queue.push(r);
  if (!queued) { queued = true; requestAnimationFrame(flush); }
}

function leave(r, side) {
  const next = side === 'top' ? 'up' : 'down';
  if (!r.shown || r.played[next]) return;
  r.shown = false;
  r.hide();
}

function sweep() {
  const vh = window.innerHeight;
  recs.forEach((r) => {
    if (r.shown) return;
    const b = r.el.getBoundingClientRect();
    if (b.width && b.top < vh - 1 && b.bottom > 1) enter(r, b.top + b.bottom > vh ? 'down' : 'up');
  });
}

function onScroll() {
  clearTimeout(idle);
  idle = setTimeout(sweep, 600);
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) sweep();
}

function ensure() {
  if (band) return;
  band = new IntersectionObserver((entries) => {
    const vh = window.innerHeight;
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const r = recs.get(e.target);
      if (r) enter(r, e.boundingClientRect.top + e.boundingClientRect.bottom > vh ? 'down' : 'up');
    }
  }, { rootMargin: '-25% 0px -25% 0px', threshold: 0 });
  view = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) continue;
      const r = recs.get(e.target);
      if (r) leave(r, e.boundingClientRect.bottom <= 0 ? 'top' : 'bottom');
    }
  }, { threshold: 0 });
  window.addEventListener('scroll', onScroll, { passive: true });
  // Anything already in view when the page opens plays once the page has settled.
  const settle = () => setTimeout(sweep, 300);
  if (document.readyState === 'complete') settle();
  else window.addEventListener('load', settle, { once: true });
  document.addEventListener('focusin', (e) => {
    for (let n = e.target; n && n !== document.body; n = n.parentElement) {
      const r = recs.get(n);
      if (r && !r.shown) enter(r, 'down');
    }
  });
}

// show(delay) plays the entry; hide() returns to the hidden state; end() renders the
// finished state with no motion (reduced motion). span = how many stagger steps it uses.
export function register(el, { show, hide, end, span = 1 }) {
  if (!el || recs.has(el)) return;
  if (RM) { (end || show)(0); return; }
  ensure();
  recs.set(el, { el, show, hide, span, shown: false, played: { down: false, up: false } });
  band.observe(el);
  view.observe(el);
}

export const isRegistered = (el) => recs.has(el);

// Ambient motion runs only while its section is on screen.
export function live(el, on, off) {
  if (!el || RM) return;
  if (!liveIO) {
    liveIO = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const l = lives.get(e.target);
        if (!l || l.on === e.isIntersecting) continue;
        l.on = e.isIntersecting;
        e.target.classList.toggle('is-live', l.on);
        for (const fn of l.fns) (l.on ? fn.on : fn.off)();
      }
    }, { threshold: 0 });
  }
  let l = lives.get(el);
  if (!l) { l = { on: false, fns: [] }; lives.set(el, l); liveIO.observe(el); }
  if (on || off) {
    const fn = { on: on || (() => {}), off: off || (() => {}) };
    l.fns.push(fn);
    if (l.on) fn.on();
  }
  return () => l.on;
}

export function initLive() {
  document.querySelectorAll('[data-live]').forEach((el) => live(el));
}
