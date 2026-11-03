// Installation: the gate goes online by satellite, told as one scene driven by scroll.
// The terminal is mounted at the gate and its cable runs to the site cabin; the Starlink dish
// rises; satellites cross the orbit and the link locks onto the one in view. Each scan leaves the
// gate as a packet, along the cable and up the beam. Then the link drops: scans queue at the
// gate, and the queue drains when the next satellite comes into view.
// The scene is a pure function of progress (render(p)), so it scrubs both ways. It serves the
// installation page; the homepage tells the same story on a globe (js/globe.js).
// - Desktop: the first part plays as the page opens, then the section pins and scroll carries it.
// - Smaller screens: the scene plays as the panel scrolls up the screen.
// Reduced motion: the finished state, online and synced, with nothing moving.
// Transform and opacity only: positions are SVG transforms written per frame.
import { RM, qs, qsa, clamp, DESKTOP } from './util.js';
import { springSoft } from './motion.js';

const W = 640, H = 400;
const R = 1560, CX = 320, CY = 1640;          // the orbit: a wide arc across the top
const VIEW = [-10, 7];                        // degrees of orbit the dish can see
const SPACING = 21;                           // degrees between satellites
const DISH = [238, 238];                      // centre of the dish panel
// The cable, from the terminal down its post, along the ground, up the cabin and the mast.
const ROUTE = [[540, 286], [540, 326], [250, 326], [250, 262], [238, 262], [238, 238]];
const SENT = [0.58, 0.63, 0.68];              // scans sent while online
const QUEUED = [0.82, 0.86];                  // scans made while the link is down
const SYNC = [0.9, 0.93];                     // the queue leaving once the link is back
const TRAVEL = 0.03;                          // progress a packet takes to reach the satellite

const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
const orbit = (deg) => {
  const a = (deg * Math.PI) / 180;
  return [CX + R * Math.sin(a), CY - R * Math.cos(a)];
};
// The constellation waits off to the left, then drifts right as the story runs.
const drift = (p) => (p < 0.36 ? -13 : -13 + ((p - 0.36) / 0.64) * 29);
const pct = (x, y) => 'left:' + ((x / W) * 100).toFixed(2) + '%;top:' + ((y / H) * 100).toFixed(2) + '%';

const legs = ROUTE.slice(1).map((pt, i) => Math.hypot(pt[0] - ROUTE[i][0], pt[1] - ROUTE[i][1]));
const cableLen = legs.reduce((s, v) => s + v, 0);
function along(d) {
  for (let i = 0; i < legs.length; i++) {
    if (d <= legs[i]) {
      const t = d / legs[i], a = ROUTE[i], b = ROUTE[i + 1];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    d -= legs[i];
  }
  return ROUTE[ROUTE.length - 1];
}

function markup() {
  const [ax, ay] = orbit(-14), [bx, by] = orbit(14);
  const arms = [250, 262, 274, 286, 298, 310, 322].map((y) => `<line x1="452" y1="${y}" x2="516" y2="${y}"/>`).join('');
  // A satellite: a body between two solar panels, with a halo that lights while it carries the link.
  const sat = '<g class="s-sat"><circle class="s-sat__halo" r="12"/><rect class="s-sat__arm" x="-9" y="-0.6" width="18" height="1.2"/><rect x="-15" y="-2.6" width="8" height="5.2" rx="0.8"/><rect x="7" y="-2.6" width="8" height="5.2" rx="0.8"/><rect x="-3.2" y="-3.2" width="6.4" height="6.4" rx="1.6"/></g>';
  return `<svg viewBox="0 0 ${W} ${H}" focusable="false" aria-hidden="true">
  <defs><clipPath id="s-cable-clip"><rect class="s-cable-clip" x="232" y="230" width="316" height="104"/></clipPath></defs>
  <g class="s-sky">
    <path class="s-orbit" d="M${ax.toFixed(1)} ${ay.toFixed(1)} A${R} ${R} 0 0 1 ${bx.toFixed(1)} ${by.toFixed(1)}"/>
    <g class="s-beam"><line class="s-beam__glow" x1="0" y1="0" x2="0" y2="-100"/><line class="s-beam__core" x1="0" y1="0" x2="0" y2="-100"/></g>
    ${sat}${sat}${sat}
    <circle class="s-ping" r="7"/>
  </g>
  <g class="s-site">
    <line class="s-ground" x1="24" y1="332" x2="616" y2="332"/>
    <g class="s-line"><rect x="330" y="232" width="118" height="100"/><rect x="560" y="232" width="56" height="100"/><rect x="448" y="236" width="72" height="96"/><line x1="484" y1="236" x2="484" y2="332"/>${arms}</g>
    <line class="s-post" x1="540" y1="244" x2="540" y2="332"/>
  </g>
  <g class="s-cabin s-line"><line x1="90" y1="262" x2="252" y2="262"/><rect x="96" y="262" width="150" height="70"/><rect x="110" y="278" width="34" height="20"/><rect x="156" y="278" width="34" height="20"/><rect x="204" y="280" width="26" height="52"/></g>
  <polyline class="s-cable" clip-path="url(#s-cable-clip)" points="${ROUTE.slice(0, 5).map((p) => p.join(',')).join(' ')}"/>
  <g class="s-dish"><line class="s-mast" x1="238" y1="262" x2="238" y2="242"/><g class="s-panel" transform="translate(238 238)"><rect x="-18" y="-2.5" width="36" height="5" rx="1.5"/></g></g>
  <g class="s-term">
    <rect class="s-term__body" x="530" y="254" width="20" height="32" rx="3"/>
    <rect class="s-screen" x="533" y="258" width="14" height="18" rx="1.5"/>
    <g class="s-screen-on"><rect x="533" y="258" width="14" height="18" rx="1.5"/><path d="M536.6 267.2l2.4 2.4 4.6-4.8"/></g>
    <circle class="s-led s-led--ok" cx="540" cy="281.5" r="1.3"/><circle class="s-led s-led--warn" cx="540" cy="281.5" r="1.3"/>
    <rect class="s-q" x="534" y="244" width="12" height="4" rx="1"/><rect class="s-q" x="534" y="238" width="12" height="4" rx="1"/>
  </g>
  <circle class="s-ring" r="10"/>
  <g class="s-pkt"><circle class="s-pkt__glow" r="7"/><circle r="3.2"/></g>
</svg>
<span class="sat__lab" style="${pct(540, 344)}">Site terminal</span>
<span class="sat__lab sat__lab--end" style="${pct(208, 236)}">Starlink dish</span>`;
}

function scene(fig) {
  const box = qs('.sat__fig', fig);
  box.innerHTML = markup();
  const $ = (s) => qs(s, box), $$ = (s) => qsa(s, box);
  const site = $('.s-site'), cabin = $('.s-cabin'), term = $('.s-term'), clip = $('.s-cable-clip');
  const dish = $('.s-dish'), panel = $('.s-panel'), sky = $('.s-sky'), beam = $('.s-beam'), ping = $('.s-ping');
  const sats = $$('.s-sat'), halos = $$('.s-sat__halo');
  const pkt = $('.s-pkt'), on = $('.s-screen-on'), ring = $('.s-ring');
  const ledOk = $('.s-led--ok'), ledWarn = $('.s-led--warn'), queue = $$('.s-q'), labs = $$('.sat__lab');
  const read = { link: qs('[data-r="link"]', fig), sent: qs('[data-r="sent"]', fig), queue: qs('[data-r="queue"]', fig) };
  const shown = {};
  const say = (k, v, cls) => {
    if (!read[k] || shown[k] === v + cls) return;
    shown[k] = v + cls;
    read[k].textContent = v;
    read[k].className = cls;
  };
  const fade = (el, o) => { el.style.opacity = o.toFixed(3); };
  const move = (el, x, y, s = 1) => el.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})${s !== 1 ? ` scale(${s.toFixed(3)})` : ''}`);

  return function render(p) {
    // The site: ground, hoarding and gate, then the cabin.
    const a = springSoft(seg(p, 0, 0.1)), c = springSoft(seg(p, 0.05, 0.16));
    fade(site, a); move(site, 0, (1 - a) * 8);
    fade(cabin, c); move(cabin, 0, (1 - c) * 8);
    // The terminal arrives and fixes to its post.
    const m = springSoft(seg(p, 0.12, 0.24));
    fade(term, m); move(term, 0, (1 - m) * -14);
    fade(labs[0], m);
    // Its cable runs back to the cabin.
    const k = springSoft(seg(p, 0.2, 0.32));
    clip.setAttribute('transform', `translate(548 0) scale(${k.toFixed(4)} 1) translate(-548 0)`);
    // The dish rises on the cabin roof.
    const d = springSoft(seg(p, 0.28, 0.38));
    fade(dish, d); fade(labs[1], d);
    panel.setAttribute('transform', `translate(238 238) rotate(${(-28 * d).toFixed(2)})`);
    // The orbit: satellites drift left to right, and the link locks onto the one in view.
    fade(sky, springSoft(seg(p, 0.3, 0.4)));
    const psi = drift(p);
    let best = -1, margin = 0, sat = null;
    sats.forEach((g, i) => {
      const deg = psi + (1 - i) * SPACING;
      const [x, y] = orbit(deg);
      move(g, x, y);
      const mg = Math.min(deg - VIEW[0], VIEW[1] - deg);
      if (mg > margin) { margin = mg; best = i; sat = [x, y]; }
    });
    const lock = best < 0 ? 0 : clamp(margin / 1.2, 0, 1) * (d > 0.98 ? 1 : 0);
    halos.forEach((h, i) => fade(h, i === best ? lock : 0));
    let beamLen = 0;
    if (sat) {
      const dx = sat[0] - DISH[0], dy = sat[1] - DISH[1];
      beamLen = Math.hypot(dx, dy);
      const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
      beam.setAttribute('transform', `translate(${DISH[0]} ${DISH[1]}) rotate(${deg.toFixed(2)}) scale(1 ${((beamLen - 9) / 100).toFixed(3)})`);
    }
    fade(beam, lock);
    const online = lock > 0.5;

    // Scans: the screen flashes green and a ring leaves the terminal.
    let flash = 0, rq = -1;
    for (const t of SENT.concat(QUEUED)) {
      if (p >= t && p < t + 0.036) flash = Math.max(flash, p < t + 0.006 ? (p - t) / 0.006 : 1 - (p - t - 0.006) / 0.03);
      if (p >= t && p < t + 0.03) rq = (p - t) / 0.03;
    }
    fade(on, flash);
    if (rq >= 0) { move(ring, 540, 270, 1 + rq * 2.2); fade(ring, (1 - rq) * 0.7); } else fade(ring, 0);

    // Packets: one in flight at a time, along the cable then up the beam.
    let flying = false, landed = -1;
    for (const t of SENT.concat(SYNC)) {
      if (p >= t && p < t + TRAVEL && sat) {
        const u = springSoft((p - t) / TRAVEL), dist = u * (cableLen + beamLen);
        const pt = dist <= cableLen ? along(dist) : (() => {
          const f = (dist - cableLen) / beamLen;
          return [DISH[0] + (sat[0] - DISH[0]) * f, DISH[1] + (sat[1] - DISH[1]) * f];
        })();
        move(pkt, pt[0], pt[1]);
        flying = true;
      }
      if (p >= t + TRAVEL && p < t + TRAVEL + 0.025) landed = (p - t - TRAVEL) / 0.025;
    }
    fade(pkt, flying ? 1 : 0);
    if (landed >= 0 && sat) { move(ping, sat[0], sat[1], 1 + landed * 1.8); fade(ping, (1 - landed) * 0.8); } else fade(ping, 0);

    // The record: what has been sent, and what is waiting at the gate.
    const sent = SENT.concat(SYNC).filter((t) => p >= t + TRAVEL).length;
    const waiting = QUEUED.filter((t) => p >= t).length - SYNC.filter((t) => p >= t).length;
    queue.forEach((q, i) => fade(q, waiting > i ? 1 : 0));
    const syncing = online && (waiting > 0 || (p >= SYNC[0] && p < SYNC[SYNC.length - 1] + TRAVEL));
    const down = d > 0.98 && !online && p > 0.5;
    fade(ledOk, online ? 1 : 0); fade(ledWarn, down ? 1 : 0);
    if (d < 0.98) say('link', 'Not connected', '');
    else if (online) say('link', syncing ? 'Syncing' : 'Online', 'is-ok');
    else if (down) say('link', 'Offline, recording', 'is-warn');
    else say('link', 'Searching', '');
    say('sent', String(sent), '');
    say('queue', String(waiting), waiting ? 'is-warn' : '');
  };
}

// At the top of a page (desktop): the first part plays on its own as the page opens (the site,
// the terminal, the dish, the link), then the section pins and scroll carries the rest.
// Smaller screens: the whole story plays as the panel scrolls up the screen.
function intro(fig, sec, render) {
  const mm = gsap.matchMedia();
  mm.add(DESKTOP, () => {
    const state = { p: 0 };
    let sp = 0;
    const draw = () => render(sp > 0 ? Math.max(state.p, 0.45 + 0.55 * sp) : state.p);
    gsap.to(state, { p: 0.45, duration: 1.8, ease: 'springSoft', delay: 0.3, onUpdate: draw });
    ScrollTrigger.create({
      trigger: sec, start: 'top top', end: () => '+=' + Math.round(window.innerHeight * 1.4),
      pin: true,
      onUpdate: (self) => { sp = self.progress; draw(); },
    });
    draw();
  });
  mm.add('(max-width: 1023px)', () => {
    const st = ScrollTrigger.create({
      trigger: qs('.sat__fig', fig), start: 'top 82%', end: 'bottom 22%',
      onUpdate: (self) => render(self.progress),
      onRefresh: (self) => render(self.progress),
    });
    render(st.progress);
  });
}

// A fixed, irregular starfield for the stage, seeded so it is the same on every visit. It is
// drawn at true pixel size (never scaled), so the stars stay pin-points on every screen.
export function stars(stage) {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let dots = '';
  for (let i = 0; i < 220; i++) {
    const x = rnd() * 1920, y = rnd() * 1080, r = rnd() < 0.86 ? 0.7 : 1.25, o = 0.14 + rnd() * 0.46;
    dots += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + r + '" fill-opacity="' + o.toFixed(2) + '"/>';
  }
  stage.insertAdjacentHTML('afterbegin', '<svg class="sat__stars" width="1920" height="1080" viewBox="0 0 1920 1080" aria-hidden="true" focusable="false">' + dots + '</svg>');
}

export function initSat() {
  qsa('[data-sat]').forEach((fig) => {
    const sec = fig.closest('section');
    const stage = qs('.sat__stage', sec);
    if (stage) stars(stage);
    const render = scene(fig);
    if (RM) { render(1); return; }
    intro(fig, sec, render);
  });
}
