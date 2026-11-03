// The cursor's companion: an emerald ring that trails a fine pointer on a live spring and says what
// is under it. Over a link or a button it opens and fills a little; over a card it widens; where an
// element names an action (data-cursor="Play") it becomes a pill with that word; over a field or a
// form it steps away, so typing keeps the system cursor alone. The system cursor always stays.
// Transform and opacity only. Fine pointers only, never with reduced motion.
import { RM, FINE } from './util.js';
import { follow } from './motion.js';

const PRESS = 'a[href], button, [role="button"], summary, label.chip, .qa__q';
// Sliders are quiet too: their thumb is the target, and a ring would trail it like a second one.
const QUIET = 'input, textarea, select, iframe, [contenteditable="true"], [role="slider"], .bkf';
const CARD = '.card, .hx-card, .leak, .zoom, .chart';

export function initCursor() {
  if (RM || !FINE) return;
  const el = document.createElement('div');
  el.className = 'cur';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<i class="cur__ring"><span class="cur__t"></span></i>';
  document.body.appendChild(el);
  const word = el.querySelector('.cur__t');

  let queued = false;
  const render = () => { queued = false; el.style.transform = 'translate3d(' + x.value.toFixed(1) + 'px,' + y.value.toFixed(1) + 'px,0)'; };
  const draw = () => { if (!queued) { queued = true; requestAnimationFrame(render); } };
  const x = follow(draw, { response: 0.28, value: -100 }), y = follow(draw, { response: 0.28, value: -100 });
  let seen = false, state = '';

  const set = (s, label) => {
    if (s === state && (s !== 'say' || word.textContent === label)) return;
    state = s;
    el.dataset.state = s;
    if (s === 'say') word.textContent = label;
  };
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (!seen) { seen = true; x.jump(e.clientX); y.jump(e.clientY); el.classList.add('is-on'); }
    x.to(e.clientX); y.to(e.clientY);
  }, { passive: true });
  const read = (t) => {
    if (!(t instanceof Element)) return;
    const say = t.closest('[data-cursor]');
    if (t.closest(QUIET)) set('quiet');
    else if (t.closest(PRESS)) set('press');
    // The film says what a click will do.
    else if (say) set('say', say.classList.contains('watch__screen') && say.closest('.is-playing') ? 'Pause' : say.getAttribute('data-cursor'));
    else if (t.closest(CARD)) set('card');
    else set('');
  };
  document.addEventListener('pointerover', (e) => read(e.target), { passive: true });
  // A click can change what the next one does (the film starts): read it again once it has.
  document.addEventListener('click', (e) => setTimeout(() => read(e.target), 60), { passive: true });
  // Out of the window or into a frame (a form from another site): gone until the pointer is back.
  document.addEventListener('pointerout', (e) => { if (!e.relatedTarget) el.classList.remove('is-on'); }, { passive: true });
  document.addEventListener('pointerover', () => { if (seen) el.classList.add('is-on'); }, { passive: true });
  document.addEventListener('pointerdown', () => el.classList.add('is-down'), { passive: true });
  document.addEventListener('pointerup', () => el.classList.remove('is-down'), { passive: true });
}
