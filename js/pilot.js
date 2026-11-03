// Pilot timeline: the rail fills with scroll and milestones light as it reaches them.
import { RM, qs, qsa, DESKTOP } from './util.js';

export function initPilot() {
  const tl = qs('#tl');
  if (!tl) return;
  const rail = qs('.tl__rail', tl);
  const fill = qs('.tl__fill', tl);
  const ms = qsa('.tl__m', tl);
  const head = document.createElement('i');
  head.className = 'tl__head';
  rail.append(head);
  let marks = ms.map(() => 0), horiz = true, p = 0, len = 0;

  function measure() {
    horiz = window.matchMedia(DESKTOP).matches;
    rail.style.left = rail.style.right = rail.style.top = rail.style.bottom = '';
    const box = tl.getBoundingClientRect();
    const c = ms.map((m) => { const r = qs('.tl__dot', m).getBoundingClientRect(); return horiz ? r.left + r.width / 2 - box.left : r.top + r.height / 2 - box.top; });
    const a = c[0], b = c[c.length - 1];
    if (horiz) { rail.style.left = a + 'px'; rail.style.right = (box.width - b) + 'px'; }
    else { rail.style.top = a + 'px'; rail.style.bottom = (box.height - b) + 'px'; }
    len = b - a;
    marks = c.map((v) => (v - a) / len);
    apply(p);
  }
  function apply(v) {
    p = v;
    fill.style.transform = (horiz ? 'scaleX(' : 'scaleY(') + v.toFixed(4) + ')';
    // The playhead fades in off the first milestone and out onto the last, so the finished rail
    // looks the same as under reduced motion.
    const d = v * len;
    head.style.transform = horiz ? `translate3d(${d.toFixed(1)}px, 0, 0)` : `translate3d(0, ${d.toFixed(1)}px, 0)`;
    head.style.opacity = Math.max(0, Math.min(1, d / 40, (len - d) / 24)).toFixed(3);
    ms.forEach((m, i) => m.classList.toggle('is-on', v >= marks[i] - 0.002));
  }

  if (RM) {
    p = 1;
    measure();
    ScrollTrigger.addEventListener('refresh', measure);
    return;
  }
  ScrollTrigger.create({
    trigger: tl, start: 'top 78%', end: 'bottom 50%',
    onUpdate: (self) => apply(self.progress),
    onRefresh: (self) => { p = self.progress; measure(); },
  });
}
