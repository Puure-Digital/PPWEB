// Sequences that follow the scroll. Items wait, dimmed, and light one after another as the
// group scrolls through the viewport; scrolling back dims them again.
// - Our average site: its weekly saving counts in, then its share of labour spend and the national
//   estimate's grow as bars, ours first.
// - The numbers: £82bn × 1.7% = £1.4bn, each figure counting up as it lights.
// Reduced motion: everything is shown and nothing moves.
import { RM, qs, qsa } from './util.js';
import { setOd, odZero } from './odometer.js';

function sequence(group, items, { start, end, on, off }) {
  if (!group || !items.length) return;
  const lit = items.map(() => null);
  const paint = (p) => items.forEach((el, i) => {
    const now = p >= (i + 0.4) / (items.length + 0.4);
    if (now === lit[i]) return;
    lit[i] = now;
    el.classList.toggle('is-lit', now);
    if (now && on) on(el, i);
    if (!now && off) off(el, i);
  });
  ScrollTrigger.create({
    trigger: group, start, end,
    onUpdate: (self) => paint(self.progress),
    onRefresh: (self) => paint(self.progress),
  });
}

export function initScrubs() {
  const stats = qsa('.stats .stat');
  const ours = qsa('.ours__lead, .ours .vsbar'), fig = qs('.ours__fig .od');
  if (RM) {
    [...stats, ...ours].forEach((el) => el.classList.add('is-lit'));
    return;
  }
  if (fig) odZero(fig);
  // All lit by the time the panel is wholly on screen: the comparison is the point.
  sequence(qs('.ours'), ours, {
    start: 'top 85%', end: 'top 55%',
    on: (el) => { if (fig && el.contains(fig)) setOd(fig, parseFloat(fig.dataset.od), { dur: 0.9, step: 0.07 }); },
    off: (el) => { if (fig && el.contains(fig)) odZero(fig, false); },
  });
  stats.forEach((s) => odZero(qs('.od', s)));
  sequence(qs('.stats'), stats, {
    start: 'top 85%', end: 'top 40%',
    on: (el) => { const od = qs('.od', el); setOd(od, parseFloat(od.dataset.od), { dur: 0.8, step: 0.06 }); },
    off: (el) => odZero(qs('.od', el), false),
  });
}
