// Pointer micro-interactions: magnetic primary buttons and a soft spotlight on cards.
// Both move by transform only. Fine pointers only, and never with reduced motion.
import { RM, FINE, qsa } from './util.js';
import { follow } from './motion.js';

export function initFx() {
  if (RM || !FINE) return;

  // Buttons lean toward the pointer and settle back, on live critically damped springs (one per
  // axis) that carry their velocity when the pointer turns or leaves.
  qsa('[data-magnetic]').forEach((el) => {
    const wrap = document.createElement('span');
    wrap.className = 'mag';
    el.parentNode.insertBefore(wrap, el);
    wrap.appendChild(el);
    const draw = () => { wrap.style.transform = 'translate(' + x.value.toFixed(2) + 'px, ' + y.value.toFixed(2) + 'px)'; };
    const x = follow(draw, { response: 0.35 }), y = follow(draw, { response: 0.35 });
    wrap.addEventListener('pointermove', (e) => {
      // Measured without the lean, so the pull is from where the button sits.
      const r = wrap.getBoundingClientRect();
      x.to((e.clientX - (r.left - x.value + r.width / 2)) * 0.2);
      y.to((e.clientY - (r.top - y.value + r.height / 2)) * 0.28);
    });
    wrap.addEventListener('pointerleave', () => { x.to(0); y.to(0); });
  });

  // Spotlight: a fixed-size soft light inside a clipping layer, moved to the pointer.
  qsa('.spot').forEach((el) => {
    const layer = document.createElement('span');
    layer.className = 'spot__l';
    layer.setAttribute('aria-hidden', 'true');
    const light = document.createElement('i');
    layer.appendChild(light);
    el.appendChild(layer);
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      light.style.transform = 'translate(' + (e.clientX - r.left).toFixed(0) + 'px, ' + (e.clientY - r.top).toFixed(0) + 'px)';
    });
  });
}
