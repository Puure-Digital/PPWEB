// Footer: the last instrument.
// - The hero's grid behind everything (the grid itself is CSS, .foot::after; this canvas draws only
//   what is lit). Crossings near the pointer light up emerald, following it on a damped ease; a slow
//   scan crosses the field every few seconds. Drawn only while the footer is on screen, and with a
//   fine pointer only for the pointer part.
// - The shield, large, centred and lit, running off the foot of the page: a scan of light crosses
//   it as the page reaches its end (back again if the reader scrolls up past it), then Verified.
// - A live London clock, and a back-to-top control whose ring shows how far down the page you are.
// Reduced motion: no lit points or scan; the shield is shown verified.
import { RM, FINE, qs, qsa, clamp, copyText, confirmCopy } from './util.js';
import { live } from './engine.js';

const GAP = 94;          // must match the CSS grid (.foot::after background-size)
const REACH = 240;       // pointer radius, px
const SWEEP = 7;         // seconds for the scan to cross the field

function field(foot) {
  const cv = qs('.foot__field', foot);
  if (!cv || RM) return;
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1, running = false, t0 = 0;
  const ptr = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4, on: 0, ton: 0 };

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = foot.clientWidth;
    H = foot.clientHeight;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  // One lit crossing: a small cross of light on the grid's lines, longer and brighter the stronger
  // it is lit, with a point where the lines meet.
  function dot(x, y, g) {
    const arm = 6 + g * 16, s = 1.6 + g * 1.4;
    ctx.globalAlpha = Math.min(1, 0.08 + g * 0.6);
    ctx.fillRect(x - arm, y, arm * 2, 1);
    ctx.fillRect(x, y - arm, 1, arm * 2);
    ctx.globalAlpha = Math.min(1, 0.15 + g * 0.85);
    ctx.fillRect(x + 0.5 - s / 2, y + 0.5 - s / 2, s, s);
  }
  function frame() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0FD76A';
    // The pointer, eased toward where it is.
    ptr.x += (ptr.tx - ptr.x) * 0.18;
    ptr.y += (ptr.ty - ptr.y) * 0.18;
    ptr.on += (ptr.ton - ptr.on) * 0.12;
    const lit = new Map();
    if (ptr.on > 0.01) {
      const c0 = Math.max(0, Math.floor((ptr.x - REACH) / GAP)), c1 = Math.floor((ptr.x + REACH) / GAP);
      const r0 = Math.max(0, Math.floor((ptr.y - REACH) / GAP)), r1 = Math.floor((ptr.y + REACH) / GAP);
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const x = c * GAP, y = r * GAP;
          const d = Math.hypot(x - ptr.x, y - ptr.y);
          if (d < REACH) { const k = 1 - d / REACH; lit.set(r * 10000 + c, [x, y, k * k * ptr.on]); }
        }
      }
    }
    // The scan: a soft band of light crossing the field, left to right.
    const ph = (((performance.now() - t0) / 1000) % SWEEP) / SWEEP;
    const sx = -160 + ph * (W + 320), band = 120;
    const s0 = Math.max(0, Math.floor((sx - band) / GAP)), s1 = Math.floor((sx + band) / GAP);
    const rows = Math.ceil(H / GAP);
    for (let c = s0; c <= s1; c++) {
      const x = c * GAP;
      const k = 1 - Math.abs(x - sx) / band;
      if (k <= 0 || x > W) continue;
      for (let r = 0; r < rows; r++) {
        const key = r * 10000 + c, prev = lit.get(key), g = k * k * 0.42;
        if (!prev || prev[2] < g) lit.set(key, [x, r * GAP, g]);
      }
    }
    lit.forEach(([x, y, g]) => dot(x, y, g));
    ctx.globalAlpha = 1;
  }
  const tick = () => frame();
  function start() {
    if (running) return;
    running = true;
    size();
    if (!t0) t0 = performance.now();
    gsap.ticker.add(tick);
  }
  function stop() {
    if (!running) return;
    running = false;
    gsap.ticker.remove(tick);
    ctx.clearRect(0, 0, W, H);
  }
  live(foot, start, stop);
  window.addEventListener('resize', () => { if (running) size(); });
  if (FINE) {
    foot.addEventListener('pointermove', (e) => {
      const b = foot.getBoundingClientRect();
      ptr.tx = e.clientX - b.left;
      ptr.ty = e.clientY - b.top;
      if (ptr.on < 0.01) { ptr.x = ptr.tx; ptr.y = ptr.ty; }
      ptr.ton = 1;
    });
    foot.addEventListener('pointerleave', () => { ptr.ton = 0; });
  }
}

function mark(foot) {
  const m = qs('.foot__mark', foot);
  if (!m) return;
  const scan = qs('.foot__scan', m), tag = qs('.foot__tag', m);

  // The shield is lit from the start; a scan of light crosses it, fading in and out at the edges.
  const set = (p) => gsap.set(scan, { xPercent: p * 100, opacity: clamp(p / 0.04, 0, 1) * clamp((1 - p) / 0.04, 0, 1) });
  if (RM) {
    gsap.set(tag, { opacity: 1, y: 0 });
    return;
  }
  set(0);
  // The page cannot scroll past its end, so the scan plays in time once the shield is in view
  // (and runs back if the reader scrolls up past it): the scan crosses, then Verified lands.
  const st = { p: 0 };
  const tl = gsap.timeline({ paused: true })
    .to(st, { p: 1, duration: 1.4, ease: 'springSoft', onUpdate: () => set(st.p) }, 0)
    .to(tag, { opacity: 1, y: 0, duration: 0.45, ease: 'spring' }, 1.05);
  ScrollTrigger.create({
    trigger: m, start: 'top 96%',
    onEnter: () => tl.timeScale(1).play(),
    onLeaveBack: () => tl.timeScale(1.6).reverse(),
  });
}

// The email copies in one press; the icon turns to a tick for a moment.
function copy(foot) {
  qsa('[data-copy]', foot).forEach((b) => b.addEventListener('click', () => {
    copyText(b.dataset.copy).then((ok) => { if (ok) confirmCopy(b, null, b.nextElementSibling, 'Email address copied', ''); });
  }));
}

function clock(foot) {
  const el = qs('[data-clock]', foot);
  if (!el) return;
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const tick = () => { el.textContent = fmt.format(new Date()); };
  tick();
  let timer = 0;
  const run = () => { tick(); clearInterval(timer); timer = setInterval(tick, 1000); };
  if (RM) { setInterval(tick, 1000); return; }
  live(foot, run, () => clearInterval(timer));
}

function ring(foot) {
  const fg = qs('.foot__ring-fg', foot);
  if (!fg) return;
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: (self) => { fg.style.strokeDashoffset = (1 - self.progress).toFixed(4); },
    onRefresh: (self) => { fg.style.strokeDashoffset = (1 - self.progress).toFixed(4); },
  });
}

export function initFoot() {
  const foot = qs('.foot');
  if (!foot) return;
  field(foot);
  mark(foot);
  clock(foot);
  ring(foot);
  copy(foot);
}
