// Mid-page film: a frame sequence scrubbed by scroll in a pinned section, like the hero. Here the
// camera rises from the gate terminal's green tick to the dusk sky; captions arrive and leave on
// the spring; a heads-up gauge climbs from the gate to orbit; and as the sky opens, a train of
// satellites drifts across and one of them takes a link of light from the gate.
// Every frame of the source (192, at 24 a second), at the size the screen can show: 2560 wide for a
// large or retina screen, 1920 otherwise, and on a portrait phone a 4:5 crop of the full frame at
// its own resolution. Frames load only as the section approaches (never with the page): both ends
// first, then the whole film coarse to fine, the frames just ahead of the playhead jumping the
// queue. Reduced motion: the last frame, the last caption and the finished gauge, nothing moving.
import { RM, qs, qsa, clamp } from './util.js';
import { springSoft } from './motion.js';
import { frameSeq } from './frames.js';

const ORBIT_KM = 550;   // roughly the height of Starlink's main shells

function film(sec) {
  const canvas = qs('.film__canvas', sec);
  const poster = qs('.film__poster', sec);
  const lines = qsa('.film__line', sec);
  const sky = qs('.film__sky', sec), sats = qsa('.film__sat', sec), beam = qs('.film__beam', sec);
  const marker = qs('.film__marker', sec), alt = qs('[data-alt]', sec), link = qs('[data-link]', sec);
  const gauge = qs('.film__gauge', sec);
  const ds = sec.dataset;
  const total = parseInt(ds.frames, 10);
  const portrait = window.matchMedia('(max-width: 1023px) and (max-aspect-ratio: 4/5)').matches;
  const big = Math.min(window.devicePixelRatio || 1, 2) * Math.max(window.innerWidth, window.innerHeight * 16 / 9) > 2000;
  const dir = portrait && ds.dirMobile ? ds.dirMobile : big && ds.dirLarge ? ds.dirLarge : ds.dir;
  const focalX = parseFloat(portrait && ds.focalXMobile ? ds.focalXMobile : ds.focalX || '0.5');
  // The part of the full frame the frames show (x, y, width, height, as shares): a phone's are a crop.
  const crop = (portrait && ds.cropMobile ? ds.cropMobile : '0 0 1 1').split(' ').map(Number);
  // Where things sit in the last frame, as shares of the frame: the gate, and the satellite train.
  const GATE = [0.86, 0.72];
  // A portrait screen shows a narrow slice of the sky, so there the train crosses that slice.
  const TRAIN = portrait ? { from: [0.47, 0.12], to: [0.8, 0.3], drift: 0.05 } : { from: [0.16, 0.13], to: [0.56, 0.31], drift: 0.09 };

  function hud(p) {
    // The gauge: the first stretch is the climb up the post (metres); then the readout races to orbit.
    const k = clamp((p - 0.66) / 0.3, 0, 1);
    const m = p < 0.66 ? 2 + (p / 0.66) * 28 : 30 + (ORBIT_KM * 1000 - 30) * Math.pow(k, 3);
    // Once in orbit it reads as the scale and the still version do: approximately 550 km.
    alt.textContent = k >= 1 ? '≈ ' + ORBIT_KM + ' km' : m < 1000 ? Math.round(m) + ' m' : (m < 100000 ? (m / 1000).toFixed(1) : Math.round(m / 1000)) + ' km';
    gsap.set(marker, { yPercent: -100 * (p < 0.66 ? 0.32 * (p / 0.66) : 0.32 + 0.68 * springSoft(k)) });
    gauge.classList.toggle('is-top', k > 0.94);
    const on = p >= 0.82;
    if (link.dataset.on !== String(on)) {
      link.dataset.on = String(on);
      link.textContent = on ? 'Online' : p >= 0.6 ? 'Searching' : 'Terminal 2';
      link.classList.toggle('is-ok', on);
    } else if (!on) link.textContent = p >= 0.6 ? 'Searching' : 'Terminal 2';
  }

  if (RM || !canvas.getContext) {
    sec.classList.add('is-static');
    gsap.set(lines[lines.length - 1], { autoAlpha: 1, y: 0 });
    alt.textContent = '≈ ' + ORBIT_KM + ' km';
    link.textContent = 'Online';
    link.classList.add('is-ok');
    gsap.set(marker, { yPercent: -100 });
    gauge.classList.add('is-top');
    return;
  }

  const ctx = canvas.getContext('2d', { alpha: false });
  const seq = frameSeq((i) => dir + '/frame_' + String(i + 1).padStart(4, '0') + '.' + ds.ext, onDecode, () => [dw, dh]);
  let started = false, drawn = -1, progress = 0, cur = 0, sized = false;
  let dpr = 1, dw = 0, dh = 0, dx = 0, dy = 0;

  function layout() {
    const ir = seq.ratio() || (poster.naturalWidth ? poster.naturalWidth / poster.naturalHeight : 16 / 9);
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    // Device pixels, but never more than the frames have: past their own size a bigger canvas adds
    // no detail, only work for every frame drawn. The screen scales the canvas up the rest.
    const cover = cw / ch > ir ? cw : ch * ir;
    const own = seq.natural() ? seq.natural()[0] : Infinity;
    dpr = Math.min(window.devicePixelRatio || 1, 2, own / cover);
    const w = Math.round(cw * dpr), h = Math.round(ch * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h; drawn = -1;
      ctx.imageSmoothingQuality = 'high';
    }
    if (w / h > ir) { dw = w; dh = w / ir; } else { dh = h; dw = h * ir; }
    dx = (w - dw) * focalX;
    dy = (h - dh) * 0.5;
  }
  // A point in the full frame, in CSS pixels on screen.
  const at = (fx, fy) => [(dx + (fx - crop[0]) * dw / crop[2]) / dpr, (dy + (fy - crop[1]) * dh / crop[3]) / dpr];

  // A frame decoded near the playhead replaces whatever stood in for it.
  function onDecode(k) {
    if (!sized) { sized = true; layout(); }
    if (drawn < 0 || Math.abs(k - cur) < 2) render(progress, true);
  }

  function paint(f, force) {
    if (!force && f === drawn) return;
    // Until a frame near f is decoded, the canvas keeps what it shows (the poster, at first).
    if (seq.draw(ctx, f, dx, dy, dw, dh)) drawn = f;
    else if (drawn < 0 && poster.complete && poster.naturalWidth) ctx.drawImage(poster, dx, dy, dw, dh);
  }
  // Once the scroll rests, the film eases onto the nearest whole frame (a quarter second, under half
  // a frame of travel), so a paused film is one crisp picture rather than two blended; while it
  // moves, the blend keeps it continuous.
  let idle = 0, easing = 0;
  function settle() {
    const from = cur, to = Math.round(cur), t0 = performance.now();
    if (from === to) return;
    (function step(now) {
      const k = Math.min(1, (now - t0) / 240), e = 1 - Math.pow(1 - k, 3);
      paint(Math.round((from + (to - from) * e) * 32) / 32);
      easing = k < 1 ? requestAnimationFrame(step) : 0;
    })(t0);
  }

  function render(p, force) {
    progress = p;
    // The film position in frames, in 32 steps between neighbours (finer steps are not visible).
    const f = Math.round(clamp(p / 0.86, 0, 1) * (total - 1) * 32) / 32;
    cur = f;
    cancelAnimationFrame(easing);
    paint(f, force);
    clearTimeout(idle);
    idle = setTimeout(settle, 140);
    hud(p);
    // The sky: the satellite train fades in as the sky opens and drifts along its line.
    const s = clamp((p - 0.62) / 0.14, 0, 1), d = clamp((p - 0.62) / 0.38, 0, 1);
    sky.style.opacity = springSoft(s).toFixed(3);
    const n = sats.length;
    let lead = null;
    sats.forEach((el, i) => {
      const t = i / (n - 1);
      const fx = TRAIN.from[0] + (TRAIN.to[0] - TRAIN.from[0]) * t + TRAIN.drift * d;
      const fy = TRAIN.from[1] + (TRAIN.to[1] - TRAIN.from[1]) * t + TRAIN.drift * 0.45 * d;
      const [x, y] = at(fx, fy);
      el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
      if (i === Math.floor(n / 2)) lead = [x, y];
    });
    // The link: a line of light from the gate to the lead satellite once the link is up.
    const b = clamp((p - 0.8) / 0.08, 0, 1);
    if (lead) {
      const [gx, gy] = at(GATE[0], GATE[1]);
      const len = Math.hypot(lead[0] - gx, lead[1] - gy);
      const ang = Math.atan2(lead[1] - gy, lead[0] - gx);
      beam.style.width = len.toFixed(1) + 'px';
      beam.style.transform = 'translate(' + gx.toFixed(1) + 'px,' + gy.toFixed(1) + 'px) rotate(' + ang.toFixed(4) + 'rad) scaleX(' + springSoft(b).toFixed(3) + ')';
      beam.style.opacity = b.toFixed(3);
    }
  }

  function start() {
    if (started) return;
    started = true;
    // Both ends, then every 32nd frame, every 16th, and so on down to every one, so wherever the
    // reader scrolls a frame is close by; six at a time.
    const queue = [0, total - 1], asked = new Set();
    for (let step = 32; step >= 1; step >>= 1) for (let k = step; k < total - 1; k += step) if (!queue.includes(k)) queue.push(k);
    let inflight = 0;
    const pick = () => {
      // The frames just ahead of the playhead jump the queue.
      const here = Math.max(0, Math.floor(cur));
      for (let k = here; k < Math.min(total, here + 16); k++) if (!asked.has(k)) return k;
      while (queue.length) { const k = queue.shift(); if (!asked.has(k)) return k; }
      return -1;
    };
    (function next() {
      while (inflight < 6) {
        const k = pick();
        if (k < 0) return;
        asked.add(k);
        inflight++;
        seq.load(k).then(() => {
          inflight--;
          if (drawn < 0 || Math.abs(k - cur) < 2) render(progress, true);
          next();
        });
      }
    })();
  }
  const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { start(); io.disconnect(); } }, { rootMargin: '300% 0px' });
  io.observe(sec);

  // Captions: arrivals ride the spring, exits accelerate away (its mirror), as in the hero.
  gsap.set(lines, { autoAlpha: 0, y: 28 });
  const tl = gsap.timeline({ defaults: { ease: 'spring' } })
    .to(lines[0], { autoAlpha: 1, y: 0, duration: 0.07 }, 0.06)
    .to(lines[0], { autoAlpha: 0, y: -28, duration: 0.05, ease: 'springIn' }, 0.4)
    .to(lines[1], { autoAlpha: 1, y: 0, duration: 0.07 }, 0.5)
    .set({}, {}, 1);

  ScrollTrigger.create({
    trigger: sec, start: 'top top', end: () => '+=' + Math.round(window.innerHeight * 2.4),
    pin: true, scrub: true, animation: tl,
    onUpdate: (self) => render(self.progress),
    onLeave: () => seq.release(), onLeaveBack: () => seq.release(),
    onRefresh: (self) => { layout(); render(self.progress, true); },
  });
  layout();
  render(0, true);
  window.addEventListener('resize', () => { layout(); render(progress, true); });
}

export function initFilms() {
  qsa('.film').forEach(film);
}
