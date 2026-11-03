// Reveals:
// - headlines light up word by word with scroll (scrubbed);
// - mono labels fade in, then their text decodes left to right behind a caret;
// - supporting elements (.rv) fade and rise.
// Within a block the order is causal: label, headline, then the copy under it.
import { RM, qsa, clamp } from './util.js';
import { register, isRegistered } from './engine.js';

const RISE = 16;

// ---------- character decode (opacity and transform only) ----------
function build(el, str) {
  if (el._dc && el._dc.text === str) return el._dc;
  el.textContent = '';
  const sr = document.createElement('span');
  sr.className = 'sr';
  sr.textContent = str;
  const wrap = document.createElement('span');
  wrap.className = 'dc';
  wrap.setAttribute('aria-hidden', 'true');
  const chars = Array.from(str, (c) => {
    const s = document.createElement('span');
    s.className = 'ch';
    s.textContent = c;
    wrap.appendChild(s);
    return s;
  });
  const caret = document.createElement('i');
  caret.className = 'dc__caret';
  wrap.appendChild(caret);
  el.append(sr, wrap);
  el._dc = { text: str, chars, caret, wrap, tw: null };
  return el._dc;
}

// Decode text into place. Safe to call repeatedly; with reduced motion it just sets the text.
export function decode(el, text, { delay = 0, dur } = {}) {
  if (!el) return;
  const str = text != null ? text : el._dc ? el._dc.text : el.textContent;
  if (RM) { el.textContent = str; el._dc = null; return; }
  const d = build(el, str);
  const n = d.chars.length;
  if (d.tw) d.tw.kill();
  d.chars.forEach((c) => c.classList.remove('on'));
  const D = dur || Math.min(0.6, Math.max(0.3, n * 0.032));
  const p = { v: 0 };
  let cw = 0, k = 0;
  gsap.set(d.caret, { x: 0, opacity: 0 });
  d.tw = gsap.timeline({ delay })
    .call(() => { cw = d.wrap.getBoundingClientRect().width / Math.max(1, n); })
    .set(d.caret, { opacity: 0.28 })
    .to(p, {
      v: 1, duration: D, ease: 'springSoft',
      onUpdate() {
        const to = Math.min(n, Math.ceil(p.v * n));
        for (; k < to; k++) d.chars[k].classList.add('on');
        gsap.set(d.caret, { x: Math.min(p.v * n, n - 1) * cw });
      },
    })
    .to(d.caret, { opacity: 0, duration: 0.18, ease: 'springSoft' });
}

// Return decoded text to its hidden state (used when a label resets off screen).
function undecode(el) {
  if (!el || !el._dc) return;
  if (el._dc.tw) el._dc.tw.kill();
  el._dc.chars.forEach((c) => c.classList.remove('on'));
  gsap.set(el._dc.caret, { opacity: 0 });
}

// Wrap a label's own text so decoding never touches its index or status dot.
export function labelText(label) {
  let t = label.querySelector('.label__t');
  if (t) return t;
  for (const n of Array.from(label.childNodes)) {
    if (n.nodeType === 3 && n.textContent.trim()) {
      t = document.createElement('span');
      t.className = 'label__t';
      t.textContent = n.textContent;
      label.replaceChild(t, n);
      break;
    }
  }
  return t;
}

// ---------- fade-rise ----------
export function rise(el, delay = 0) {
  gsap.to(el, { opacity: 1, y: 0, duration: 0.8, ease: 'spring', delay, overwrite: true });
}
export function sink(el) {
  gsap.killTweensOf(el);
  gsap.set(el, { opacity: 0, y: RISE });
}

// ---------- the headline gradient, word by word ----------
// Headlines are set like the hero's (css/base.css): two lines, each a span of its own (.hl-1 lit
// mint into white, .hl-2 white), split here into words. Each word clips its own copy of its line's
// gradient, sized to the line's full width and shifted by the word's place in it, so the light runs
// across the line as one while every word still lights on its own (a gradient clipped to the whole
// line would lose any word whose opacity is changing). Re-measured whenever the page lays out
// again: late fonts, a resize.
function slice(words) {
  let l = Infinity, r = -Infinity;
  words.forEach((w) => { l = Math.min(l, w.offsetLeft); r = Math.max(r, w.offsetLeft + w.offsetWidth); });
  const width = Math.max(1, r - l);
  words.forEach((w) => {
    w.style.backgroundSize = width + 'px 100%';
    w.style.backgroundPosition = (l - w.offsetLeft) + 'px 0';
  });
}
function gradWords(words) {
  slice(words);
  ScrollTrigger.addEventListener('refresh', () => slice(words));
}

// Splits a headline into words, line by line, keeping its line spans; returns every word in
// reading order. Non-breaking spaces stay inside their word.
export function splitHeadline(el) {
  const lines = Array.from(el.querySelectorAll(':scope > .hl-1, :scope > .hl-2'));
  const boxes = lines.length ? lines : [el];
  const words = [];
  boxes.forEach((box) => {
    const parts = box.textContent.trim().split(/[ \t\r\n]+/);
    box.textContent = '';
    const line = parts.map((part, i) => {
      const w = document.createElement('span');
      w.className = 'w';
      w.textContent = part;
      box.appendChild(w);
      if (i < parts.length - 1) box.appendChild(document.createTextNode(' '));
      return w;
    });
    gradWords(line);
    words.push(...line);
  });
  return words;
}

// ---------- headlines that light up with scroll ----------
// Each word starts dim and brightens in turn as the headline scrolls into reading position.
// It is scrubbed, so the light follows the scroll in both directions.
export function lightUp(el, { start = 'top 88%', end = 'top 45%' } = {}) {
  const words = splitHeadline(el);
  el.classList.add('is-split');
  if (RM) return words;
  const set = (p) => {
    const k = p * words.length;
    words.forEach((w, i) => { w.style.opacity = (0.16 + 0.84 * clamp(k - i, 0, 1)).toFixed(3); });
  };
  set(0);
  ScrollTrigger.create({ trigger: el, start, end, scrub: true, onUpdate: (s) => set(s.progress), onRefresh: (s) => set(s.progress) });
  return words;
}

export function initReveals() {
  // Headlines light up with scroll.
  qsa('[data-split]').forEach((el) => {
    lightUp(el);
  });

  // Section labels: the index first, then the words decode.
  qsa('.label').filter((l) => !l.closest('.hero')).forEach((label) => {
    const t = labelText(label);
    const text = t ? t.textContent : '';
    register(label, {
      show(delay) {
        gsap.to(label, { opacity: 1, duration: 0.3, ease: 'springSoft', delay, overwrite: true });
        if (t) decode(t, text, { delay: delay + 0.06 });
      },
      hide() {
        gsap.killTweensOf(label);
        gsap.set(label, { opacity: 0 });
        undecode(t);
      },
      end() { gsap.set(label, { opacity: 1 }); },
    });
  });

  // Supporting elements.
  qsa('.rv').filter((el) => !el.closest('.hero') && !isRegistered(el)).forEach((el) => {
    register(el, {
      show: (delay) => rise(el, delay),
      hide: () => sink(el),
      end: () => gsap.set(el, { opacity: 1, y: 0 }),
    });
  });
}
