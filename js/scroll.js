// Smooth scroll (Lenis) driven by the GSAP ticker, plus in-page anchor handling.
// Anchor jumps ride the critically damped spring and take 0.8–1.4 s by distance. Beyond three
// screens, the section comes up over the page as a sheet (the move between pages) instead.
import { RM } from './util.js';
import { springSoft } from './motion.js';

export let lenis = null;

export function initScroll() {
  if (!RM && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.11, smoothWheel: true, wheelMultiplier: 1 });
    lenis.on('scroll', ScrollTrigger.update);
    window.ppLenis = lenis; // QA handle: ppLenis.scrollTo(y, { immediate: true })
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    // Pinned scenes change the page height when ScrollTrigger refreshes; re-measure at once so
    // smooth scrolling never clamps to a stale end of page.
    ScrollTrigger.addEventListener('refresh', () => lenis.resize());
  }
  land();

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    const y = id === '#top' ? 0 : spot(target);
    const dist = Math.abs(y - window.scrollY);
    history.replaceState(null, '', id);
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    const arrive = () => target.focus({ preventScroll: true });
    if (!RM && dist > window.innerHeight * 3 && document.startViewTransition) {
      const root = document.documentElement;
      if (y < window.scrollY) root.setAttribute('data-vt', 'back');
      const vt = document.startViewTransition(() => jump(y));
      const end = () => root.removeAttribute('data-vt');
      vt.updateCallbackDone.then(arrive, arrive);
      vt.finished.then(end, end);
      return;
    }
    const duration = Math.min(1.4, 0.8 + dist / 8000);
    if (lenis) lenis.scrollTo(y, { duration, easing: springSoft });
    else window.scrollTo({ top: y, behavior: RM ? 'auto' : 'smooth' });
    setTimeout(arrive, RM ? 0 : duration * 1000);
  });
}

// Where a jump to an element lands: a section flush with the top (its own padding clears the
// nav), anything smaller with its scroll margin below the nav. A pinned section is measured by
// the space its pin holds.
function spot(el) {
  const box = el.closest('.pin-spacer') || el;
  const margin = el.tagName === 'SECTION' ? 0 : parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  return Math.max(0, box.getBoundingClientRect().top + window.scrollY - margin);
}
const jump = (y) => (lenis ? lenis.scrollTo(y, { immediate: true, force: true }) : window.scrollTo({ top: y, behavior: 'instant' }));

// The browser goes to an address's #section, or back to where a reload left off, before the
// pinned scenes above it have added their length, so it lands short. Once ScrollTrigger has
// measured them the page lands again, and after each late refresh (load, fonts) until the reader
// scrolls. And when the width changes (a phone turned, a window resized) the reader keeps their
// place in the section they were in, not the same pixel offset.
function land() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const key = 'pp:y:' + location.pathname;
  window.addEventListener('pagehide', () => { try { sessionStorage.setItem(key, String(Math.round(window.scrollY))); } catch { /* storage off */ } });
  const how = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0] || {}).type;
  const id = decodeURIComponent(location.hash.slice(1));
  let goal = null;
  if (id && id !== 'risk-check' && document.getElementById(id)) goal = document.getElementById(id);
  else if (how === 'reload' || how === 'back_forward') {
    try { const y = Number(sessionStorage.getItem(key)); if (y > 0) goal = y; } catch { /* storage off */ }
  }
  if (goal !== null) {
    const done = () => { goal = null; ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((t) => window.removeEventListener(t, done)); };
    ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((t) => window.addEventListener(t, done, { passive: true }));
    setTimeout(done, 6000);
  }
  let width = window.innerWidth, place = null;
  ScrollTrigger.addEventListener('refreshInit', () => {
    if (goal !== null || window.innerWidth === width) return;
    width = window.innerWidth;
    const y = window.scrollY;
    const box = [...document.querySelectorAll('main > section, main > .pin-spacer, body > .foot')].find((el) => {
      const r = el.getBoundingClientRect();
      return r.top <= 1 && r.bottom > 1;
    });
    if (box) place = { el: box.matches('.pin-spacer') ? box.firstElementChild : box, f: (y - (box.getBoundingClientRect().top + y)) / box.offsetHeight };
  });
  ScrollTrigger.addEventListener('refresh', () => {
    if (goal !== null) { jump(typeof goal === 'number' ? goal : spot(goal)); return; }
    if (!place) return;
    const box = place.el.closest('.pin-spacer') || place.el;
    jump(box.getBoundingClientRect().top + window.scrollY + place.f * box.offsetHeight);
    place = null;
  });
}

export function stopScroll(stop) {
  if (lenis) stop ? lenis.stop() : lenis.start();
}
