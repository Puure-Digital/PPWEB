// Line-by-line matching, as a scroll scene. Everything here is driven by scroll:
// 1. Arrival: the headline lights up word by word.
// 2. The run (pinned on desktop): the invoice lies back like a sheet on a desk and a scan runs
//    down it. A line resolves as the scan reaches it: the claim is already shown, the gate record
//    grows to meet it, then the result. Verified lines settle flat; held lines rise off the sheet
//    toward you (CSS). At the end the sheet lifts a little so the result reads straight on.
//    On smaller screens the page itself carries the lines past a focus line instead.
// 3. Totals and the verified / held split settle as lines resolve.
// Scrolling back reverses all of it. Transform and opacity only.
import { RM, qs, qsa, clamp, DESKTOP } from './util.js';
import { setOd } from './odometer.js';
import { springSoft } from './motion.js';
import { splitHeadline } from './reveal.js';

const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);

export function initMatch() {
  const sec = qs('#match');
  const mq = qs('#mq');
  if (!sec || !mq) return;
  const title = qs('#match-title', sec);
  const sheet = qs('.mq__sheet', mq), scan = qs('.mq__scan', mq);
  const rows = qsa('.mq__row', mq);
  const verEl = qs('#m-ver'), heldEl = qs('#m-held'), countEl = qs('.mq__n', sec);
  const vBar = qs('.mq__v', sec), xBar = qs('.mq__x', sec);
  const n = rows.length;
  const data = rows.map((r) => ({ v: Number(r.dataset.v), h: Number(r.dataset.h) }));
  const claimed = data.reduce((s, d) => s + d.v + d.h, 0);
  // Words lit one after another by scroll, each line in the hero's light (js/reveal.js).
  const words = splitHeadline(title);
  let resolved = -1, marks = [], span = [0, 0];

  function lightWords(p) {
    const k = p * words.length;
    words.forEach((w, i) => { w.style.opacity = (0.16 + 0.84 * clamp(k - i, 0, 1)).toFixed(3); });
  }

  function setResolved(k) {
    if (k === resolved) return;
    resolved = k;
    rows.forEach((r, i) => r.classList.toggle('is-done', i < k));
    let ver = 0, held = 0;
    for (let i = 0; i < k; i++) { ver += data[i].v; held += data[i].h; }
    setOd(verEl, ver, { dur: 0.5, step: 0.03 });
    setOd(heldEl, held, { dur: 0.5, step: 0.03 });
    vBar.style.transform = 'scaleX(' + (ver / claimed).toFixed(4) + ')';
    xBar.style.transform = 'scaleX(' + (held / claimed).toFixed(4) + ')';
    countEl.textContent = k;
  }

  // Desktop scene. Row centres are measured on the sheet's own (untilted) plane, where the scan runs.
  function measure() {
    const top = (el) => { let y = 0; for (let e = el; e && e !== sheet; e = e.offsetParent) y += e.offsetTop; return y; };
    marks = rows.map((r) => top(r) + r.offsetHeight / 2);
    span = [top(rows[0]) - 8, top(rows[n - 1]) + rows[n - 1].offsetHeight + 4];
  }
  // 0–0.12: the sheet lies back. 0.12–0.84: the scan runs down it. 0.86–1: it lifts a little.
  function sceneAt(p) {
    const lay = springSoft(seg(p, 0, 0.12)) - 0.42 * springSoft(seg(p, 0.86, 1));
    sheet.style.transform = `rotateX(${(30 * lay).toFixed(2)}deg) rotateY(${(-10 * lay).toFixed(2)}deg) rotateZ(${(2.5 * lay).toFixed(2)}deg)`;
    const y = span[0] + (span[1] - span[0]) * seg(p, 0.12, 0.84);
    scan.style.transform = `translate3d(0, ${y.toFixed(1)}px, 3px)`;
    scan.style.opacity = (seg(p, 0.1, 0.14) * (1 - seg(p, 0.84, 0.88))).toFixed(3);
    setResolved(marks.filter((m) => m <= y).length);
  }

  // Smaller screens: lines resolve as they pass a focus line 60% down the viewport.
  function flowAt() {
    const line = window.innerHeight * 0.6;
    const centres = rows.map((r) => { const b = r.getBoundingClientRect(); return (b.top + b.bottom) / 2; });
    let k = 0;
    centres.forEach((c, i) => {
      if (c <= line) k = i + 1;
      const ahead = clamp((c - line) / (window.innerHeight * 0.35), 0, 1);
      rows[i].style.opacity = (1 - ahead * 0.6).toFixed(3);
    });
    setResolved(k);
  }

  const clearRows = () => {
    sheet.style.transform = '';
    scan.style.transform = scan.style.opacity = '';
    rows.forEach((r) => { r.style.opacity = ''; });
  };

  if (RM) {
    lightWords(1);
    setResolved(n);
    return;
  }
  lightWords(0);
  setResolved(0);

  // Arrival: the headline lights as it reads.
  ScrollTrigger.create({
    trigger: title, start: 'top 88%', end: 'top 38%', scrub: true,
    onUpdate: (self) => lightWords(self.progress),
  });

  const mm = gsap.matchMedia();
  mm.add(DESKTOP, () => {
    mq.classList.add('is-scene');
    const st = ScrollTrigger.create({
      trigger: sec, start: 'top top', end: () => '+=' + Math.round(window.innerHeight * 2.4),
      pin: true,
      onUpdate: (self) => sceneAt(self.progress),
      onRefresh: (self) => { measure(); sceneAt(self.progress); },
    });
    measure();
    sceneAt(st.progress);
    return () => { mq.classList.remove('is-scene'); clearRows(); };
  });
  mm.add('(max-width: 1023px)', () => {
    const st = ScrollTrigger.create({ trigger: sheet, start: 'top bottom', end: 'bottom top', onUpdate: flowAt, onRefresh: flowAt });
    flowAt();
    return () => { st.kill(); clearRows(); };
  });
}
