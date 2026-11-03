// The band under the hero ("Don't Approve What You Can't Prove."), scrolled into. Its line lights
// word by word as every headline does (js/reveal.js); each card rises into place as it comes up the
// screen, and its figure counts in once the card has nearly landed, back to zero if the reader
// scrolls back above it. Side by side, the three cards follow one another a little apart. Scrubbed,
// so it all follows the scroll both ways; transform and opacity only. Reduced motion shows the band
// at rest.
import { RM, qs, qsa } from './util.js';
import { setOd, odZero } from './odometer.js';
import { springSoft } from './motion.js';

export function initFacts() {
  const band = qs('.facts');
  if (!band || RM) return;
  const row = window.matchMedia('(min-width: 641px)');

  qsa('.facts__nums > li', band).forEach((card, i) => {
    const od = qs('.od', card);
    const target = od ? parseFloat(od.dataset.od) : 0;
    let counted = false;
    if (od) { setOd(od, target, { instant: true }); odZero(od); }
    const count = (on) => {
      if (!od || on === counted) return;
      counted = on;
      if (on) setOd(od, target, { dur: 0.9, step: 0.07 });
      else odZero(od);
    };
    const at = (p) => {
      const e = springSoft(p);
      card.style.opacity = e.toFixed(3);
      card.style.transform = `translate3d(0, ${((1 - e) * 56).toFixed(1)}px, 0) scale(${(0.94 + 0.06 * e).toFixed(4)})`;
      if (p >= 0.6) count(true);
      else if (p <= 0.05) count(false);
    };
    // Side by side the cards share one top edge, so each starts a little later than the one before.
    const lag = () => (row.matches ? i * 7 : 0);
    at(0);
    ScrollTrigger.create({
      trigger: card,
      start: () => 'top ' + (96 - lag()) + '%',
      end: () => 'top ' + (62 - lag()) + '%',
      scrub: true,
      invalidateOnRefresh: true,
      onUpdate: (self) => at(self.progress),
      onRefresh: (self) => at(self.progress),
    });
  });
}
