// PayRoll Protect · Start now (start.html): a guided run through what a site gets, in the
// visitor's own figures. Six steps, one on screen at a time: sites, exposure, an invoice check,
// what arrives, the price, then the plan. The figures live in the address (?workers=&sites=&spend=
// &method=&rate=&company= plus the invoice totals), the step in the hash, so Back works, a reload
// keeps its place, and the plan page can be sent on or opened from the email.
import { boot } from './boot.js';
import { initScroll } from './scroll.js';
import { initNav } from './nav.js';
import { initFx } from './fx.js';
import { initCursor } from './cursor.js';
import { initFoot } from './foot.js';
import { initFlow } from './flow.js';
import { initReveals } from './reveal.js';
import { initLive } from './engine.js';
import { RM, qs, qsa, gbp, clamp, copyText, confirmCopy } from './util.js';
import { MIN, MAX, RATE, METHODS, heldBy90, toSpend, toV, nice } from './calc.js';
import { waLink } from './whatsapp.js';
import { sendLead } from './leads.js';

const UK = 0.017;
// The price: one rate per worker per month (the Armstrong Build proposal: £297 for 18 workers).
export const PRICE_PER_WORKER = 16.5;
const STEPS = ['sites', 'exposure', 'invoice', 'get', 'price', 'plan'];
const SAMPLE = 'W-0412  38.5\nW-0877  48\nW-1034  45\nW-1120  50\nW-1188  50\nW-1203  50\nW-1310  62\nW-1377  40\nW-1402  50\nW-1455  50\nW-1490  44\nW-1502  50';

const sitesWord = (n) => (n === 1 ? '1 site' : n + ' sites');
const hours = (h) => (Math.round(h * 10) / 10).toLocaleString('en-GB') + ' h';
const pence = (n) => (n < 1 ? Math.round(n * 100) + 'p' : '£' + n.toFixed(2));

// Reads invoice lines: each line a worker and, last on the line, their hours. Returns the rows
// and what stands out: more than 60 hours, more than 84, and a block of workers on identical hours
// (hours copied from the rota rather than recorded).
export function readInvoice(text) {
  const rows = [];
  text.split(/\r?\n/).forEach((line) => {
    const m = line.trim().match(/^(.*?)[\s,;:]*(\d+(?:[.,]\d+)?)\s*(?:h|hrs|hours)?\s*$/i);
    if (!m) return;
    const h = parseFloat(m[2].replace(',', '.'));
    if (h > 0 && h < 200) rows.push({ who: m[1].trim() || 'Worker ' + (rows.length + 1), h });
  });
  const flags = [];
  rows.filter((r) => r.h > 84).forEach((r) => flags.push(r.who + ': ' + hours(r.h) + ', more than 12 hours a day, seven days'));
  rows.filter((r) => r.h > 60 && r.h <= 84).forEach((r) => flags.push(r.who + ': ' + hours(r.h) + ' in one week'));
  const same = {};
  rows.forEach((r) => { same[r.h] = (same[r.h] || 0) + 1; });
  Object.entries(same).filter(([, n]) => n >= 4 && n >= rows.length / 2).forEach(([h, n]) => flags.push(n + ' of ' + rows.length + ' workers on exactly ' + hours(Number(h)) + ': hours filled in from the rota, not recorded at the terminal'));
  return { rows, total: rows.reduce((t, r) => t + r.h, 0), flags };
}

function initStart() {
  const root = qs('.sn');
  if (!root) return;
  const out = (k) => qsa('[data-sn="' + k + '"]', root);
  const set = (k, text) => out(k).forEach((el) => { el.textContent = text; });
  const steps = qsa('.sn__s', root);
  const back = qs('[data-sn="back"]', root), next = qs('[data-sn="next"]', root);
  const workers = qs('#sn-workers'), sites = qs('#sn-sites'), spend = qs('#sn-spend'), rate = qs('#sn-rate');
  const lines = qs('#sn-lines'), company = qs('#sn-company');
  const q = new URLSearchParams(location.search);
  const s = {
    workers: clamp(Number(q.get('workers')) || 40, 5, 500),
    sites: clamp(Number(q.get('sites')) || 1, 1, 20),
    spend: nice(clamp(Number(q.get('spend')) || 180000, MIN, MAX)),
    method: METHODS[q.get('method')] ? q.get('method') : 'paper',
    rate: clamp(Number(q.get('rate')) || 32, 10, 200),
    company: (q.get('company') || '').slice(0, 60),
    inv: null,
  };
  // The invoice totals travel in the address (the lines themselves stay in this browser).
  if (q.get('ih')) s.inv = { total: Number(q.get('ih')), rows: { length: Number(q.get('in')) || 0 }, flags: new Array(Number(q.get('if')) || 0).fill('') };
  try { const kept = sessionStorage.getItem('pp:start:lines'); if (kept) lines.value = kept; } catch { /* storage off */ }
  workers.value = s.workers; sites.value = s.sites; spend.value = toV(s.spend); rate.value = s.rate; company.value = s.company;
  (qs('input[name="sn-method"][value="' + s.method + '"]') || {}).checked = true;

  function query(extra) {
    const p = new URLSearchParams({ workers: s.workers, sites: s.sites, spend: s.spend, method: s.method, rate: s.rate });
    if (s.company) p.set('company', s.company);
    if (s.inv && s.inv.rows.length) { p.set('ih', Math.round(s.inv.total * 10) / 10); p.set('in', s.inv.rows.length); p.set('if', s.inv.flags.length); }
    Object.entries(extra || {}).forEach(([k, v]) => p.set(k, v));
    return p.toString();
  }

  function render() {
    const week = s.spend * RATE, uk = s.spend * UK, month = s.workers * PRICE_PER_WORKER;
    set('workers', String(s.workers));
    set('sites', String(s.sites));
    set('sitesw', sitesWord(s.sites));
    set('spend', gbp(s.spend));
    set('methodw', METHODS[s.method].toLowerCase());
    set('rate', String(s.rate));
    workers.setAttribute('aria-valuetext', s.workers + ' workers');
    sites.setAttribute('aria-valuetext', sitesWord(s.sites));
    spend.setAttribute('aria-valuetext', gbp(s.spend) + ' a week');
    spend.style.setProperty('--p', (Number(spend.value) / 10).toFixed(1) + '%');
    workers.style.setProperty('--p', ((s.workers - 5) / 495 * 100).toFixed(1) + '%');
    sites.style.setProperty('--p', ((s.sites - 1) / 19 * 100).toFixed(1) + '%');
    set('ours', gbp(week)); set('ours-y', gbp(week * 52));
    set('uk', gbp(uk)); set('uk-y', gbp(uk * 52));
    set('pilot', gbp(heldBy90(s.spend / s.sites)));
    set('pw', '£' + PRICE_PER_WORKER.toFixed(2));
    set('pd', pence(PRICE_PER_WORKER * 12 / 260));
    set('pm', gbp(month));
    set('exp-m', gbp(week * 52 / 12));
    set('pays', Math.ceil(month / s.rate) + ' hours');
    const inv = s.inv && s.inv.rows.length ? s.inv : null;
    out('invres').forEach((el) => { el.hidden = !inv; });
    out('sum-inv').forEach((el) => { el.hidden = !inv; });
    if (inv) {
      set('inv-h', hours(inv.total)); set('inv-n', String(inv.rows.length)); set('inv-c', gbp(inv.total * s.rate));
      set('inv-5', hours(inv.total * RATE)); set('inv-5c', gbp(inv.total * s.rate * RATE));
      set('inv-f', inv.flags.length === 1 ? '1 line flagged' : inv.flags.length + ' lines flagged');
      const ul = qs('[data-sn="flags"]', root);
      ul.innerHTML = inv.flags.filter(Boolean).map((f) => '<li>' + f.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</li>').join('')
        || (inv.rows.length ? '<li class="is-ok">Nothing stands out in these lines. The 5% is what the terminal record finds on an ordinary week.</li>' : '');
    }
    // The ways on from the plan, each carrying the figures.
    const planUrl = location.origin + location.pathname + '?' + query() + '#plan';
    out('wa').forEach((a) => { a.href = waLink('Hi PayRoll Protect, please send me the one-pager. My plan: ' + s.workers + ' workers across ' + sitesWord(s.sites) + ', about ' + gbp(s.spend) + ' a week checked by ' + METHODS[s.method].toLowerCase() + '. Exposure about ' + gbp(week * 52) + ' a year at your 5% average; price ' + gbp(month) + ' a month. ' + planUrl); });
    out('book').forEach((a) => { a.href = '/book.html?' + new URLSearchParams({ spend: s.spend, sites: s.sites, method: s.method, workers: s.workers }); });
    out('pdf').forEach((a) => { a.href = '/proposal/?' + new URLSearchParams({ client: s.company || 'Your company', workers: s.workers, sites: sitesWord(s.sites), price: Math.round(month), rate: s.rate }); });
    root.dataset.plan = planUrl;
    document.title = (STEPS[at] === 'plan' ? 'Your plan' : 'Start now') + ' | PayRoll Protect';
  }

  // One step on screen at a time; the heading takes focus so a screen reader reads it.
  let at = 0;
  function show(i, push) {
    at = clamp(i, 0, STEPS.length - 1);
    steps.forEach((el, k) => { el.hidden = k !== at; el.classList.toggle('is-in', k === at); });
    set('at', String(at + 1));
    out('bar').forEach((el) => { el.style.width = ((at + 1) / STEPS.length * 100).toFixed(1) + '%'; });
    back.hidden = at === 0;
    next.hidden = at === STEPS.length - 1;
    qs('.btn__arrow', next).hidden = false;
    next.firstChild.textContent = at === STEPS.length - 2 ? 'See my plan' : at === 1 ? 'Check an invoice' : 'Next';
    render();
    const url = location.pathname + '?' + query() + '#' + STEPS[at];
    if (push) history.pushState({ at }, '', url); else history.replaceState({ at }, '', url);
    const top = root.getBoundingClientRect().top + window.scrollY;
    if (window.scrollY > top + 8) (window.ppLenis ? window.ppLenis.scrollTo(top, { duration: RM ? 0 : 0.6 }) : window.scrollTo({ top, behavior: RM ? 'auto' : 'smooth' }));
    qs('h1', steps[at]).focus({ preventScroll: true });
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  }
  const first = STEPS.indexOf(location.hash.slice(1));
  show(first >= 0 ? first : 0, false);
  window.addEventListener('popstate', (e) => { const i = e.state && typeof e.state.at === 'number' ? e.state.at : STEPS.indexOf(location.hash.slice(1)); show(i < 0 ? 0 : i, false); });
  next.addEventListener('click', () => show(at + 1, true));
  back.addEventListener('click', () => show(at - 1, true));

  // The inputs: each change redraws every figure and rewrites the address.
  const sync = () => { history.replaceState({ at }, '', location.pathname + '?' + query() + '#' + STEPS[at]); };
  workers.addEventListener('input', () => { s.workers = Number(workers.value); render(); sync(); });
  sites.addEventListener('input', () => { s.sites = Number(sites.value); render(); sync(); });
  spend.addEventListener('input', () => { s.spend = nice(toSpend(Number(spend.value))); render(); sync(); });
  qsa('input[name="sn-method"]', root).forEach((r) => r.addEventListener('change', () => { if (r.checked) { s.method = r.value; render(); sync(); } }));
  rate.addEventListener('input', () => { s.rate = clamp(Number(rate.value) || 32, 10, 200); invoice(); });
  company.addEventListener('input', () => { s.company = company.value.trim().slice(0, 60); render(); sync(); });
  // A finger that lands on a slider and then scrolls the page puts the value back as it was.
  [workers, sites, spend].forEach((r) => {
    let before = null;
    r.addEventListener('pointerdown', (e) => { before = e.pointerType === 'touch' ? r.value : null; });
    r.addEventListener('pointercancel', () => { if (before !== null) { r.value = before; r.dispatchEvent(new Event('input')); } before = null; });
  });

  function invoice() {
    s.inv = lines.value.trim() ? readInvoice(lines.value) : null;
    try { sessionStorage.setItem('pp:start:lines', lines.value); } catch { /* storage off */ }
    render(); sync();
  }
  lines.addEventListener('input', invoice);
  qs('[data-sn="sample"]', root).addEventListener('click', () => { lines.value = SAMPLE; invoice(); lines.focus({ preventScroll: true }); });
  if (lines.value.trim()) s.inv = readInvoice(lines.value);

  // Copy link, and the plan to the inbox (js/leads.js; the form hides until a webhook is set).
  const copy = qs('[data-sn="copy"]', root);
  copy.addEventListener('click', () => {
    const url = root.dataset.plan;
    if (navigator.share && matchMedia('(pointer: coarse)').matches) { navigator.share({ title: 'My PayRoll Protect plan', url }).catch(() => {}); return; }
    copyText(url).then((ok) => { if (ok) confirmCopy(copy, qs('.copybtn-l', copy), qs('[data-sn="copy-said"]', copy), 'Link copied', 'Copy link to this plan'); });
  });
  const mail = qs('[data-sn="mail"]', root), said = qs('[data-sn="said"]', root), email = qs('#sn-email');
  sendLead.ready.then((on) => { mail.hidden = !on; });
  mail.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!email.checkValidity()) { said.textContent = 'That email address doesn’t look right.'; email.focus(); return; }
    const btn = qs('button', mail);
    btn.disabled = true;
    said.textContent = 'Sending…';
    const week = s.spend * RATE;
    sendLead({
      email: email.value.trim(), company: s.company, workers: s.workers, sites: s.sites, spend: s.spend, method: METHODS[s.method],
      exposure_year: Math.round(week * 52), price_month: Math.round(s.workers * PRICE_PER_WORKER),
      invoice_hours: s.inv ? Math.round(s.inv.total * 10) / 10 : '', invoice_flags: s.inv ? s.inv.flags.length : '',
      plan: root.dataset.plan, proposal: location.origin + qs('[data-sn="pdf"]', root).getAttribute('href'), source: 'start',
    }).then((ok) => {
      btn.disabled = false;
      said.textContent = ok ? 'Sent. Your plan is on its way to ' + email.value.trim() + '.' : 'That didn’t send. Call us, or use WhatsApp above.';
    });
  });
  render();
}

boot([initFx, initCursor, initScroll, initFlow, initNav, initFoot, initReveals, initLive, initStart]);
