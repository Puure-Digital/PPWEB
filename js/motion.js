// Motion, after Apple's fluid-interface guidance (the apple-design skill): everything settles
// critically damped, with no overshoot; bounce belongs only to a gesture that carried momentum.
// These are the same curves as --spring and --spring-soft in base.css, so CSS and GSAP agree.
// - spring, springSoft: one critically damped curve (stiffness 180, mass 1), settling (±0.1%)
//               in about 0.7 s. Both names stay so every caller reads the same curve.
// - springIn:   springSoft mirrored, for exits that accelerate away.
// - harmonic:   undamped oscillation (sine in-out), for ambient loops only.
// - follow():   a live spring for anything that chases the pointer or a finger.
const K = 180;
const W0 = Math.sqrt(K);
const T_SOFT = 0.69;

const soft = (t) => 1 - Math.exp(-W0 * t) * (1 + W0 * t);
const S_END = soft(T_SOFT);

export const springSoft = (p) => (p <= 0 ? 0 : p >= 1 ? 1 : soft(p * T_SOFT) / S_END);
export const spring = springSoft;
export const springIn = (p) => 1 - springSoft(1 - p);
export const harmonic = (p) => (1 - Math.cos(Math.PI * p)) / 2;

// Time at which springSoft reaches a given fraction (for syncing events to a sweep).
export function springSoftAt(f) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (springSoft(mid) < f) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

// A spring that chases its target from wherever it is, carrying its velocity through every change
// of target, so a reversal never stops dead (a CSS transition or a fresh tween restarts from
// rest). Set as Apple sets a spring: response (seconds) and damping ratio; 1 is critically damped,
// below 1 only after a gesture with momentum. apply(value) draws each frame.
export function follow(apply, { response = 0.4, damping = 1, value = 0, eps = 0.001 } = {}) {
  const k = (2 * Math.PI / response) ** 2, c = (4 * Math.PI * damping) / response;
  let x = value, v = 0, to = value, raf = 0, last = 0;
  function tick(now) {
    // Fixed steps of 1/240 s keep a stiff spring stable at any frame rate.
    for (let dt = Math.min(0.05, (now - last) / 1000); dt > 0; dt -= 1 / 240) {
      const h = Math.min(dt, 1 / 240);
      v += (-k * (x - to) - c * v) * h;
      x += v * h;
    }
    last = now;
    if (Math.abs(x - to) < eps && Math.abs(v) < eps * 10) { x = to; v = 0; raf = 0; } else raf = requestAnimationFrame(tick);
    apply(x);
  }
  return {
    // A new target, and optionally a velocity to start from (a finger's, at release).
    to(t, vel) {
      to = t;
      if (vel != null) v = vel;
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    },
    // Straight to t, at rest (a first placement, or reduced motion).
    jump(t) { cancelAnimationFrame(raf); raf = 0; x = to = t; v = 0; apply(x); },
    get value() { return x; },
  };
}

export function registerEases() {
  gsap.registerEase('spring', spring);
  gsap.registerEase('springSoft', springSoft);
  gsap.registerEase('springIn', springIn);
  gsap.registerEase('harmonic', harmonic);
  gsap.defaults({ ease: 'spring' });
}

// Shared timings (seconds).
export const STEP = 0.08;   // stagger between related items
