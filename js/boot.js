// Shared start-up for every page: reduced-motion class, plugins and eases, then each page's
// steps in order (pinned scenes top to bottom, so ScrollTrigger measures pin spacing correctly).
import { registerEases } from './motion.js';
import { RM } from './util.js';

// Hands the main thread back between steps, so a slow phone can paint and take a tap while the
// page sets up, instead of one long task.
const pause = () => (window.scheduler && scheduler.yield ? scheduler.yield() : new Promise((r) => setTimeout(r)));

export async function boot(steps) {
  const root = document.documentElement;
  if (RM) root.classList.add('rm');
  // iPhone Safari applies :active (every press state on the site) only once a page listens for
  // touchstart; this empty listener turns the touch-down response on.
  document.addEventListener('touchstart', () => {}, { passive: true });

  if (!window.gsap || !window.ScrollTrigger) {
    // Libraries failed to load: show everything, statically.
    root.classList.remove('js');
    root.classList.add('no-js');
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  // Each refresh re-measures every trigger (about 130 ms on a mid-range phone), so the page asks
  // for as few as it needs: the one after setup, one at load only if setup finished first, one
  // when late fonts reflow text, and ScrollTrigger's own on resize. (Its DOMContentLoaded and
  // load refreshes would land mid-setup now that setup yields.)
  ScrollTrigger.config({ ignoreMobileResize: true, autoRefreshEvents: 'visibilitychange,resize' });
  registerEases();

  for (const step of steps) {
    try { step(); } catch (err) { console.error('[PayRoll Protect] ' + step.name + ' failed', err); }
    await pause();
  }
  // Measure every trigger in page order, so a pin's spacing reaches everything below it,
  // whichever step created it.
  ScrollTrigger.sort();
  ScrollTrigger.refresh();

  if (document.readyState !== 'complete') window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
  if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(() => ScrollTrigger.refresh());
  // Safety net: never leave a headline hidden.
  setTimeout(() => document.querySelectorAll('[data-split]:not(.is-split)').forEach((el) => el.classList.add('is-split')), 3000);
}
