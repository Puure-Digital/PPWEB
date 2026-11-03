// How it works: the product stage follows the step being read (desktop),
// or holds on screen while the scroll takes it through the steps (phone).
// Step dots are fixed bars placed and sized by transform (--x, --s), never by width.
// The gate terminal turns in from side on as the stage scrolls up to it (--turn), and the reader
// can run the face scan themselves: hold the button and it scans while held, then passes.
import { RM, qs, qsa, DESKTOP } from './util.js';
import { follow } from './motion.js';

export function initHow() {
  const steps = qsa('#steps .step');
  const views = qsa('#stage .sv');
  const dots = qsa('#stage .stage__dots i');
  if (!steps.length) return;
  let cur = 0;
  function place(i) {
    dots.forEach((d, k) => {
      d.style.setProperty('--x', (k * 21 + (k > i ? 12 : 0)) + 'px');
      d.style.setProperty('--s', k === i ? '1' : '0.5714');
      d.classList.toggle('is-on', k === i);
    });
  }
  // The terminal check (step 01) plays from its first frame whenever its view comes on, and
  // waits, held on that frame, until the stage is a quarter on screen.
  const scan = qs('#stage .sv--scan');
  const replay = () => {
    if (RM || !scan) return;
    scan.classList.remove('is-run', 'is-hold', 'is-pass', 'is-idle');
    void scan.offsetWidth;
    scan.classList.add('is-run');
  };
  const stage = qs('#stage');
  if (!RM && scan) {
    scan.classList.add('is-run', 'is-wait');
    const io = new IntersectionObserver((es) => {
      if (!es[0].isIntersecting) return;
      scan.classList.remove('is-wait');
      io.disconnect();
    }, { threshold: 0.25 });
    io.observe(qs('#stage'));
    // Fine pointers: the terminal leans toward the pointer, and back when it leaves, on a live
    // spring per axis that carries its velocity when the pointer turns. Not with reduced motion.
    const term = qs('.term', scan);
    if (term && !RM && matchMedia('(hover: hover) and (pointer: fine)').matches) {
      const tx = follow((v) => term.style.setProperty('--tx', v.toFixed(4)), { response: 0.5 });
      const ty = follow((v) => term.style.setProperty('--ty', v.toFixed(4)), { response: 0.5 });
      stage.addEventListener('pointermove', (e) => {
        const r = stage.getBoundingClientRect();
        tx.to((e.clientX - r.left) / r.width * 2 - 1);
        ty.to((e.clientY - r.top) / r.height * 2 - 1);
      });
      stage.addEventListener('pointerleave', () => { tx.to(0); ty.to(0); });
    }
  }
  function show(i) {
    if (i === cur) return;
    cur = i;
    steps.forEach((s, k) => s.classList.toggle('is-on', k === i));
    views.forEach((v, k) => v.classList.toggle('is-on', k === i));
    stage.classList.toggle('is-scan', i === 0);
    place(i);
    if (i === 0) replay();
  }
  place(0);
  stage.classList.add('is-scan');
  if (scan && !RM) { turn(scan); hands(scan, stage, () => show(0)); }

  const mm = gsap.matchMedia();
  mm.add(DESKTOP, () => {
    const ts = steps.map((s, i) => ScrollTrigger.create({
      trigger: s, start: 'top 60%', end: 'bottom 60%',
      onToggle: (self) => { if (self.isActive) show(i); },
    }));
    if (RM) return () => ts.forEach((t) => t.kill());
    // Focus follows the scroll: the step at the reading line is bright and the rest recede,
    // and each step's top rule fills as the reading line passes through it.
    const sec = qs('#how');
    sec.classList.add('is-focus');
    const focus = () => {
      const line = window.innerHeight * 0.6, reach = window.innerHeight * 0.5;
      const boxes = steps.map((s) => s.getBoundingClientRect());
      boxes.forEach((b, i) => {
        const d = Math.abs((b.top + b.bottom) / 2 - line) / reach;
        steps[i].style.opacity = (1 - Math.min(d, 1) * 0.64).toFixed(3);
        steps[i].style.setProperty('--f', Math.min(1, Math.max(0, (line - b.top) / b.height)).toFixed(4));
      });
    };
    const fst = ScrollTrigger.create({ trigger: qs('#steps'), start: 'top bottom', end: 'bottom top', onUpdate: focus, onRefresh: focus });
    return () => {
      ts.forEach((t) => t.kill());
      fst.kill();
      sec.classList.remove('is-focus');
      steps.forEach((s) => { s.style.opacity = ''; s.style.removeProperty('--f'); });
    };
  });
  // Phones: the stage holds on screen, clear of the bar, while the reader scrolls on, and takes them
  // through the five steps in turn (each over 60% of a screen of scroll), as the steps do on desktop.
  // Nothing moves by itself, so there is no Pause.
  mm.add('(max-width: 1023px)', () => {
    if (RM) return;
    const pause = qs('.stage__pause');
    if (pause) pause.style.display = 'none';
    const bar = () => (qs('.nav') ? qs('.nav').offsetHeight : 64);
    const st = ScrollTrigger.create({
      trigger: stage, pin: true,
      start: () => 'top ' + Math.round(Math.max(bar() + 8, (window.innerHeight - stage.offsetHeight) / 2)),
      end: () => '+=' + Math.round(window.innerHeight * 0.6 * (views.length - 1)),
      onUpdate: (self) => show(Math.min(views.length - 1, Math.floor(self.progress * views.length))),
      onRefresh: (self) => show(Math.min(views.length - 1, Math.floor(self.progress * views.length))),
    });
    return () => { st.kill(); if (pause) pause.style.display = ''; };
  });
}

// The terminal turns in from side on as the stage scrolls up toward the middle of the screen,
// showing the depth of its slab, and comes to rest at its three-quarter view.
function turn(scan) {
  const term = qs('.term', scan);
  if (!term) return;
  const set = (p) => term.style.setProperty('--turn', (1 - p).toFixed(4));
  ScrollTrigger.create({ trigger: qs('#stage'), start: 'top bottom', end: 'top 22%', onUpdate: (s) => set(s.progress), onRefresh: (s) => set(s.progress) });
}

// Hands on. Pressing and holding the button scans for as long as it is held, its ring filling; at
// 1.1 s the scan passes: the screen turns lime, the time is now and the invoice line is approved,
// said aloud for screen readers. Letting go early puts the terminal back as it was. A key press
// (Enter, Space) runs the same scan through. On a phone it also stops the stage stepping on.
function hands(scan, stage, toScan) {
  const btn = qs('.stage__try', stage), said = qs('[data-said]', stage), time = qs('.sv__time', scan);
  if (!btn) return;
  let timer = 0, held = false;
  const finish = () => {
    held = false;
    btn.classList.remove('is-holding');
    const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (time) time.textContent = now;
    scan.classList.remove('is-hold');
    void scan.offsetWidth;
    scan.classList.add('is-pass');
    stage.dispatchEvent(new CustomEvent('stage:hold', { detail: 'pass' }));
    if (said) said.textContent = 'Scan passed: W-0412 verified at Terminal 2, ' + now + '. Invoice line approved.';
  };
  const start = () => {
    if (held) return;
    held = true;
    toScan();
    stage.dispatchEvent(new CustomEvent('stage:hold', { detail: 'start' }));
    scan.classList.remove('is-run', 'is-pass', 'is-idle');
    scan.classList.add('is-hold');
    btn.classList.add('is-holding');
    if (said) said.textContent = '';
    timer = setTimeout(finish, 1100);
  };
  const cancel = () => {
    if (!held) return;
    held = false;
    clearTimeout(timer);
    btn.classList.remove('is-holding');
    // Let go early, the terminal waits for a scan: never the finished, approved state.
    scan.classList.replace('is-hold', 'is-idle');
    stage.dispatchEvent(new CustomEvent('stage:hold', { detail: 'cancel' }));
  };
  btn.addEventListener('pointerdown', (e) => { if (e.button === 0) { btn.setPointerCapture(e.pointerId); start(); } });
  btn.addEventListener('pointerup', cancel);
  btn.addEventListener('pointercancel', cancel);
  btn.addEventListener('lostpointercapture', cancel);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  btn.addEventListener('click', (e) => { if (e.detail === 0) start(); });
}
