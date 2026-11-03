// Smooth scroll (Lenis) driven by the GSAP ticker, plus in-page anchor handling.
// Anchor jumps ride the critically damped spring and take 0.8–1.4 s by distance.
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

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    // Sections land flush (their own padding clears the nav); anything smaller, such as a form,
    // keeps its scroll margin below the nav.
    const margin = target.tagName === 'SECTION' ? 0 : parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
    const y = id === '#top' ? 0 : target.getBoundingClientRect().top + window.scrollY - margin;
    const duration = Math.min(1.4, 0.8 + Math.abs(y - window.scrollY) / 8000);
    if (lenis) lenis.scrollTo(y, { duration, easing: springSoft });
    else window.scrollTo({ top: y, behavior: RM ? 'auto' : 'smooth' });
    history.replaceState(null, '', id);
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    setTimeout(() => target.focus({ preventScroll: true }), RM ? 0 : duration * 1000);
  });
}

export function stopScroll(stop) {
  if (lenis) stop ? lenis.stop() : lenis.start();
}
