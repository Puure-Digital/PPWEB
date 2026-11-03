// PayRoll Protect · booking page.
// The pilot request is the client's GoHighLevel form (an iframe sized by GHL's form_embed.js,
// loaded in the page). Beside it, the pilot it books, and what the risk check found when the visitor
// comes from it (book.html?risk=…&open=…&method=…): the home page's estimate (5% of labour spend,
// what our sites save on average, held from go-live on day 14 to day 90) at the spend the home page
// calculator passes in the address (book.html?spend=180000), or our average site's £180,000 a week.
import { boot } from './boot.js';
import { initScroll } from './scroll.js';
import { initNav } from './nav.js';
import { initFaq } from './faq.js';
import { initFx } from './fx.js';
import { initCursor } from './cursor.js';
import { initFoot } from './foot.js';
import { initFlow } from './flow.js';
import { initPilot } from './pilot.js';
import { initReveals } from './reveal.js';
import { initLive } from './engine.js';
import { qs, gbp } from './util.js';
import { MIN, MAX, METHODS, nice, heldBy90 } from './calc.js';

const LEVELS = { high: 'High risk', medium: 'Medium risk', low: 'Low risk' };

function initBooking() {
  const asked = Number(new URLSearchParams(location.search).get('spend'));
  const spend = asked >= MIN && asked <= MAX ? nice(asked) : 180000;
  const spendOut = qs('[data-s="spend"]'), held = qs('[data-s="held"]');
  if (spendOut) spendOut.textContent = gbp(spend);
  if (held) held.textContent = gbp(heldBy90(spend));
  // From the risk check: its result, and how the sites check attendance today.
  const q = new URLSearchParams(location.search), own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const row = (k, text) => { const dd = qs('[data-s="' + k + '"]'); if (dd && text) { dd.textContent = text; dd.parentElement.hidden = false; } };
  const risk = q.get('risk'), method = q.get('method');
  if (own(LEVELS, risk)) row('risk', LEVELS[risk] + ' · ' + Math.min(4, Math.max(0, parseInt(q.get('open'), 10) || 0)) + ' of 4 checks open');
  if (own(METHODS, method)) row('method', METHODS[method]);
}

boot([initFx, initCursor, initScroll, initFlow, initBooking, initPilot, initFaq, initFoot, initNav, initReveals, initLive]);
