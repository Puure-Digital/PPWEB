// The hero (css/sections.css): each part of its load reveal is handed back as it lands, back to its
// resting opacity and off its compositor layer; the trades band drifts only while the hero is on
// screen; and the film (720 wide, 0.46 MB; 540 on a phone, 0.21 MB) never competes with the first
// screen (see still()). Reduced motion and data saver keep its still.
// Then the panel comes alive: the figures count in as their cards land and the week's line draws
// itself; once all of it is up, the gate scan passes down the film on a loop (CSS, .hx-live); the
// cards lean toward a fine pointer at their own depths; and scrolled away, the hero comes apart in
// depth under the sheet that covers it (js/flow.js holds it in place).
import { qs, qsa, RM, FINE, DESKTOP, gbp } from './util.js';
import { live } from './engine.js';
import { springSoft, follow } from './motion.js';

const REVEALS = ['hx-reveal', 'hx-rise', 'hx-grow'];

// Counts a figure in from nothing on the spring, ending on exactly what the page says.
function count(el, to, fmt, dur = 900) {
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - t0) / dur);
    el.textContent = fmt(to * springSoft(p));
    if (p < 1) requestAnimationFrame(step);
  };
  el.textContent = fmt(0);
  requestAnimationFrame(step);
}

export function initHero() {
  const hero = qs('.hero');
  if (!hero) return;
  const chart = qs('.hx-chart', hero);

  if (RM) {
    qsa('[data-reveal]', hero).forEach((el) => el.classList.add('is-revealed'));
    if (chart) chart.classList.add('is-drawn');
  } else {
    hero.addEventListener('animationend', (e) => { if (REVEALS.includes(e.animationName)) e.target.classList.add('is-revealed'); }, true);
    // As each card lands: its figures count in, and the week's line draws itself, then the gate
    // scan starts its rounds. Where the cards land below the screen (a phone), each waits at zero
    // until it is in view, so the count is seen.
    // Each counts to what the page writes, in its form: £8,952, 48.0, 5%, 14 days.
    const figures = new Map(qsa('.hx-stat:not(.hx-stat--sep), .hx-value, .hx-fig', hero).map((el) => {
      const [, money, num, rest] = el.textContent.trim().match(/^(£?)([\d,.]+)(.*)$/);
      const dp = (num.split('.')[1] || '').length;
      return [el, { to: parseFloat(num.replace(/,/g, '')), fmt: (v) => (money ? gbp(v) : v.toFixed(dp)) + rest }];
    }));
    const run = (el) => {
      if (el === chart) {
        chart.classList.add('is-drawn');
        setTimeout(() => hero.classList.add('hx-live'), 1600);
      } else count(el, figures.get(el).to, figures.get(el).fmt);
    };
    const seen = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { seen.unobserve(e.target); run(e.target); } }), { threshold: 0.6 });
    hero.addEventListener('animationstart', (e) => {
      const el = e.target;
      if (e.animationName !== 'hx-reveal' || !(figures.has(el) || el === chart) || el._waits) return;
      el._waits = true;
      if (figures.has(el)) el.textContent = figures.get(el).fmt(0);
      seen.observe(el);
    }, true);
  }
  live(hero);

  const film = qs('.hx-video', hero);
  if (!RM) {
    lean(hero, film);
    depth(hero);
    feed(hero);
  }

  if (film) still(film, qs('.hx-glow', hero));
}

// The film's still (a light WebP, cut to match the film: the phone's is smaller) goes up at once;
// the film waits for the page. On a wide screen, where the panel stands beside the headline, it
// plays once the page has loaded, while the panel is on screen. On a phone the panel sits under the
// headline, so the film waits until at least half of it is in view: a phone that never looks at it
// never fetches it. Reduced motion and data saver keep the still.
function still(film, glow) {
  const wide = window.matchMedia(DESKTOP).matches;
  const loaded = (fn) => (document.readyState === 'complete' ? fn() : window.addEventListener('load', fn, { once: true }));
  const cut = film.querySelector('source[media]');
  const src = (cut && window.matchMedia(cut.media).matches && film.dataset.posterM) || film.dataset.poster;
  if (src) film.setAttribute('poster', src);
  const saver = navigator.connection && navigator.connection.saveData;
  const moves = !RM && !saver;
  film.muted = true;
  // A browser that will not autoplay keeps the still; nothing to report.
  const play = () => { const p = film.play(); if (p && p.catch) p.catch(() => {}); };
  if (!moves) return;
  loaded(() => {
    if (wide) live(glow, play, () => film.pause());
    else new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? play() : film.pause())), { threshold: 0.5 }).observe(glow);
  });
}

// The panel answers a fine pointer anywhere over the hero: each card leans toward it (the invoice
// line nearer, so it moves more), a soft light crosses its glass where the pointer is, the film
// behind shifts the other way and the light from above follows. Live springs, so a quick pass never
// jerks; transform only.
function lean(hero, film) {
  if (!FINE) return;
  const wide = window.matchMedia(DESKTOP);
  const cards = qsa('.hx-card', hero), floats = qs('.hx-feed', hero);
  if (!cards.length) return;
  let queued = false;
  const render = () => {
    queued = false;
    const x = fx.value, y = fy.value, on = fo.value;
    cards.forEach((c, i) => {
      const d = i ? 0.6 : 1;
      c.style.transform = 'perspective(1100px) translate3d(' + (x * 16 * d).toFixed(2) + 'px,' + (y * 12 * d).toFixed(2) + 'px,0) rotateX(' + (-y * 6 * d).toFixed(2) + 'deg) rotateY(' + (x * 9 * d).toFixed(2) + 'deg)';
      c.style.setProperty('--mx', (50 + x * 60).toFixed(1) + '%');
      c.style.setProperty('--my', (40 + y * 60).toFixed(1) + '%');
      c.style.setProperty('--sheen', on.toFixed(3));
    });
    if (floats) floats.style.transform = 'translate3d(' + (x * 24).toFixed(2) + 'px,' + (y * 16).toFixed(2) + 'px,0)';
    if (film) film.style.transform = 'translate3d(' + (-x * 14).toFixed(2) + 'px,' + (-y * 10).toFixed(2) + 'px,0) scale(1.06)';
    // The light from above leans the same way, over the words.
    hero.style.setProperty('--lx', (x * 7).toFixed(2) + 'vw');
  };
  const draw = () => { if (!queued) { queued = true; requestAnimationFrame(render); } };
  const fx = follow(draw, { response: 0.7 }), fy = follow(draw, { response: 0.7 }), fo = follow(draw, { response: 0.5 });
  hero.addEventListener('pointermove', (e) => {
    if (!wide.matches || e.pointerType !== 'mouse') return;
    const r = hero.getBoundingClientRect();
    fx.to(Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1)));
    fy.to(Math.max(-1, Math.min(1, ((e.clientY - r.top) / Math.min(r.height, window.innerHeight)) * 2 - 1)));
    fo.to(1);
  });
  hero.addEventListener('pointerleave', () => { fx.to(0); fy.to(0); fo.to(0); });
  wide.addEventListener('change', () => { fx.jump(0); fy.jump(0); fo.jump(0); cards.forEach((c) => { c.style.transform = ''; }); if (floats) floats.style.transform = ''; if (film) film.style.transform = ''; hero.style.removeProperty('--lx'); });
}

// The live feed: on each pass of the gate scan (its CSS loop's own clock, so they never drift), the
// next worker through the gate drops in over the invoice line, verified or held, and lifts away
// before the next pass. The same workers, times and holds as the invoice further down.
const FEED = [
  ['W-0412 verified', 'Groundworks · Terminal 2 · {t}'],
  ['W-0877 held', '2.5 h over the terminal · £75 held', true],
  ['W-1034 verified', 'M&E · Terminal 2 · {t}'],
  ['W-1188 held', 'No terminal scan all week · £880 held', true],
  ['W-0655 verified', 'Scaffolding · Terminal 1 · {t}'],
  ['W-0903 verified', 'Carpentry · Terminal 2 · {t}'],
  ['W-0348 held', 'Left 15:00 on Friday · £84 held', true],
  ['W-1120 verified', 'Dry lining · Terminal 1 · {t}'],
];
function feed(hero) {
  const toast = qs('.hx-toast', hero), scan = qs('.hx-scan', hero);
  if (!toast || !scan) return;
  const t = qs('.hx-toast__t', toast), s = qs('.hx-toast__s', toast);
  let i = 0, clock = 7 * 60 + 39, timers = [];
  const show = () => {
    const [title, sub, held] = FEED[i % FEED.length];
    clock += 1 + (i % 3);
    i++;
    const at = String(Math.floor(clock / 60)).padStart(2, '0') + ':' + String(clock % 60).padStart(2, '0');
    toast.classList.toggle('is-held', !!held);
    t.textContent = title;
    s.textContent = sub.replace('{t}', at);
    toast.classList.add('is-in');
    timers.push(setTimeout(() => toast.classList.remove('is-in'), 4300));
  };
  // The scan reaches the invoice line about 0.7 s into each pass.
  const pass = (e) => { if (e.animationName !== 'hx-scan') return; timers.forEach(clearTimeout); toast.classList.remove('is-in'); timers = [setTimeout(show, 700)]; };
  scan.addEventListener('animationstart', pass);
  scan.addEventListener('animationiteration', pass);
}

// Scrolled away: the panel rises faster than the words while the facts come up over the hero.
// Back at rest whenever ScrollTrigger measures, so nothing it reads is displaced.
function depth(hero) {
  const out = (p) => hero.style.setProperty('--hx-out', p.toFixed(4));
  ScrollTrigger.addEventListener('refreshInit', () => out(0));
  ScrollTrigger.create({ trigger: hero, start: 'top top', end: 'bottom top', onUpdate: (s) => out(s.progress), onRefresh: (s) => out(s.progress) });
}
