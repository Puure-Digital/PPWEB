// Shared helpers.
// ?motion=reduce forces the reduced-motion path for QA.
export const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]motion=reduce\b/.test(window.location.search);
export const FINE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
export const DESKTOP = '(min-width: 1024px)';
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const qs = (s, el = document) => el.querySelector(s);
export const qsa = (s, el = document) => Array.from(el.querySelectorAll(s));
export const gbp = (n) => '£' + Math.round(n).toLocaleString('en-GB');

// Copies text: the async clipboard where the page may use it, else a hidden selection. Resolves
// true once copied, false when the browser would not.
export function copyText(text) {
  const legacy = () => {
    const t = document.createElement('textarea');
    t.value = text;
    t.setAttribute('readonly', '');
    t.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    const back = document.activeElement;
    document.body.appendChild(t);
    t.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { /* nothing to copy with */ }
    t.remove();
    if (back && back.focus) back.focus();
    return ok;
  };
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(() => true, legacy);
  return Promise.resolve(legacy());
}

// A copy button's confirmation: the icon turns to a tick and the label (and a live region) says
// so for a moment, then both return.
export function confirmCopy(btn, label, said, done, rest) {
  btn.classList.add('is-copied');
  if (label) label.textContent = done;
  if (said) said.textContent = done;
  clearTimeout(btn._copied);
  btn._copied = setTimeout(() => { btn.classList.remove('is-copied'); if (label) label.textContent = rest; if (said) said.textContent = ''; }, 2400);
}
