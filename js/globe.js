// Installation, on the homepage: the gate goes online by satellite, shown on the Earth itself.
// A dot-matrix globe (COBE, in assets/vendor) dives from the Atlantic to a low view across the UK,
// so the UK sits just under the horizon and the satellites' height shows against the sky. Then
// the four steps: the gate pings (mounted), the link climbs to a satellite (online), check-ins go
// up to it and down to UK servers (sent), and the link drops, scans queue at the gate and sync
// when it returns (offline, still recording). Orbits are at the real height of Starlink's main
// shells, 550 km; the passes are sped up and the places are illustrative.
// A pure function of progress, so it scrubs both ways. Desktop: the section pins, the globe fills
// the stage and a stepper follows the story. Smaller screens: it plays as the globe scrolls up
// the screen. Reduced motion: the finished frame. The globe loads only as the section
// approaches, and its render loop sleeps off screen.
import { RM, FINE, qs, qsa, clamp, DESKTOP } from './util.js';
import { stars } from './sat.js';

const STEPS = [0, 0.3, 0.55, 0.74, 1];
const SENT = [0.6, 0.65, 0.7];        // scans sent while online
const QUEUED = [0.8, 0.84];           // scans made while the link is down
const SYNC = [0.9, 0.93];             // the queue leaving once the link is back
const DOWN = [0.76, 0.88];            // the link is down between these
const TRAVEL = 0.03;                  // progress a check-in takes from the gate to the servers
const D = Math.PI / 180;
const ORBIT = 1 + 550 / 6371;         // Starlink's main shells, to scale
const SATS = 31, GAP = (Math.PI * 2) / SATS;
// The dive: whole Earth over the Atlantic, to a low view across the UK. drop: how far the
// globe's centre sits below the box's centre, in box widths.
const V0 = { lat: 18, lon: -48, s: 1, drop: 0 };
const V1 = { lat: -6, lon: 5, s: 2.3, drop: 0.76 };

const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);
// COBE's conventions: a place as a unit vector, and the phi/theta that put a place at the centre.
const vec = (lat, lon) => { const a = lat * D, o = lon * D - Math.PI, c = Math.cos(a); return [-c * Math.cos(o), Math.sin(a), c * Math.sin(o)]; };
const centreOn = (lat, lon) => [Math.PI * 1.5 - lon * D, lat * D];
const GATE = vec(55.0, -1.6);
const SRV = vec(51.5, -0.4);
// One orbital plane over the gate, heading east; u is the angle along it from overhead.
const EAST = (() => { const l = Math.hypot(GATE[0], GATE[2]); return [GATE[2] / l, 0, -GATE[0] / l]; })();   // pole × gate
const orbitAt = (u) => [0, 1, 2].map((i) => ORBIT * (Math.cos(u) * GATE[i] + Math.sin(u) * EAST[i]));
const wrap = (u) => Math.atan2(Math.sin(u), Math.cos(u));

function story(p) {
  const k = smooth(seg(p, 0, 0.26));
  const down = p >= DOWN[0] && p < DOWN[1];
  const sent = SENT.concat(SYNC).filter((t) => p >= t + TRAVEL).length;
  const waiting = QUEUED.filter((t) => p >= t).length - SYNC.filter((t) => p >= t).length;
  return {
    k, down, sent, waiting,
    gate: seg(p, 0.18, 0.26),
    up: seg(p, 0.33, 0.45) * (1 - seg(p, DOWN[0], DOWN[0] + 0.02)) + seg(p, DOWN[1], DOWN[1] + 0.02) * (p >= DOWN[1] ? 1 : 0),
    downlink: seg(p, 0.55, 0.6) * (1 - seg(p, DOWN[0], DOWN[0] + 0.02)) + seg(p, DOWN[1] + 0.01, DOWN[1] + 0.03) * (p >= DOWN[1] ? 1 : 0),
    servers: seg(p, 0.53, 0.58),
    drift: -0.35 + p * 0.7,
  };
}

export function initGlobe() {
  const fig = qs('[data-globe]');
  if (!fig) return;
  const sec = fig.closest('section');
  const stage = qs('.sat__stage', sec);
  const box = qs('.sat-globe__box', fig);
  const earth = qs('.sat-globe__earth', box), over = qs('.sat-globe__over', box), ctx = over.getContext('2d');
  const labGate = qs('[data-l="gate"]', box), labSrv = qs('[data-l="srv"]', box);
  const read = { link: qs('[data-r="link"]', fig), sent: qs('[data-r="sent"]', fig), queue: qs('[data-r="queue"]', fig) };
  sec.classList.add('has-globe');
  if (stage) stars(stage);

  let p = RM ? 1 : 0, size = 0, dpr = 1, phi = 0, theta = 0, s = 1, drop = 0, globe = null, visible = false;
  let last = performance.now();
  const drag = { off: 0, vel: 0, down: false, x: 0, t: 0, idle: 0, back: 0, bv: 0 };
  const shown = {};
  const say = (key, v, cls) => {
    if (shown[key] === v + cls) return;
    shown[key] = v + cls;
    read[key].textContent = v;
    read[key].className = cls;
  };

  function project(g) {
    const cp = Math.cos(phi), sp = Math.sin(phi), ct = Math.cos(theta), st = Math.sin(theta);
    const x = cp * g[0] + sp * g[2];
    const y = sp * st * g[0] + ct * g[1] - cp * st * g[2];
    const z = -sp * ct * g[0] + st * g[1] + cp * ct * g[2];
    const R = size * 0.4 * s;
    return { x: size / 2 + x * R, y: size / 2 + drop * size - y * R, hid: z < 0 && x * x + y * y < 1 };
  }
  function layout() {
    size = box.clientWidth;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    over.width = over.height = Math.round(size * dpr);
  }

  // The readouts and labels follow the story even before the globe has loaded.
  function readouts(q) {
    if (q.gate < 1) say('link', 'Not connected', '');
    else if (q.down) say('link', 'Offline, recording', 'is-warn');
    else if (q.up >= 1) say('link', q.waiting > 0 || (p >= SYNC[0] && p < SYNC[SYNC.length - 1] + TRAVEL) ? 'Syncing' : 'Online', 'is-ok');
    else say('link', 'Searching', '');
    say('sent', String(q.sent), '');
    say('queue', String(q.waiting), q.waiting ? 'is-warn' : '');
  }

  function frame() {
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    // Drag: momentum, then after a moment's rest a critically damped spring back to the story.
    if (!drag.down) {
      if (Math.abs(drag.vel) > 0.02) { drag.off += drag.vel * dt; drag.vel *= Math.pow(0.04, dt); }
      else if ((drag.idle += dt) > 1.2) {
        const kk = 60, cc = 2 * Math.sqrt(kk);
        for (let h = dt; h > 0; h -= 1 / 240) { const step = Math.min(h, 1 / 240); drag.bv += (-kk * drag.off - cc * drag.bv) * step; drag.off += drag.bv * step; }
      }
    }
    const q = story(p);
    const [ph, th] = centreOn(lerp(V0.lat, V1.lat, q.k), lerp(V0.lon, V1.lon, q.k));
    phi = ph + drag.off; theta = th;
    s = lerp(V0.s, V1.s, q.k); drop = lerp(V0.drop, V1.drop, q.k);
    draw(q);
  }

  function draw(q) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    // The orbit, where it is clear of the Earth.
    ctx.fillStyle = 'rgba(242, 244, 244, 0.26)';
    for (let i = 0; i < 220; i++) {
      const o = project(orbitAt((i / 220) * Math.PI * 2));
      if (!o.hid) ctx.fillRect(o.x - 0.6, o.y - 0.6, 1.2, 1.2);
    }
    // Satellites: a body and two panels square to the path, with a short trail.
    let link = null;
    for (let i = 0; i < SATS; i++) {
      const u = q.drift + i * GAP, o = project(orbitAt(u));
      // The link rides the satellite that has most recently passed overhead.
      const w = wrap(u);
      if (w >= 0 && w < GAP) link = o;
      if (o.hid) continue;
      const tail = project(orbitAt(u - 0.035));
      const g = ctx.createLinearGradient(tail.x, tail.y, o.x, o.y);
      g.addColorStop(0, 'rgba(255, 255, 255, 0)'); g.addColorStop(1, 'rgba(255, 255, 255, 0.55)');
      ctx.strokeStyle = g; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(tail.x, tail.y); ctx.lineTo(o.x, o.y); ctx.stroke();
      ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(Math.atan2(o.y - tail.y, o.x - tail.x) + Math.PI / 2);
      ctx.fillStyle = '#fff'; ctx.fillRect(-1.6, -1.6, 3.2, 3.2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'; ctx.fillRect(-7, -0.8, 4, 1.6); ctx.fillRect(3, -0.8, 4, 1.6);
      ctx.restore();
    }
    const gq = project(GATE), sq = project(SRV);
    const warn = q.down || q.waiting > 0;
    const col = (a) => (warn ? `rgba(232, 162, 0, ${a})` : `rgba(15, 215, 106, ${a})`);
    // Each scan leaves the gate as a ring.
    if (q.gate > 0 && !gq.hid) {
      let rq = q.gate < 1 ? q.gate : -1;
      for (const t of SENT.concat(QUEUED)) if (p >= t && p < t + 0.03) rq = (p - t) / 0.03;
      if (rq >= 0) { ctx.strokeStyle = col((0.7 * (1 - rq)).toFixed(3)); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(gq.x, gq.y, 4 + rq * 18, 0, Math.PI * 2); ctx.stroke(); }
      dot(gq, 3.2, col(q.gate));
      // Scans waiting at the gate while the link is down.
      for (let i = 0; i < q.waiting; i++) dot({ x: gq.x + 9 + i * 7, y: gq.y - 9 }, 2.2, 'rgba(232, 162, 0, 1)');
    }
    if (q.servers > 0 && !sq.hid) { ring(sq, 4, `rgba(15, 215, 106, ${q.servers})`); dot(sq, 1.6, `rgba(15, 215, 106, ${q.servers})`); }
    place(labGate, gq, q.gate, -12, 4);
    place(labSrv, sq, q.servers, 12, 6);
    // The link: up to the satellite, then down to the servers.
    if (link && !gq.hid) {
      beam(gq, link, q.up);
      if (!sq.hid) beam(link, sq, q.downlink);
      for (const t of SENT.concat(SYNC)) {
        if (p < t || p >= t + TRAVEL) continue;
        const f = (p - t) / TRAVEL, a = f < 0.5 ? gq : link, b = f < 0.5 ? link : sq, h = f < 0.5 ? f * 2 : f * 2 - 1;
        dot({ x: lerp(a.x, b.x, h), y: lerp(a.y, b.y, h) }, 2.4, '#fff');
      }
    }
  }
  function dot(o, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, Math.PI * 2); ctx.fill(); }
  function ring(o, r, c) { ctx.strokeStyle = c; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, Math.PI * 2); ctx.stroke(); }
  function beam(a, b, f) {
    if (f <= 0) return;
    const x = lerp(a.x, b.x, f), y = lerp(a.y, b.y, f);
    ctx.save();
    ctx.shadowColor = 'rgba(15, 215, 106, 0.8)'; ctx.shadowBlur = 8;
    ctx.strokeStyle = 'rgba(15, 215, 106, 0.9)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(x, y); ctx.stroke();
    ctx.restore();
  }
  function place(lab, o, on, dx, dy) {
    lab.style.transform = `translate(${(o.x + dx).toFixed(1)}px, ${(o.y + dy).toFixed(1)}px)`;
    lab.classList.toggle('is-on', on > 0.5 && !o.hid);
  }

  // The globe itself, loaded as the section approaches.
  async function load() {
    if (globe) return;
    // Without the library or WebGL, the stage keeps its drawn horizon and the readouts still run.
    const fallback = () => { sec.classList.remove('has-globe'); globe = { toggle() {} }; };
    let createGlobe;
    try { ({ default: createGlobe } = await import(new URL('../assets/vendor/cobe.min.js', import.meta.url).href)); }
    catch { return fallback(); }
    layout();
    try { globe = createGlobe(earth, {
      devicePixelRatio: dpr, width: size * dpr, height: size * dpr,
      phi: 0, theta: 0, dark: 1, diffuse: 1.15, scale: 1,
      mapSamples: size > 520 ? 120000 : 60000, mapBrightness: 3.2,
      baseColor: [0.26, 0.29, 0.31], markerColor: [0.06, 0.84, 0.42], glowColor: [0.1, 0.26, 0.18],
      markers: [], opacity: 0.95,
      onRender: (state) => {
        frame();
        state.phi = phi; state.theta = theta; state.scale = s;
        // COBE's offset is in drawing-buffer pixels and moves the centre by scale × offset / 2.
        state.offset = [0, (2 * drop * size * dpr) / s];
        state.width = size * dpr; state.height = size * dpr;
      },
    }); } catch { return fallback(); }
    globe.toggle(visible);
    requestAnimationFrame(() => box.classList.add('is-ready'));
  }
  // Building the globe compiles its shaders, a ~200 ms main-thread task. It runs once, well before
  // the section, and only when the page has been still for a moment, so no scroll ever stutters.
  // A reader who never pauses still gets it: once the section is near, it builds straight away.
  let started = false, waiting = false, t = 0;
  const build = () => {
    if (started) return;
    started = true;
    clearTimeout(t);
    removeEventListener('scroll', quiet);
    load();
  };
  const quiet = () => {
    clearTimeout(t);
    t = setTimeout(() => (window.requestIdleCallback || ((f) => setTimeout(f, 1)))(build, { timeout: 1500 }), 300);
  };
  // Readers pause long before they reach this section (the hero, the invoice, the numbers), so
  // the first quiet moment after the page has settled is the time to build it.
  const wait = () => {
    if (waiting || started) return;
    waiting = true;
    addEventListener('scroll', quiet, { passive: true });
    quiet();
  };
  if (document.readyState === 'complete') setTimeout(wait, 1500);
  else addEventListener('load', () => setTimeout(wait, 1500), { once: true });
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) build();
    if (globe) globe.toggle(visible);
  }, { rootMargin: '60% 0px' }).observe(sec);
  window.addEventListener('resize', () => { if (globe) layout(); });

  // Drag to spin, with momentum (fine pointers; on touch the page scrolls instead).
  if (FINE && !RM) {
    box.addEventListener('pointerdown', (e) => { drag.down = true; drag.x = e.clientX; drag.t = performance.now(); drag.vel = 0; drag.bv = 0; box.setPointerCapture(e.pointerId); });
    box.addEventListener('pointermove', (e) => {
      if (!drag.down) return;
      const now = performance.now(), dx = e.clientX - drag.x;
      drag.off += dx * 0.006;
      // A short running average of the pointer's speed, so one jittery event does not set the throw.
      drag.vel = drag.vel * 0.4 + ((dx * 0.006) / Math.max(1, now - drag.t)) * 1000 * 0.6;
      drag.x = e.clientX; drag.t = now; drag.idle = 0;
    });
    // The throw is the pointer's speed at release: one that stopped before letting go throws nothing.
    const up = () => { if (performance.now() - drag.t > 60) drag.vel = 0; drag.down = false; drag.idle = 0; };
    box.addEventListener('pointerup', up);
    box.addEventListener('pointercancel', up);
  }

  // Progress: the scroll position, read by the next frame the globe draws.
  function at(v) { p = v; readouts(story(p)); }
  if (RM) { at(1); return; }

  // Desktop: the globe fills the stage, the section pins and a stepper follows the story.
  const steps = qsa('.sat__steps li', sec);
  const bars = steps.map((st) => qs('i', st));
  const cap = qs('.sat__cap', fig), capN = cap && qs('.sat__cap-n', cap), capT = cap && qs('.sat__cap-t', cap);
  let stepAt = -1;
  function paint(v) {
    at(v);
    bars.forEach((b, i) => { b.style.transform = 'scaleX(' + seg(v, STEPS[i], STEPS[i + 1]).toFixed(4) + ')'; });
    const f = STEPS.findIndex((b, i) => i < steps.length && v < STEPS[i + 1]);
    const i = f < 0 ? steps.length - 1 : f;
    if (i === stepAt) return;
    stepAt = i;
    steps.forEach((st, k) => st.classList.toggle('is-on', k === i));
    // The caption carries the current step's explanation, swapped with a short fade.
    if (cap) {
      capN.textContent = qs('.mono', steps[i]).textContent;
      capT.textContent = qs('p', steps[i]).textContent;
      cap.classList.remove('is-in');
      void cap.offsetWidth;
      cap.classList.add('is-in');
    }
  }
  const mm = gsap.matchMedia();
  mm.add(DESKTOP, () => {
    sec.classList.add('is-scene');
    stage.appendChild(box);
    layout();
    const st = ScrollTrigger.create({
      trigger: sec, start: 'top top', end: () => '+=' + Math.round(window.innerHeight * 2.6),
      pin: true,
      onUpdate: (self) => paint(self.progress),
      onRefresh: (self) => paint(self.progress),
    });
    paint(st.progress);
    return () => {
      sec.classList.remove('is-scene');
      fig.appendChild(box);
      layout();
      steps.forEach((x) => x.classList.remove('is-on'));
      stepAt = -1;
    };
  });
  // Smaller screens: the story plays as the globe scrolls up the screen.
  mm.add('(max-width: 1023px)', () => {
    const st = ScrollTrigger.create({
      trigger: box, start: 'top 85%', end: 'bottom 35%',
      onUpdate: (self) => at(self.progress),
      onRefresh: (self) => at(self.progress),
    });
    at(st.progress);
  });
}
