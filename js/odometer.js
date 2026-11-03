// Odometer figures: every digit is its own 0–9 strip. Strips start one after another,
// left to right, and decelerate into place on the soft spring, so a figure counts in
// digit by digit instead of ticking a single value. Transform only.
import { RM } from './util.js';
import { register } from './engine.js';

function fmt(el, value) {
  const decimals = parseInt(el.dataset.decimals || '0', 10);
  const parts = Math.abs(value).toFixed(decimals).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (el.dataset.prefix || '') + parts.join('.') + (el.dataset.suffix || '');
}

// The strips and symbols are drawn by CSS (generated content), so the figure's only text is a
// visually hidden copy of its value: screen readers, search and copy-paste read "£82bn", not the
// digits 0 to 9 of every strip.
function build(el, str) {
  el.textContent = '';
  let k = 0;
  for (const ch of str) {
    const part = document.createElement('span');
    part.setAttribute('aria-hidden', 'true');
    if (/\d/.test(ch)) {
      part.className = 'od__d';
      const s = document.createElement('span');
      s.className = 'od__s';
      s.style.setProperty('--k', k++);
      part.appendChild(s);
    } else part.dataset.c = ch;
    el.appendChild(part);
  }
  el._odSr = el.appendChild(document.createElement('span'));
  el._odSr.className = 'sr';
  el._odShape = str.replace(/\d/g, '0');
}

function freeze(el) {
  el.classList.add('od--now');
  void el.offsetWidth;
  requestAnimationFrame(() => el.classList.remove('od--now'));
}

// opts: instant (no motion), delay (s), dur (s per digit), step (s between digits).
export function setOd(el, value, opts = {}) {
  if (!el) return;
  const o = typeof opts === 'boolean' ? { instant: opts } : opts;
  const str = fmt(el, value);
  if (el._odShape !== str.replace(/\d/g, '0')) {
    build(el, str);
    // New strips need a computed start (0) before their target, or they would jump.
    if (!o.instant && !RM) void el.offsetWidth;
  }
  el.style.setProperty('--od-delay', (o.delay || 0) + 's');
  el.style.setProperty('--od-dur', (o.dur || 0.9) + 's');
  el.style.setProperty('--od-step', (o.step == null ? 0.05 : o.step) + 's');
  const strips = el.querySelectorAll('.od__s');
  let k = 0;
  for (const ch of str) if (/\d/.test(ch)) strips[k++].style.setProperty('--d', ch);
  el._odSr.textContent = str;
  el._odValue = value;
  if (o.instant || RM) freeze(el);
}

// Roll every digit back to zero without changing the figure's shape.
export function odZero(el, instant = true) {
  if (!el) return;
  el.querySelectorAll('.od__s').forEach((s) => s.style.setProperty('--d', 0));
  if (instant) freeze(el);
}

// Static odometers render their value now. Others count in when they enter the view.
export function mountOdometers() {
  document.querySelectorAll('.od').forEach((el) => {
    if (el._odShape !== undefined) return;
    const target = parseFloat(el.dataset.od || '0');
    if (el.hasAttribute('data-static') || RM) { setOd(el, target, { instant: true }); return; }
    setOd(el, target, { instant: true });
    odZero(el);
    register(el, {
      show: (delay) => setOd(el, target, { delay }),
      hide: () => odZero(el),
      end: () => setOd(el, target, { instant: true }),
    });
  });
}
