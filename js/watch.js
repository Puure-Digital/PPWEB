// The explainer film (index.html#watch): the site's own player, its track split into the film's
// chapters. The chapter playing names the part of the page that shows it, with a link there.
// Following the link pauses the film, and a pill at the foot of the screen (#watch-back) offers the
// way back: the page returns to the film, which plays on from where it left off. The film only plays
// while it is on screen; leaving it mid-play pauses it and brings up the same pill.
import { RM, FINE, qs, qsa, clamp } from './util.js';
import { lenis } from './scroll.js';
import { springSoft, follow } from './motion.js';

const mmss = (t) => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');

export function initWatch() {
  // The transcript opens below the film and moves every scene under it: re-measure them.
  const tx = document.querySelector('.watch__tx');
  if (tx) tx.addEventListener('toggle', () => ScrollTrigger.refresh());
  const root = qs('#watch');
  if (!root) return;
  const video = qs('.watch__video', root), screen = qs('.watch__screen', root);
  const big = qs('.watch__big', root), track = qs('.watch__track', root), tip = qs('.watch__tip', root);
  const playBtn = qs('[data-act="play"]', root);
  const now = (k) => qs('[data-now="' + k + '"]', root);
  const back = qs('#watch-back'), backT = qs('.wback__t', back);
  const total = Number(root.dataset.duration);
  // The cover (the gate at dusk) is set as the player comes near, not with the page; phones take
  // the smaller cut.
  if (video.dataset.poster) {
    const cover = () => video.setAttribute('poster', window.innerWidth < 768 ? video.dataset.poster.replace('-1600.', '-800.') : video.dataset.poster);
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); cover(); } }, { rootMargin: '600px 0px' });
    io.observe(screen);
  }
  const ch = qsa('.watch__ch button', root).map((b) => ({ b, t: Number(b.dataset.t), to: b.dataset.to, go: b.dataset.go, name: qs('.watch__n', b).textContent, p: qs('.watch__p', b) }));
  ch.forEach((c, i) => { c.end = i + 1 < ch.length ? ch[i + 1].t : total; });

  // The track: one segment per chapter, as long as the chapter.
  ch.forEach((c) => {
    const seg = document.createElement('span');
    seg.className = 'watch__seg';
    seg.style.flexGrow = (c.end - c.t).toFixed(2);
    c.fill = seg.appendChild(document.createElement('i'));
    track.insertBefore(seg, tip);
  });
  const wait = screen.appendChild(document.createElement('span'));
  wait.className = 'watch__wait spin';
  wait.setAttribute('aria-hidden', 'true');

  let cur = -1, raf = 0, idleT, scrub = null, wasPlaying = false;
  const at = (t) => { let i = 0; while (i + 1 < ch.length && t >= ch[i + 1].t - 0.05) i++; return i; };
  const part = (c, t) => clamp((t - c.t) / (c.end - c.t), 0, 1).toFixed(4);
  const play = () => { const p = video.play(); if (p) p.catch(() => {}); };

  function chapter(i) {
    if (cur >= 0) { ch[cur].b.removeAttribute('aria-current'); ch[cur].p.style.transform = 'scaleX(0)'; }
    cur = i;
    const c = ch[i];
    c.b.setAttribute('aria-current', 'true');
    now('i').textContent = String(i + 1).padStart(2, '0');
    now('name').textContent = c.name;
    now('label').textContent = c.go;
    now('go').setAttribute('href', c.to);
  }
  function paint() {
    const t = video.currentTime || 0, i = at(t);
    if (i !== cur) chapter(i);
    ch.forEach((c) => { c.fill.style.transform = 'scaleX(' + part(c, t) + ')'; });
    ch[i].p.style.transform = 'scaleX(' + part(ch[i], t) + ')';
    now('time').textContent = mmss(t);
    track.setAttribute('aria-valuenow', Math.round(t));
    track.setAttribute('aria-valuetext', mmss(t) + ' of ' + mmss(total) + ', ' + ch[i].name);
  }
  const loop = () => { paint(); raf = requestAnimationFrame(loop); };

  // While it plays on a fine pointer, the controls step aside after a moment without movement
  // (never while a key has focus in them).
  function idle() {
    screen.classList.remove('is-idle');
    clearTimeout(idleT);
    if (FINE) idleT = setTimeout(() => { if (!video.paused && !scrub && !qs(':focus-visible', screen)) screen.classList.add('is-idle'); }, 2200);
  }
  screen.addEventListener('pointermove', idle);
  screen.addEventListener('focusin', idle);

  video.addEventListener('play', () => {
    screen.classList.add('is-started', 'is-playing');
    screen.classList.remove('is-ended');
    playBtn.setAttribute('aria-label', 'Pause');
    cancelAnimationFrame(raf);
    loop();
    idle();
  });
  video.addEventListener('pause', () => {
    screen.classList.remove('is-playing', 'is-idle', 'is-waiting');
    playBtn.setAttribute('aria-label', 'Play');
    cancelAnimationFrame(raf);
    paint();
  });
  video.addEventListener('waiting', () => screen.classList.add('is-waiting'));
  video.addEventListener('playing', () => screen.classList.remove('is-waiting'));
  video.addEventListener('ended', () => {
    screen.classList.add('is-ended');
    qs('.watch__big-l', big).textContent = 'Watch again';
    hideBack();
  });
  video.addEventListener('timeupdate', () => { if (video.paused) paint(); });

  big.addEventListener('click', () => { if (video.ended) video.currentTime = 0; play(); });
  video.addEventListener('click', () => (video.paused ? play() : video.pause()));
  playBtn.addEventListener('click', () => (video.paused ? play() : video.pause()));
  const mute = qs('[data-act="mute"]', root);
  mute.addEventListener('click', () => { video.muted = !video.muted; mute.setAttribute('aria-pressed', String(video.muted)); });
  // Captions (a WebVTT track) are drawn in the site's own type, on a layer that rises above the
  // controls while they show. iPhone's own full-screen player draws them itself.
  const cc = qs('[data-act="cc"]', root), line = qs('.watch__cc', root), captions = video.textTracks[0];
  if (captions) {
    captions.mode = 'hidden';
    captions.addEventListener('cuechange', () => { line.textContent = captions.activeCues.length ? captions.activeCues[0].text : ''; });
    cc.addEventListener('click', () => {
      const on = cc.getAttribute('aria-pressed') !== 'true';
      cc.setAttribute('aria-pressed', String(on));
      screen.classList.toggle('is-cc', on);
      line.classList.toggle('is-on', on);
    });
    // Phones: the film's own words fill the foot of so small a frame, so captions sit under the
    // player instead, and go back inside it for full screen.
    const under = window.matchMedia('(max-width: 767px)');
    const place = () => {
      if (under.matches && document.fullscreenElement !== screen) { if (line.previousElementSibling !== screen.parentNode) screen.parentNode.after(line); }
      else if (line.parentNode !== screen) video.after(line);
    };
    under.addEventListener('change', place);
    document.addEventListener('fullscreenchange', place);
    place();
    video.addEventListener('webkitbeginfullscreen', () => { captions.mode = screen.classList.contains('is-cc') ? 'showing' : 'hidden'; });
    video.addEventListener('webkitendfullscreen', () => { captions.mode = 'hidden'; });
  } else cc.hidden = true;
  qs('[data-act="full"]', root).addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (screen.requestFullscreen) screen.requestFullscreen().catch(() => {});
    else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
  });
  ch.forEach((c) => c.b.addEventListener('click', () => { video.currentTime = c.t + 0.01; paint(); play(); }));

  // Seeking: by the segment under the pointer, so the gaps between chapters cost no time. Held, the
  // film waits and follows the pointer; let go, it plays on if it was playing.
  function timeAt(x) {
    for (const c of ch) {
      const r = c.fill.parentNode.getBoundingClientRect();
      if (x <= r.right + 1.5) return c.t + clamp((x - r.left) / r.width, 0, 1) * (c.end - c.t);
    }
    return total;
  }
  const seek = (t) => { video.currentTime = clamp(t, 0, total - 0.1); paint(); };
  track.addEventListener('pointerdown', (e) => {
    if (e.button) return;
    track.setPointerCapture(e.pointerId);
    scrub = { resume: !video.paused };
    video.pause();
    seek(timeAt(e.clientX));
  });
  track.addEventListener('pointermove', (e) => {
    if (scrub) seek(timeAt(e.clientX));
    if (!FINE) return;
    const t = timeAt(e.clientX), r = track.getBoundingClientRect(), w = tip.offsetWidth / 2;
    tip.textContent = ch[at(t)].name + ' · ' + mmss(t);
    tip.style.setProperty('--x', clamp(e.clientX - r.left, w, r.width - w).toFixed(0) + 'px');
  });
  const release = () => { if (scrub && scrub.resume) play(); scrub = null; };
  track.addEventListener('pointerup', release);
  track.addEventListener('pointercancel', release);
  track.addEventListener('keydown', (e) => {
    const t = video.currentTime, i = at(t);
    const to = {
      ArrowLeft: t - 5, ArrowDown: t - 5, ArrowRight: t + 5, ArrowUp: t + 5, Home: 0, End: total,
      // A chapter back from early in a chapter goes to the one before; later, to this one's start.
      PageUp: ch[t - ch[i].t < 1.5 ? Math.max(0, i - 1) : i].t, PageDown: ch[Math.min(ch.length - 1, i + 1)].t,
    }[e.key];
    if (to == null) return;
    e.preventDefault();
    seek(to);
  });

  // The way back.
  function showBack() {
    backT.textContent = mmss(video.currentTime || 0);
    back.classList.add('is-on');
    back.inert = false;
  }
  function hideBack() {
    back.classList.remove('is-on');
    back.inert = true;
  }
  // Touch: the pill can be flicked away. It follows the finger 1:1 once it has travelled 10 px
  // (until then it is a tap), resisting more the further it is pulled up. At release the throw is
  // projected to where it would come to rest (Apple's deceleration, 0.998 a millisecond): past
  // most of the pill's height it goes, otherwise it returns. Either way the finger's speed is
  // handed to the spring that finishes the move (damping 0.8: this motion carries momentum).
  const rubber = (o, d = 120, c = 0.55) => (o * d * c) / (d + c * Math.abs(o));
  let swipe = null, gone = 0, eat = 0; // gone: the off-screen distance it is being thrown to
  const pull = follow((y) => {
    back.style.transform = 'translate(-50%, ' + y.toFixed(1) + 'px)';
    // Gone: hidden, and the spring put to rest at 0, which clears the finger's offset below.
    if (gone && y >= gone - 0.5) { gone = 0; hideBack(); wasPlaying = false; pull.jump(0); }
    else if (!gone && !swipe && Math.abs(y) < 0.05) { back.style.transform = ''; back.classList.remove('is-held'); }
  }, { response: 0.3, damping: 0.8, eps: 0.05 });
  back.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || RM) return;
    swipe = { id: e.pointerId, y0: e.clientY, live: false, trail: [] };
  });
  back.addEventListener('pointermove', (e) => {
    if (!swipe || e.pointerId !== swipe.id) return;
    const dy = e.clientY - swipe.y0;
    if (!swipe.live) {
      if (Math.abs(dy) < 10) return;
      swipe.live = true;
      back.setPointerCapture(e.pointerId);
      back.classList.add('is-held');
    }
    const y = dy >= 0 ? dy : rubber(dy);
    pull.jump(y);
    swipe.trail.push([e.timeStamp, y]);
    if (swipe.trail.length > 5) swipe.trail.shift();
  });
  const letGo = (e) => {
    if (!swipe || e.pointerId !== swipe.id) return;
    const s = swipe;
    swipe = null;
    if (!s.live) return;
    eat = performance.now(); // the release must not also press the button under the finger
    const [t0, y0] = s.trail[0], [t1, y1] = s.trail[s.trail.length - 1];
    const v = t1 - t0 > 0 && e.timeStamp - t1 < 60 ? ((y1 - y0) / (t1 - t0)) * 1000 : 0;
    const rest = y1 + ((v / 1000) * 0.998) / (1 - 0.998);
    gone = rest > back.offsetHeight * 0.6 ? window.innerHeight - back.getBoundingClientRect().top + y1 + 8 : 0;
    pull.to(gone, v);
  };
  back.addEventListener('pointerup', letGo);
  back.addEventListener('pointercancel', letGo);
  back.addEventListener('click', (e) => { if (performance.now() - eat < 400) { e.stopPropagation(); e.preventDefault(); } }, true);
  now('go').addEventListener('click', () => {
    // js/scroll.js makes the jump; the film waits here.
    wasPlaying = !video.paused;
    video.pause();
    showBack();
  });
  new IntersectionObserver(([e]) => {
    if (e.intersectionRatio >= 0.25) { hideBack(); return; }
    if (!video.paused) { wasPlaying = true; video.pause(); showBack(); }
  }, { threshold: [0, 0.25] }).observe(screen);
  qs('.wback__go', back).addEventListener('click', () => {
    hideBack();
    // The film lands centred in the screen, below the nav when the screen is short.
    const r = screen.getBoundingClientRect(), nav = qs('#nav');
    const y = Math.max(0, r.top + window.scrollY - Math.max((nav ? nav.offsetHeight : 0) + 16, (window.innerHeight - r.height) / 2));
    const duration = Math.min(1.4, 0.8 + Math.abs(y - window.scrollY) / 8000);
    const land = () => {
      (screen.classList.contains('is-started') ? playBtn : big).focus({ preventScroll: true });
      if (wasPlaying) play();
      wasPlaying = false;
    };
    if (lenis) lenis.scrollTo(y, { duration, easing: springSoft, onComplete: land });
    else { window.scrollTo({ top: y, behavior: RM ? 'auto' : 'smooth' }); setTimeout(land, RM ? 0 : duration * 1000); }
  });
  qs('.wback__x', back).addEventListener('click', () => { hideBack(); wasPlaying = false; });

  paint();
}
