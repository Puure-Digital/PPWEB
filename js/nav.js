// Navigation: the site's bar, kept on screen. Solid (glass) once the page scrolls under it (on the
// home page from 1024 px, out of sight until the hero's own masthead has gone), scroll progress
// hairline, sliding active-section indicator (a fixed bar, positioned and sized by transform), and
// under 768 px the menu as a panel that Escape, a tap outside or a link closes.
import { RM, DESKTOP, qs, qsa } from './util.js';
import { stopScroll } from './scroll.js';
import { follow } from './motion.js';

export function initNav() {
  const nav = qs('#nav');
  const burger = qs('.nav__burger', nav);
  const links = qs('#nav-links');
  const ind = qs('.nav__ind', nav);
  const bar = qs('.nav__progress', nav);
  const items = qsa('a[data-nav]', nav);
  const menuItems = qsa('li, .nav__menu-acts > *', links);

  function setMenu(open) {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('no-scroll', open);
    stopScroll(open);
    // The page behind the open menu can't take focus, so the keyboard stays in the menu.
    document.querySelectorAll('main, footer').forEach((el) => { el.inert = open; });
    gsap.killTweensOf([links, ...menuItems]);
    if (open) {
      // Reopened while it is still fading out: carry on from where it is, not from the start.
      const reopen = nav.classList.contains('menu-open');
      nav.classList.add('menu-open');
      if (RM) return;
      if (reopen) {
        gsap.to(links, { opacity: 1, duration: 0.3, ease: 'springSoft' });
        gsap.to(menuItems, { opacity: 1, y: 0, duration: 0.5, ease: 'spring' });
        return;
      }
      gsap.fromTo(links, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'springSoft' });
      gsap.fromTo(menuItems, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, ease: 'spring', stagger: 0.06, delay: 0.04 });
    } else if (nav.classList.contains('menu-open')) {
      const done = () => { nav.classList.remove('menu-open'); gsap.set([links, ...menuItems], { clearProps: 'opacity,transform' }); };
      if (RM) done();
      else gsap.to(links, { opacity: 0, duration: 0.18, ease: 'springSoft', onComplete: done });
    }
  }
  burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
  links.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('menu-open')) { setMenu(false); burger.focus(); } });
  // A tap anywhere outside the bar and its panel closes the menu (the page behind is inert, so
  // the tap lands on the document).
  document.addEventListener('click', (e) => { if (burger.getAttribute('aria-expanded') === 'true' && !nav.contains(e.target)) setMenu(false); });
  window.matchMedia('(min-width: 768px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

  // A page that opens on its own stage (the home page's hero, or a dark stage marked data-clear)
  // starts clear and turns solid as soon as it scrolls, so nothing shows through the bar. Other
  // pages start solid.
  if (qs('.hero') || nav.hasAttribute('data-clear')) {
    ScrollTrigger.create({
      start: 1, end: 'max',
      onEnter: () => nav.classList.add('is-solid'),
      onLeaveBack: () => nav.classList.remove('is-solid'),
    });
    nav.classList.toggle('is-solid', window.scrollY >= 1);
  } else nav.classList.add('is-solid');

  // From 1024 px the home page's hero carries its own masthead (css/sections.css): there the bar
  // waits above the screen until that masthead has scrolled away, then slides down, solid.
  const mast = qs('.hx-mast');
  if (mast) {
    const wide = window.matchMedia(DESKTOP);
    let past = null;
    const tuck = () => nav.classList.toggle('is-tucked', wide.matches && !(past && past.isActive));
    past = ScrollTrigger.create({ trigger: mast, start: 'bottom top', end: 'max', onToggle: tuck });
    wide.addEventListener('change', tuck);
    tuck();
  } else nav.classList.remove('is-tucked');

  // Over a light section the bar turns light (css/base.css). Where those sections sit on the
  // page, pins included, is read whenever ScrollTrigger lays the page out, so a scroll frame only
  // compares numbers.
  const lights = qsa('.light');
  let spans = [], mid = 0;
  const measure = () => {
    mid = nav.offsetHeight / 2;
    spans = lights.map((s) => { const r = (s.closest('.pin-spacer') || s).getBoundingClientRect(); return [r.top + window.scrollY, r.bottom + window.scrollY]; });
  };
  const tone = () => { const y = window.scrollY + mid; nav.classList.toggle('is-light', spans.some(([a, b]) => y >= a && y < b)); };
  ScrollTrigger.addEventListener('refresh', () => { measure(); tone(); });
  // Content that grows after the page has laid out (a form arriving) moves the sections below it.
  if (window.ResizeObserver) new ResizeObserver(() => { measure(); tone(); }).observe(document.body);
  measure();
  tone();

  // Whole-page progress, and the bar's tone as the page moves.
  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (self) => { bar.style.transform = 'scaleX(' + self.progress.toFixed(4) + ')'; tone(); } });

  // Active section indicator. On a fine pointer it also follows the pointer across the links,
  // gliding from link to link, and returns to the current section when the pointer leaves.
  // The bar rides two live springs (position and width), so a sweep across the links that turns
  // back carries its momentum instead of starting again from rest.
  let current = null, shown = false;
  const draw = () => { ind.style.transform = 'translateX(' + ix.value.toFixed(2) + 'px) scaleX(' + iw.value.toFixed(4) + ')'; };
  const ix = follow(draw, { response: 0.35, eps: 0.01 }), iw = follow(draw, { response: 0.35, eps: 0.0005 });
  function place(a) {
    if (!a) { ind.style.opacity = '0'; shown = false; return; }
    // Under the link's text, not its padding.
    const pad = parseFloat(getComputedStyle(a).paddingLeft) || 0;
    const x = a.offsetLeft + pad, w = (a.offsetWidth - 2 * pad) / 100;
    // Appearing: start under the link rather than sliding in from wherever it last was.
    if (!shown || RM) { ix.jump(x); iw.jump(w); } else { ix.to(x); iw.to(w); }
    ind.style.opacity = '1';
    shown = true;
  }
  function setActive(a) {
    current = a;
    items.forEach((x) => x.classList.toggle('is-active', x === a));
    if (!hovering) place(a);
  }
  let hovering = false;
  if (!RM && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const list = qs('ul', links) || links;
    items.forEach((a) => a.addEventListener('pointerenter', () => { hovering = true; place(a); }));
    list.addEventListener('pointerleave', () => { hovering = false; place(current); });
  }
  // On another page the current page's link holds the indicator.
  const here = items.find((a) => a.getAttribute('aria-current') === 'page');
  if (here) {
    setActive(here);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setActive(here));
    window.addEventListener('resize', () => setActive(here));
  }
  items.forEach((a) => {
    const href = a.getAttribute('href');
    const sec = href.startsWith('#') ? qs(href) : null;
    if (!sec) return;
    ScrollTrigger.create({
      trigger: sec, start: 'top 45%', end: 'bottom 45%',
      onToggle: (self) => { if (self.isActive) setActive(a); else if (!items.some((x) => x !== a && x.classList.contains('is-active'))) setActive(null); },
    });
  });
}
