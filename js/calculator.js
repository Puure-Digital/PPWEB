// PayRoll Protect · calculator page.
// The home page estimate in full: weekly labour spend, sites, hourly rate and the share of claimed
// hours unverified (5%, what our sites save on average; 1.7%, the UK sector estimate, or another), worked
// through to the year, the hours behind it and what a 90-day pilot on one site would hold. How the
// sites check attendance today drives the comparison. The address keeps the answers
// (calculator.html?spend=…&sites=…), so a reload or a shared link opens on the same figures.
import { boot } from './boot.js';
import { initScroll } from './scroll.js';
import { initNav } from './nav.js';
import { initFx } from './fx.js';
import { initCursor } from './cursor.js';
import { initFoot } from './foot.js';
import { initFlow } from './flow.js';
import { initReveals } from './reveal.js';
import { initLive } from './engine.js';
import { qs, qsa, gbp, clamp, copyText, confirmCopy } from './util.js';
import { setOd } from './odometer.js';
import { MIN, MAX, RATE, METHODS, DAYS, LIVE, heldBy90, toSpend, toV, nice } from './calc.js';

const RATES = [1.7, 2.5, 5, 7.5];
const WEEK_H = 40;
// What each way of checking proves, row by row (who, when, invoice lines, held): 2 yes, 1 partly, 0 no.
const PROVES = {
  paper: [[0, 'A signature. Anyone can sign for anyone.'], [0, 'Written by hand, often after the fact.'], [0, 'By hand, if there is time.'], [0, 'No. Payroll runs on the invoice.']],
  app: [[1, 'Whoever is holding the phone.'], [1, 'Logged from a phone, wherever it is.'], [0, 'A separate export, matched by hand.'], [0, 'No. Payroll runs on the invoice.']],
  card: [[1, 'The card, not the person. Cards get lent.'], [2, 'Recorded at the reader.'], [0, 'Not linked to invoice lines.'], [0, 'No. Payroll runs on the invoice.']],
  bio: [[2, 'Verified at the device.'], [2, 'Recorded at the device.'], [0, 'A separate step, matched by hand.'], [0, 'Only if someone checks first.']],
  none: [[0, 'Nothing recorded.'], [0, 'Whatever the invoice says.'], [0, 'Nothing to check against.'], [0, 'No. Payroll runs on the invoice.']],
};
const GLYPH = ['i-x', 'i-part', 'i-tick'], TONE = ['st--n', 'st--p', 'st--y'];

function initCalculator() {
  const range = qs('#x-range');
  if (!range) return;

  // Answers: from the address when it holds valid ones, else the home page's defaults.
  const q = new URLSearchParams(location.search);
  const num = (k, a, b, d) => { const v = Number(q.get(k)); return q.has(k) && v >= a && v <= b ? v : d; };
  const s = {
    spend: nice(num('spend', MIN, MAX, 180000)),
    sites: Math.round(num('sites', 1, 500, 1)),
    hourly: Math.round(num('hourly', 10, 150, 32)),
    pct: RATES.includes(Number(q.get('rate'))) ? Number(q.get('rate')) : RATE * 100,
    method: METHODS[q.get('method')] ? q.get('method') : 'paper',
  };
  const query = () => new URLSearchParams({ spend: s.spend, sites: s.sites, hourly: s.hourly, rate: s.pct, method: s.method }).toString();

  const out = {};
  ['spend', 'year', 'month', 'week', 'day', 'site', 'hours', 'held'].forEach((k) => { out[k] = qs('#x-' + k); });
  const eq = qs('#x-eq'), said = qs('#x-said'), barV = qs('#x-bar');
  const spendGroup = qs('#x-presets'), rateGroup = qs('#x-rates');
  const sites = qs('#x-sites'), hourly = qs('#x-hourly');
  const field = { 'x-sites': 'sites', 'x-hourly': 'hourly' };
  const sum = (k) => qs('[data-s="' + k + '"]');
  const work = (k) => qs('[data-w="' + k + '"]');
  let first = true, dragging = false, urlT, saidT;

  // A segmented control's pill slides to the chosen value, and fades where no value matches.
  function press(group, v) {
    const bs = qsa('button', group);
    const i = bs.findIndex((b) => Number(b.dataset.v) === v);
    bs.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
    if (i >= 0) group.style.setProperty('--i', i);
    group.classList.toggle('is-free', i < 0);
  }

  function render() {
    const rate = s.pct / 100;
    const week = s.spend * rate, year = week * 52, hours = week / s.hourly;
    const held = heldBy90(s.spend / s.sites, rate);
    // While the thumb is held the figures keep up with it; anything else rolls them.
    const o = { instant: first, dur: dragging ? 0.1 : 0.35, step: dragging ? 0 : 0.02 };
    setOd(out.spend, s.spend, o);
    setOd(out.year, Math.round(year), o);
    setOd(out.month, Math.round(year / 12), o);
    setOd(out.week, Math.round(week), o);
    setOd(out.day, Math.round(year / 260), o);
    setOd(out.site, Math.round(year / s.sites), o);
    setOd(out.hours, Math.round(hours), o);
    setOd(out.held, Math.round(held), o);
    first = false;

    const w = hours / WEEK_H;
    eq.textContent = w < 1
      ? 'Paid every week without proof they were worked.'
      : 'As many hours as ' + (w < 10 ? Math.round(w * 10) / 10 : Math.round(w)).toLocaleString('en-GB') + ' workers put in on a 40-hour week, paid without proof they were worked.';
    barV.textContent = gbp(year);
    range.style.setProperty('--p', (Number(range.value) / 10).toFixed(1) + '%');
    range.setAttribute('aria-valuetext', gbp(s.spend) + ' a week');
    press(spendGroup, s.spend);
    press(rateGroup, s.pct);
    // At a limit the button dims but keeps focus, so a held key or tap never drops it.
    qsa('.stepper__b').forEach((b) => {
      const f = qs('#' + b.dataset.for), v = s[field[f.id]], by = Number(b.dataset.by);
      b.setAttribute('aria-disabled', String(by < 0 ? v <= Number(f.min) : v >= Number(f.max)));
    });

    // The working, with the visitor's numbers in it.
    const pct = s.pct.toLocaleString('en-GB') + '%', per = s.sites === 1 ? '1 site' : s.sites.toLocaleString('en-GB') + ' sites';
    work('year').innerHTML = gbp(s.spend) + ' a week × ' + pct + ' × 52 weeks = <b>' + gbp(year) + '</b>';
    work('hours').innerHTML = gbp(week) + ' a week ÷ ' + gbp(s.hourly) + ' an hour = <b>' + Math.round(hours).toLocaleString('en-GB') + ' hours</b> a week';
    work('site').innerHTML = gbp(year) + ' ÷ ' + per + ' = <b>' + gbp(year / s.sites) + '</b> a year';
    work('held').innerHTML = gbp(s.spend) + ' a week ÷ ' + per + ' × ' + pct + ' × ' + (DAYS - LIVE) + ' days ÷ 7 = <b>' + gbp(held) + '</b>';

    // The figures beside the call request.
    sum('spend').textContent = gbp(s.spend);
    sum('sites').textContent = s.sites.toLocaleString('en-GB');
    sum('method').textContent = METHODS[s.method];
    sum('year').textContent = gbp(year);
    sum('held').textContent = gbp(held);

    // Screen readers hear the result once the answers settle, not every step of a drag.
    clearTimeout(saidT);
    saidT = setTimeout(() => { said.textContent = 'Estimated exposure ' + gbp(year) + ' a year, ' + gbp(year / 12) + ' a month.'; }, 700);
  }

  // How the sites check attendance today, beside PayRoll Protect.
  function compare() {
    const rows = PROVES[s.method];
    qsa('[data-m="name"]').forEach((el) => { el.textContent = METHODS[s.method]; });
    qs('[data-m="score"]').textContent = rows.filter((r) => r[0] === 2).length + ' of 4';
    rows.forEach(([v, text], i) => {
      const a = qs('.vs__a[data-m="' + i + '"]'), st = qs('.st', a);
      st.setAttribute('class', 'st ' + TONE[v]);
      qs('use', st).setAttribute('href', '#' + GLYPH[v]);
      qs('.vs__v', a).textContent = text;
    });
  }

  // Changes after the first render are kept in the address (once they settle: browsers limit how
  // often a page may rewrite it).
  function change() {
    render();
    clearTimeout(urlT);
    urlT = setTimeout(() => history.replaceState(null, '', '?' + query() + location.hash), 400);
  }

  range.addEventListener('input', () => { s.spend = nice(toSpend(Number(range.value))); change(); });
  range.addEventListener('pointerdown', () => { dragging = true; });
  ['pointerup', 'pointercancel'].forEach((t) => window.addEventListener(t, () => { dragging = false; }));
  qsa('button', spendGroup).forEach((b) => b.addEventListener('click', () => {
    s.spend = Number(b.dataset.v);
    range.value = toV(s.spend);
    change();
  }));
  qsa('button', rateGroup).forEach((b) => b.addEventListener('click', () => { s.pct = Number(b.dataset.v); change(); }));

  // Steppers: the buttons step by one; typed values count once they are in range, and the field
  // tidies itself when left.
  const take = (f, v) => {
    s[field[f.id]] = clamp(Math.round(v), Number(f.min), Number(f.max));
    f.value = s[field[f.id]];
    change();
  };
  qsa('.stepper__b').forEach((b) => b.addEventListener('click', () => {
    const f = qs('#' + b.dataset.for);
    take(f, Number(f.value) + Number(b.dataset.by));
  }));
  [sites, hourly].forEach((f) => {
    f.addEventListener('input', () => {
      const v = Number(f.value);
      if (f.value !== '' && v >= Number(f.min) && v <= Number(f.max)) { s[field[f.id]] = Math.round(v); change(); }
    });
    f.addEventListener('change', () => take(f, f.value === '' ? s[field[f.id]] : Number(f.value)));
  });

  // The method is asked with the answers and again beside the comparison; either sets both.
  const methods = qsa('input[name="method"], input[name="method-cmp"]');
  const pick = () => methods.forEach((r) => { r.checked = r.value === s.method; });
  methods.forEach((r) => r.addEventListener('change', () => {
    if (!r.checked) return;
    s.method = r.value;
    pick();
    compare();
    change();
  }));
  pick();

  // Copy link to these figures: phones open the share sheet; elsewhere the link is copied.
  const share = qs('#x-share');
  const label = qs('.copybtn-l', share), shareSaid = qs('#x-share-said');
  share.addEventListener('click', () => {
    const url = location.origin + location.pathname + '?' + query();
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      navigator.share({ title: 'PayRoll Protect estimate', text: 'Estimated payroll exposure: ' + gbp(s.spend * s.pct / 100 * 52) + ' a year.', url }).catch(() => {});
      return;
    }
    copyText(url).then((ok) => { if (ok) confirmCopy(share, label, shareSaid, 'Link copied', 'Copy link to these figures'); });
  });

  // Phones: while the answers are on screen and the estimate is not, a bar keeps the yearly figure
  // in sight.
  const bar = qs('#cx-bar'), inputs = qs('#cx-in'), result = qs('#cx-out');
  const seen = new Map();
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => seen.set(e.target, e.isIntersecting));
    const on = !!seen.get(inputs) && !seen.get(result);
    bar.classList.toggle('is-on', on);
    bar.inert = !on;
  });
  io.observe(inputs);
  io.observe(result);

  range.value = toV(s.spend);
  sites.value = s.sites;
  hourly.value = s.hourly;
  compare();
  render();
}

// The call request at the foot of the page is GoHighLevel's form: its frame, its script and the
// two megabytes they bring load only as the form comes near, never with the page. It runs apart
// from the rest of the page's set-up, so the form arrives even if the motion libraries do not.
function initFormNear() {
  const form = qs('#book-form'), frame = form && qs('iframe[data-src]', form);
  if (!frame) return;
  const io = new IntersectionObserver((es) => {
    if (!es.some((e) => e.isIntersecting)) return;
    io.disconnect();
    frame.src = frame.dataset.src;
    const s = document.createElement('script');
    s.src = 'https://link.msgsndr.com/js/form_embed.js';
    s.async = true;
    document.body.appendChild(s);
  }, { rootMargin: '800px 0px' });
  io.observe(form);
}

initFormNear();
boot([initFx, initCursor, initScroll, initFlow, initCalculator, initFoot, initNav, initReveals, initLive]);
