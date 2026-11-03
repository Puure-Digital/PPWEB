// The gap: two bars that look identical at summary level. Scroll zooms into the last
// 5% of hours, where the unverified 1.7% becomes impossible to miss.
// The zoom is transform only: the data layer scales about its right edge, and the
// stripes, the amber edge and the ruler labels counter-scale to keep their size.
// The finding (£1,008) waits until the zoom that justifies it is nearly complete.
import { RM, qs, qsa, DESKTOP } from './util.js';
import { setOd, odZero } from './odometer.js';

const CLAIMED = 1840;
const ZOOM_MAX = 20;
const AMOUNT = 1008;
// Ruler labels (hours, alignment). Each fades in once it has room and fades out near the
// left edge, so the ruler always reads as about three labels at any zoom. The right end is the
// zoom's fixed point, so its label never moves and sits outside the scaled layer.
const TICKS = [[0, 'l'], [920, 'c'], [1380, 'c'], [1610, 'c'], [1760, 'c'], [1800, 'c']];
const ramp = (v, a, b) => Math.min(1, Math.max(0, (v - a) / (b - a)));

export function initGap() {
  const sec = qs('#gap');
  const zoom = qs('#zoom');
  if (!sec || !zoom) return;
  const scales = qsa('.zrow__scale', zoom);
  const counter = qsa('.zrow__stripes, .zrow__edge', zoom);
  const ruler = qs('.zoom__ruler', zoom);
  const amt = qs('#z-amt');
  const zx = qs('#z-x');

  ruler.classList.add('is-scaled');
  ruler.innerHTML = '<div class="ruler__scale">' + TICKS.map(([h, a]) =>
    '<span class="rt rt--' + a + '" style="--x:' + (h / CLAIMED).toFixed(5) + '"><span>' + h.toLocaleString('en-GB') + ' h</span></span>').join('') + '</div>' +
    '<span class="rt-end">' + CLAIMED.toLocaleString('en-GB') + ' h</span>';
  const rscale = qs('.ruler__scale', ruler);
  const ticks = qsa('.rt', ruler).map((el, i) => ({ el, x: TICKS[i][0] / CLAIMED, a: TICKS[i][1] }));

  function apply(s) {
    const S = 'scaleX(' + s.toFixed(4) + ')';
    const inv = 'scaleX(' + (1 / s).toFixed(5) + ')';
    for (const el of scales) el.style.transform = S;
    rscale.style.transform = S;
    for (const el of counter) el.style.transform = inv;
    // The zoom factor reads like an instrument: one decimal until it reaches double figures.
    if (zx) zx.textContent = '×' + (s < 9.95 ? s.toFixed(1) : Math.round(s));
    for (const t of ticks) {
      const xv = 1 + s * (t.x - 1); // where the label sits in the visible window, 0–1
      const o = t.a === 'l' ? ramp(xv, -0.15, 0) : ramp(xv, 0.04, 0.12) * (1 - ramp(xv, 0.6, 0.7));
      t.el.style.transform = inv;
      t.el.style.opacity = o.toFixed(3);
    }
  }

  let zoomed = null;
  function setZoomed(z) {
    if (z === zoomed) return;
    zoomed = z;
    zoom.classList.toggle('is-zoomed', z);
    if (z) setOd(amt, AMOUNT, { delay: 0.12 });
    else odZero(amt);
  }

  setOd(amt, AMOUNT, { instant: true });
  if (RM) { apply(ZOOM_MAX); setZoomed(true); return; }
  odZero(amt);
  apply(1);
  zoomed = false;

  const state = { t: 0 };
  const zoomTween = () => gsap.to(state, {
    t: 1, duration: 1, ease: 'harmonic',
    onUpdate: () => { apply(Math.pow(ZOOM_MAX, state.t)); setZoomed(state.t > 0.82); },
  });

  // Scroll drives the zoom; scrub smoothing gives it a damped follow instead of a hard lock.
  const mm = gsap.matchMedia();
  mm.add(DESKTOP, () => {
    const tl = gsap.timeline();
    tl.add(zoomTween(), 0.18).set({}, {}, 1.35);
    ScrollTrigger.create({
      trigger: sec, start: 'top top', end: () => '+=' + Math.round(window.innerHeight * 1.3),
      pin: true, scrub: 0.6, animation: tl,
    });
  });
  mm.add('(max-width: 1023px)', () => {
    const tl = gsap.timeline();
    tl.add(zoomTween(), 0);
    ScrollTrigger.create({ trigger: zoom, start: 'top 72%', end: 'bottom 38%', scrub: 0.6, animation: tl });
  });
}
