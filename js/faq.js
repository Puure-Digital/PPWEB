// FAQ accordion, one answer open at a time. Nothing animates height: the layout changes
// once, then every row (and the sections below) glides from where it was to where it now
// is (FLIP, transform only). An opening answer fades in; a closing one stays where it was,
// out of flow, fading while the rows slide up over it.
import { RM, qs, qsa } from './util.js';

export function initFaq() {
  const items = qsa('.qa');
  if (!items.length) return;
  const movers = [...items, qs('.foot')].filter(Boolean);
  const ans = (qa) => qs('.qa__a', qa);
  let ghost = null, timer = 0;

  function set(qa, open) {
    qa.classList.toggle('is-open', open);
    qs('.qa__q', qa).setAttribute('aria-expanded', String(open));
    ans(qa).hidden = !open;
  }
  function clearGhost() {
    if (!ghost) return;
    gsap.killTweensOf(ghost);
    ghost.hidden = true;
    gsap.set(ghost, { clearProps: 'position,top,left,right,zIndex,opacity' });
    ghost = null;
  }
  function refresh() {
    clearTimeout(timer);
    timer = setTimeout(() => ScrollTrigger.refresh(), 650);
  }

  items.forEach((qa) => set(qa, qa.classList.contains('is-open')));
  items.forEach((qa) => qs('.qa__q', qa).addEventListener('click', () => {
    const open = !qa.classList.contains('is-open');
    const closing = open ? items.find((o) => o !== qa && o.classList.contains('is-open')) : qa;
    if (RM) { items.forEach((o) => set(o, o === qa && open)); refresh(); return; }

    clearGhost();
    gsap.killTweensOf(movers);
    const before = movers.map((el) => el.getBoundingClientRect().top);
    gsap.set(movers, { clearProps: 'transform' });

    if (closing) {
      // Lift the closing answer out of flow where it stands, so rows can slide over it.
      const a = ans(closing);
      const top = a.offsetTop;
      set(closing, false);
      a.hidden = false;
      gsap.set(a, { position: 'absolute', top, left: 0, right: 0, zIndex: 0 });
      ghost = a;
    }
    if (open) set(qa, true);

    const after = movers.map((el) => el.getBoundingClientRect().top);
    movers.forEach((el, i) => {
      const d = before[i] - after[i];
      if (Math.abs(d) > 0.5) gsap.fromTo(el, { y: d }, { y: 0, duration: 0.55, ease: 'spring', clearProps: 'transform' });
    });
    if (open) gsap.fromTo(qs('.qa__a p', qa), { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: 0.45, ease: 'springSoft', delay: 0.06, clearProps: 'opacity,transform' });
    if (ghost) gsap.to(ghost, { opacity: 0, duration: 0.3, ease: 'springSoft', onComplete: clearGhost });
    refresh();
  }));
}
