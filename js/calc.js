// Exposure calculator: log-scale slider, presets, rolling figures.
// The chosen spend is shared (spendNow, and a pp:spend event) so the pilot chart can follow it.
import { qs, qsa, gbp, copyText, confirmCopy } from './util.js';
import { setOd } from './odometer.js';

export const MIN = 10000, MAX = 5000000;
// The share of weekly labour spend an average PayRoll Protect site saves: £9,000 of £180,000.
// (The UK sector estimate, 1.7%, is on the full calculator to compare.)
export const RATE = 0.05;
// How a site may record attendance today, as the calculator, the risk check and the booking page name it.
export const METHODS = { paper: 'Paper register', app: 'Sign-in app', card: 'Access cards', bio: 'Biometric clocking', none: 'No formal check' };
// The pilot: 90 days, live on site from day 14. Held for query by day 90 at a weekly spend.
export const DAYS = 90, LIVE = 14;
export const heldBy90 = (spend, rate = RATE) => (spend * rate * (DAYS - LIVE)) / 7;
// Our average site's weekly labour spend, where the estimate starts.
export let spendNow = 180000;
export const toSpend = (v) => MIN * Math.pow(MAX / MIN, v / 1000);
export const toV = (s) => Math.round((1000 * Math.log(s / MIN)) / Math.log(MAX / MIN));
export const nice = (s) => (s < 100000 ? Math.round(s / 1000) * 1000 : s < 1000000 ? Math.round(s / 5000) * 5000 : Math.round(s / 50000) * 50000);

export function initCalc() {
  const range = qs('#c-range');
  if (!range) return;
  const weekly = qs('#c-weekly'), month = qs('#c-month'), year = qs('#c-year'), day = qs('#c-day');
  const group = qs('.calc__presets');
  const presets = qsa('.calc__presets button');
  let last = -1, first = true, dragging = false;

  function update(spend) {
    range.style.setProperty('--p', (Number(range.value) / 10).toFixed(1) + '%');
    if (spend === last) return;
    last = spend;
    spendNow = spend;
    const annual = spend * 52 * RATE;
    // While the thumb is held the figures follow it at once; a preset or a key press rolls them.
    const o = { instant: first || dragging, dur: 0.35, step: 0.02 };
    first = false;
    setOd(weekly, spend, o);
    setOd(month, Math.round(annual / 12), o);
    setOd(year, Math.round(annual), o);
    day.textContent = 'That is ' + gbp(annual / 260) + ' every working day.';
    range.setAttribute('aria-valuetext', gbp(spend) + ' a week');
    presets.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.v) === spend)));
    // The pill slides to the chosen value; between values it fades where it is.
    const i = presets.findIndex((b) => Number(b.dataset.v) === spend);
    if (i >= 0) {
      // Coming from a value between presets, the pill appears at the new one rather than sliding.
      if (group.classList.contains('is-free')) { group.classList.add('is-snap'); group.style.setProperty('--i', i); void group.offsetWidth; group.classList.remove('is-snap'); }
      else group.style.setProperty('--i', i);
    }
    group.classList.toggle('is-free', i < 0);
    document.dispatchEvent(new CustomEvent('pp:spend', { detail: spend }));
    // The pilot call carries the chosen spend to the booking page, and the full calculator opens at it.
    const cta = document.querySelector('.numbers__cta a');
    if (cta) cta.href = 'book.html?spend=' + spend;
    const full = document.querySelector('[data-calc-full]');
    if (full) full.href = 'calculator.html?spend=' + spend;
  }

  range.addEventListener('input', () => update(nice(toSpend(Number(range.value)))));
  // A finger that lands on the track and then scrolls the page puts the spend back as it was.
  let before = null;
  range.addEventListener('pointerdown', (e) => { dragging = true; before = e.pointerType === 'touch' ? range.value : null; });
  range.addEventListener('pointercancel', () => { if (before !== null) { range.value = before; update(nice(toSpend(Number(before)))); } before = null; });
  ['pointerup', 'pointercancel'].forEach((t) => window.addEventListener(t, () => { dragging = false; before = null; }));
  presets.forEach((b) => b.addEventListener('click', () => {
    const s = Number(b.dataset.v);
    range.value = toV(s);
    update(s);
  }));
  // A shared estimate opens at its spend (?spend=…, as "Share this estimate" writes it).
  const asked = Number(new URLSearchParams(location.search).get('spend'));
  if (asked >= MIN && asked <= MAX) range.value = toV(nice(asked));
  update(nice(toSpend(Number(range.value))));

  // Share this estimate: phones open the share sheet; elsewhere the link is copied and the icon
  // turns to a tick. The link reopens the page at the numbers with the same spend.
  const share = qs('#c-share');
  if (share) {
    const label = qs('.copybtn-l', share), said = qs('#c-share-said');
    share.addEventListener('click', () => {
      const url = location.origin + location.pathname + '?spend=' + spendNow + '#numbers';
      const text = 'Estimated payroll exposure at ' + gbp(spendNow) + ' a week of labour spend, at the 5% PayRoll Protect sites save on average: ' + gbp(spendNow * 52 * RATE) + ' a year.';
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        navigator.share({ title: 'PayRoll Protect estimate', text, url }).catch(() => {});
        return;
      }
      copyText(url).then((ok) => { if (ok) confirmCopy(share, label, said, 'Link copied', 'Share this estimate'); });
    });
  }

  // Arriving from "Change the spend": the jump lands by focusing the calculator (js/scroll.js),
  // and its viewfinder locks on. The link arms it, because once focusable the calculator also
  // takes focus from any click inside it.
  const calc = qs('#calc'), ui = qs('.calc__ui');
  const cue = () => {
    ui.classList.remove('is-cue');
    void ui.offsetWidth;
    ui.classList.add('is-cue');
  };
  if (calc && ui) qsa('a[href="#calc"]').forEach((a) => a.addEventListener('click', () => calc.addEventListener('focus', cue, { once: true })));
  if (ui) ui.addEventListener('animationend', () => ui.classList.remove('is-cue'));
}
