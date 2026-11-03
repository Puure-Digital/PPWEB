// The sections flow into one another. The next section comes up over the one before it like a
// sheet: the one before holds its place beneath it, settles back and dims, and the sheet's top
// corners flatten as it lands. A dark band coming over a light section also widens from a card to
// the full page as it rises. Between two light sections, the one before just drifts back under the
// next. Scrubbed, so it follows the scroll both ways; it moves transforms, opacity and one clip,
// and only while a section is handing over. Reduced motion: plain edges.
import { RM, qsa, clamp } from './util.js';

const KINDS = {
  // Onto a light section from a dark one, or from dark to dark: a sheet over the section before.
  sheet: { hold: 0.9, scale: 0.94, veil: 0.6, round: true, widen: false, under: true },
  // Light to dark: a dark band rising as a card that widens to the page.
  rise: { hold: 0.9, scale: 0.95, veil: 0.18, round: true, widen: true, under: true },
  // Light to light: the one before drifts back under the next.
  drift: { hold: 0.35, scale: 0.985, veil: 0, round: false, widen: false, under: false },
};

const isLight = (el) => el.classList.contains('light');

export function initFlow() {
  if (RM) return;
  const main = document.querySelector('main');
  if (!main) return;
  let secs = qsa(':scope > section, :scope > .pin-spacer > section', main);
  if (!secs.length) secs = [main];
  const foot = document.querySelector('body > .foot');
  if (foot) secs.push(foot);
  if (secs.length < 2) return;

  // Each section is a layer above the one before, opaque, so what it covers stays covered.
  secs.forEach((s, i) => {
    const cs = getComputedStyle(s);
    if (cs.position === 'static') s.style.position = 'relative';
    s.style.zIndex = String(i + 1);
    if (cs.backgroundColor === 'rgba(0, 0, 0, 0)' || cs.backgroundColor === 'transparent') s.style.backgroundColor = isLight(s) ? '#F3F4F4' : '#010101';
  });

  const body = document.body;
  const flows = [];
  for (let i = 1; i < secs.length; i++) {
    const a = secs[i - 1], b = secs[i];
    const kind = isLight(a) && isLight(b) ? 'drift' : isLight(a) ? 'rise' : 'sheet';
    const k = Object.assign({}, KINDS[kind]);
    if (a.classList.contains('hero')) k.hold = 1;
    const veil = document.createElement('i');
    veil.className = 'flow-veil';
    veil.setAttribute('aria-hidden', 'true');
    a.appendChild(veil);
    const kids = Array.from(a.children).filter((c) => c !== veil && !c.classList.contains('flow-veil'));
    flows.push({ a, b, k, veil, kids, base: '', p: -1 });
  }

  let vh = window.innerHeight;
  const measure = (f) => {
    vh = window.innerHeight;
    // The colour under a handover (seen at the sheet's corners and beside a widening band) is the
    // colour of the section it covers.
    f.base = getComputedStyle(f.a).backgroundColor;
    // A section shorter than the screen is in full view as the next one comes, so it just carries
    // on; a taller one settles back about the middle of what is on screen, its last screenful.
    f.short = f.a.offsetHeight < vh * 0.9;
    const mid = f.a.offsetHeight - vh / 2;
    f.origins = f.kids.map((c) => clamp(mid - c.offsetTop, 0, c.offsetHeight) + 'px');
  };

  function clear(f) {
    f.kids.forEach((c) => { c.style.translate = ''; c.style.scale = ''; c.style.transformOrigin = ''; });
    f.veil.style.opacity = '0';
    f.veil.style.visibility = 'hidden';
    f.b.style.borderTopLeftRadius = f.b.style.borderTopRightRadius = '';
    f.b.style.clipPath = '';
  }

  function apply(f, p) {
    if (p === f.p) return;
    f.p = p;
    const { k } = f;
    if (p <= 0 || p >= 1) {
      clear(f);
      if (k.under && body.style.backgroundColor === f.base) body.style.backgroundColor = '';
      return;
    }
    // The section below rises a screen; the one it covers moves back down by most of that, so it
    // holds nearly still under it, and settles back and dims as it goes.
    if (!f.short) {
      const y = (k.hold * p * vh).toFixed(1) + 'px';
      const s = (1 - (1 - k.scale) * p).toFixed(4);
      f.kids.forEach((c, j) => { c.style.transformOrigin = '50% ' + f.origins[j]; c.style.translate = '0 ' + y; c.style.scale = s; });
      const v = k.veil * Math.pow(p, 1.2);
      f.veil.style.visibility = v > 0.002 ? 'visible' : 'hidden';
      f.veil.style.opacity = v.toFixed(3);
    }
    if (k.under && body.style.backgroundColor !== f.base) body.style.backgroundColor = f.base;
    if (k.round) {
      // The corners stay round for most of the rise and flatten as the sheet lands.
      const R = clamp(vh * 0.05, 20, 44) * (1 - p * p);
      if (k.widen) {
        const x = clamp(window.innerWidth * 0.028, 10, 40) * Math.pow(1 - p, 1.4);
        f.b.style.clipPath = 'inset(0 ' + x.toFixed(1) + 'px round ' + R.toFixed(1) + 'px ' + R.toFixed(1) + 'px 0 0)';
      } else {
        f.b.style.borderTopLeftRadius = f.b.style.borderTopRightRadius = R.toFixed(1) + 'px';
      }
    }
  }

  // Before ScrollTrigger lays the page out again, every section returns to rest, so nothing it
  // measures is displaced; each handover then picks up where the scroll is.
  ScrollTrigger.addEventListener('refreshInit', () => flows.forEach((f) => { f.p = -1; clear(f); }));
  // A handover runs from the next section's top entering the screen to it reaching the top, within
  // what the page can scroll: a section already in view when the page opens has none, and one the
  // page cannot scroll to the top (a footer shorter than the screen) lands at the end of the page.
  const range = (f, self) => {
    const s0 = Math.max(self.start, 0), s1 = Math.min(self.end, ScrollTrigger.maxScroll(window));
    f.on = self.start > -0.2 * vh && s1 - s0 > vh * 0.25;
    f.s0 = s0;
    f.span = Math.max(1, s1 - s0);
  };
  const at = (f, self) => (f.on ? clamp((self.scroll() - f.s0) / f.span, 0, 1) : 1);
  flows.forEach((f) => {
    measure(f);
    clear(f);
    ScrollTrigger.create({
      trigger: f.b, start: 'top bottom', end: 'top top',
      onUpdate: (self) => apply(f, at(f, self)),
      onRefresh: (self) => { measure(f); range(f, self); apply(f, at(f, self)); },
    });
  });
}
