// Graphs. Governance: what happens to biometric data across one contract. Pilot: claims
// held for query across a 90-day pilot, at the spend set in the calculator.
// Both are light instruments that draw with scroll (scrubbed) behind a playhead, in causal
// order: frame, then data, then the labelled result, and undraw on the way back. Every data
// mark settles on the critically damped spring, so no value ever overshoots, and a change
// of spend re-targets from wherever the chart is, mid-motion included. The pilot chart
// can be scrubbed: a crosshair follows the pointer 1:1, snaps to whole days and takes the
// readout while it does.
import { RM, qs, qsa, gbp, clamp } from './util.js';
import { springSoftAt } from './motion.js';
import { RATE, DAYS, LIVE, heldBy90, spendNow } from './calc.js';

// ---------- governance: one contract, three lanes ----------
// A playhead runs the contract from onboarding to its end, scrubbed by scroll. Consent is given
// at the start, the encrypted template is held behind the playhead, it is deleted where the
// contract ends, and the third-party lane stays empty the whole way. A state readout follows.
function govChart() {
  const fig = qs('#gchart');
  if (!fig) return;
  const cap = qs('.chart__cap', fig);
  const states = qsa('.gchart__state span', fig);
  const keys = qsa('.gchart__k', fig);
  const labs = qsa('.gchart__lab', fig);
  const pt = qs('.gchart__pt', fig), ping = qs('.gchart__ping', fig);
  const bar = qs('.gchart__bar', fig), del = qs('.gchart__del', fig), end = qs('.gchart__end', fig);
  const phs = qsa('.gchart__ph', fig);
  const axis = qs('.gchart__axis', fig), note = qs('.chart__note', fig);
  if (RM) return;
  gsap.set([cap, axis, note, end, ...keys, ...labs, ...states], { opacity: 0 });
  gsap.set(bar, { scaleX: 0 });
  gsap.set(pt, { opacity: 0, scale: 0.4 });
  gsap.set(ping, { opacity: 0, scale: 1 });
  gsap.set(del, { opacity: 0, scale: 0.5 });
  gsap.set(phs, { opacity: 0, xPercent: 0 });
  gsap.set(end, { x: -8 });
  gsap.set(fig, { opacity: 0, y: 24 });

  const T0 = 0.5, RUN = 1.1, END = T0 + RUN;
  const tl = fig._tl = gsap.timeline({ paused: true }) // fig._tl: QA handle
    .to(fig, { opacity: 1, y: 0, duration: 0.4, ease: 'spring' }, 0)
    // The frame: caption, lane names, the contract axis.
    .to(cap, { opacity: 1, duration: 0.3, ease: 'springSoft' }, 0.12)
    .to([...keys, axis], { opacity: 1, duration: 0.35, ease: 'springSoft', stagger: 0.06 }, 0.18)
    // Onboarding: consent is given.
    .to(states[0], { opacity: 1, duration: 0.2, ease: 'springSoft' }, 0.3)
    .to(pt, { opacity: 1, scale: 1, duration: 0.45, ease: 'spring' }, 0.34)
    .set(ping, { opacity: 0.8, scale: 1 }, 0.38)
    .to(ping, { opacity: 0, scale: 2.6, duration: 0.6, ease: 'springSoft' }, 0.38)
    .to(labs[0], { opacity: 1, duration: 0.3, ease: 'springSoft' }, 0.42)
    // The contract runs: the template is held behind the playhead.
    .to(phs, { opacity: 1, duration: 0.12, ease: 'springSoft' }, T0)
    .to(phs, { xPercent: 100, duration: RUN, ease: 'springSoft' }, T0)
    .to(bar, { scaleX: 1, duration: RUN, ease: 'springSoft' }, T0)
    .to(states[0], { opacity: 0, duration: 0.2, ease: 'springSoft' }, T0 + 0.1)
    .to(states[1], { opacity: 1, duration: 0.2, ease: 'springSoft' }, T0 + 0.16)
    .to(labs[1], { opacity: 1, duration: 0.3, ease: 'springSoft' }, T0 + 0.3)
    // The contract ends: the template is deleted, and nothing was ever shared.
    .to(phs, { opacity: 0, duration: 0.15, ease: 'springSoft' }, END)
    .to(states[1], { opacity: 0, duration: 0.2, ease: 'springSoft' }, END)
    .to(del, { opacity: 1, scale: 1, duration: 0.45, ease: 'spring' }, END)
    .to(states[2], { opacity: 1, duration: 0.2, ease: 'springSoft' }, END + 0.06)
    .to(end, { opacity: 1, x: 0, duration: 0.45, ease: 'spring' }, END + 0.05)
    .to(labs[2], { opacity: 1, duration: 0.3, ease: 'springSoft' }, END + 0.1)
    .to(note, { opacity: 1, duration: 0.3, ease: 'springSoft' }, END + 0.2);
  ScrollTrigger.create({ trigger: fig, start: 'top 85%', end: 'top 25%', scrub: 0.5, animation: tl });
}

// ---------- pilot: held for query, day 0 to day 90 ----------
// A light instrument. The readout leads: as the line draws with scroll, a playhead runs the days
// and the figure follows it; once the line reaches day 90 the figure rests on the total. Go-live
// is marked as the playhead passes day 14. While the reader scrubs, the crosshair takes over the
// readout, then hands it back.
function pilotChart() {
  const fig = qs('#pchart');
  if (!fig) return;
  const plot = qs('.pchart__plot', fig);
  const top = qs('.pchart__top', fig), read = qs('.pchart__read', fig);
  const val = qs('.pchart__val', fig), when = qs('.pchart__when', fig);
  const grids = qsa('.pchart__grid', fig);
  const guide = qs('.pchart__guide', fig), xlab = qs('.pchart__x', fig), note = qs('.chart__note', fig);
  const data = qs('.pchart__data', fig), clip = qs('.pchart__clip', fig);
  const dot = qs('.pchart__dot', fig), ph = qs('.pchart__ph', fig);
  const live = qs('.pchart__live', fig), ping = qs('.pchart__ping', fig);
  const xh = qs('.pchart__xh', fig), xd = qs('.pchart__xd', fig);
  const tMid = qs('[data-pc="mid"]', fig), tMax = qs('[data-pc="max"]', fig);
  const spendEl = qs('[data-pc="spend"]', fig), summary = qs('[data-pc="summary"]', fig);

  // Share of the 90-day total reached by a given day: nothing until go-live, then steady.
  const share = (d) => Math.max(0, (d - LIVE) / (DAYS - LIVE));
  const niceCeil = (v) => {
    const e = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 2, 2.5, 5, 10]) if (m * e >= v) return m * e;
    return 10 * e;
  };
  const fmtK = (v) => (v >= 1e6 ? '£' + +(v / 1e6).toFixed(2) + 'm' : v >= 1e3 ? '£' + +(v / 1e3).toFixed(1) + 'k' : '£' + Math.round(v));

  const sc = { r: 1 };    // the line's height as a share of the axis
  const rv = { p: 0 };    // reveal, left to right
  const shown = { v: 0 }; // the figure in the readout, tweened when the total changes
  const P_END = 91 / 92;  // reveal share at day 90 (the clip runs from x -1 to 91)
  let total = 0, H = 0, done = false, scrubbing = false;

  function measure() { H = plot.clientHeight; }
  function place() {
    data.setAttribute('transform', 'matrix(1 0 0 ' + sc.r.toFixed(5) + ' 0 ' + (100 - 100 * sc.r).toFixed(3) + ')');
    gsap.set(dot, { y: -sc.r * H });
  }
  // The readout: a day's figure, or the total by day 90.
  function say(v, label) {
    shown.v = v;
    val.textContent = gbp(v);
    when.textContent = label;
  }
  const dayAt = (p) => Math.round(clamp(p * 92 - 1, 0, 90));
  function setClip() {
    clip.setAttribute('transform', 'matrix(' + rv.p.toFixed(4) + ' 0 0 1 ' + (rv.p - 1).toFixed(4) + ' 0)');
    // The playhead leads the line; it fades in as it leaves day 0 and out as it reaches day 90.
    const x = clamp(rv.p * 92 - 1, 0, 90) / 90;
    gsap.set(ph, { xPercent: x * 100, opacity: clamp(rv.p / 0.03, 0, 1) * clamp((P_END - rv.p) / 0.03, 0, 1) });
    if (!scrubbing && !done) {
      const d = dayAt(rv.p);
      say(share(d) * total, 'Day ' + d);
    }
  }
  function setSpend(s, animate) {
    total = heldBy90(s);
    const max = niceCeil(total);
    const r = total / max;
    tMid.textContent = fmtK(max / 2);
    tMax.textContent = fmtK(max);
    spendEl.textContent = gbp(s);
    summary.textContent = 'Estimate: nothing is held until the site goes live on day 14. From then about ' + gbp(s * RATE)
      + ' a week is held for query, reaching about ' + gbp(total) + ' by day 90.';
    if (animate && !RM) {
      gsap.to(sc, { r, duration: 0.5, ease: 'springSoft', overwrite: 'auto', onUpdate: place });
      if (done && !scrubbing) {
        gsap.to(shown, { v: total, duration: 0.5, ease: 'springSoft', overwrite: 'auto', onUpdate: () => say(shown.v, 'by day 90') });
      }
    } else {
      sc.r = r;
      place();
      if (done || RM) say(total, 'by day 90');
    }
  }
  function settle(on) {
    done = on;
    fig.classList.toggle('is-done', on);
    if (on) say(total, 'by day 90');
    else stop();
  }

  measure();
  setSpend(spendNow, false);
  window.addEventListener('resize', () => { measure(); place(); });
  document.addEventListener('pp:spend', (e) => setSpend(e.detail, true));
  if (RM) {
    rv.p = 1;
    setClip();
    settle(true);
  } else {
    gsap.set([top, read, ...grids, guide, xlab, note], { opacity: 0 });
    gsap.set(dot, { opacity: 0, scale: 0.4 });
    gsap.set(live, { opacity: 0, scale: 0.4 });
    gsap.set(ping, { opacity: 0, scale: 1 });
    rv.p = 0;
    setClip();
    gsap.set(fig, { opacity: 0, y: 24 });
    // Scrubbed: the frame, then the line drawing behind the playhead, then the result. Go-live
    // pings as the playhead passes it; the readout rests on the total once the line is home.
    const T = 0.45, D = 1.1, atEnd = T + D * springSoftAt(P_END), atLive = T + D * springSoftAt(15 / 92);
    const tl = fig._tl = gsap.timeline({ // fig._tl: QA handle
      paused: true,
      onUpdate() {
        const on = tl.time() >= atEnd - 0.001;
        if (on !== done) settle(on);
      },
    })
      .to(fig, { opacity: 1, y: 0, duration: 0.4, ease: 'spring' }, 0)
      .to([top, read], { opacity: 1, duration: 0.3, ease: 'springSoft', stagger: 0.06 }, 0.12)
      .to([...grids, xlab], { opacity: 1, duration: 0.35, ease: 'springSoft', stagger: 0.05 }, 0.2)
      .to(rv, { p: 1, duration: D, ease: 'springSoft', onUpdate: setClip }, T)
      .to(guide, { opacity: 1, duration: 0.3, ease: 'springSoft' }, atLive)
      .to(live, { opacity: 1, scale: 1, duration: 0.45, ease: 'spring' }, atLive)
      .set(ping, { opacity: 0.8, scale: 1 }, atLive)
      .to(ping, { opacity: 0, scale: 2.6, duration: 0.6, ease: 'springSoft' }, atLive)
      .to(dot, { opacity: 1, scale: 1, duration: 0.45, ease: 'springSoft' }, atEnd)
      .to(note, { opacity: 1, duration: 0.3, ease: 'springSoft' }, atEnd + 0.15);
    ScrollTrigger.create({ trigger: fig, start: 'top 88%', end: 'top 24%', scrub: 0.5, animation: tl });
  }

  // Scrub: the crosshair finds the day and takes the readout; leaving hands it back.
  function scrubAt(clientX) {
    if (!done) return;
    const b = plot.getBoundingClientRect();
    const day = Math.round(clamp((clientX - b.left) / b.width, 0, 1) * DAYS);
    const x = (day / DAYS) * b.width;
    gsap.set(xh, { x });
    gsap.set(xd, { x, y: -share(day) * sc.r * b.height });
    gsap.killTweensOf(shown);
    say(share(day) * total, 'Day ' + day + (day < LIVE ? ' · setting up' : ''));
    if (!scrubbing) { scrubbing = true; fig.classList.add('is-scrub'); }
  }
  function stop() {
    if (!scrubbing) return;
    scrubbing = false;
    fig.classList.remove('is-scrub');
    if (done) say(total, 'by day 90');
  }
  plot.addEventListener('pointerdown', (e) => scrubAt(e.clientX));
  plot.addEventListener('pointermove', (e) => scrubAt(e.clientX));
  plot.addEventListener('pointerleave', stop);
  plot.addEventListener('pointercancel', stop);
  plot.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') stop(); });
}

export function initCharts() {
  govChart();
  pilotChart();
}
