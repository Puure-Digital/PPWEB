// PayRoll Protect · the 60-second payroll risk check (index.html, #risk-check).
// Five taps, one question at a time: how the sites record who is on site, how subcontractors bill,
// whether invoices are checked against attendance, how many ways onto site, and a typical site's
// weekly labour. Then which of the three leaks, and paying before checking, those answers leave
// open, what that could cost one site (at the 5% our sites save on average and the 1.7% UK
// estimate) and what a 90-day pilot would hold, the answers carried to the booking page and the
// calculator in their addresses. All of it is worked out here, in the browser; nothing is sent.
// A modal <dialog>, full screen on a phone, opened from any [data-risk-open] or by arriving at
// #risk-check. Escape, the close button, a click outside it and the browser's Back all close it.
import { qs, qsa, gbp, RM } from './util.js';
import { RATE, METHODS, heldBy90 } from './calc.js';
import { waLink, planLink, estWorkers } from './whatsapp.js';
import { stopScroll } from './scroll.js';

const UK = 0.017;
// What each answer proves: who was on site, when they came and went, and whether invoices are checked.
const WHO = { bio: 2, card: 1, app: 1, paper: 0, none: 0 };
const WHEN = { bio: 2, card: 2, app: 1, paper: 0, none: 0 };
const CHECKED = { every: 2, spot: 1, flag: 0, none: 0 };
// Each level: its word, its tag's tone and the line under the result.
const LEVEL = {
  high: ['High risk', 'tag--amber', 'Most of what gets claimed is paid on trust.'],
  medium: ['Medium risk', 'tag--amber', 'Some of it is checked. The rest is paid on trust.'],
  low: ['Low risk', 'tag--lime', 'You check more than most. PayRoll Protect does it on every line, every week, without anyone finding the time.'],
};
// A check's state, 0 covered, 1 partly, 2 open: its word, chip tone and glyph.
const STATE = [['Covered', 'st--y', 'i-tick'], ['Partly', 'st--p', 'i-part'], ['Open', 'st--n', 'i-x']];

// The four checks for a set of answers, each with its state and the reason in the visitor's terms.
export function assess(a) {
  const who = WHO[a.method], when = WHEN[a.method], checked = CHECKED[a.check];
  const loose = a.ways === 'open', several = a.ways !== 'one';
  const rows = [];

  let s = who === 2 && checked === 2 && !loose ? 0 : who >= 1 && checked >= 1 ? 1 : 2;
  rows.push(['Ghost workers', s, s === 0 ? 'Every line is matched to a biometric record.'
    : checked === 0 ? 'Invoices aren’t matched to attendance, so a name nobody saw on site still gets paid.'
    : who === 0 ? (a.method === 'none' ? 'Nothing records who was on site.' : 'A signature on a register can’t prove who was there.')
    : who === 1 ? (a.method === 'card' ? 'A card shows a card was used, not who used it.' : 'A phone sign-in shows a phone, not a person.')
    : loose ? 'Without a set entrance, not everyone passes a terminal.'
    : 'Spot checks miss the weeks nobody looks.']);

  s = a.method === 'bio' ? 0 : 2;
  rows.push(['Proxy clocking', s, s === 0 ? 'A face or fingerprint can’t be lent.'
    : { card: 'Cards get lent.', app: 'Phones get handed over.', paper: 'Anyone can sign for anyone.', none: 'Nothing stops one person clocking in another.' }[a.method]
      + (several ? ' More than one way in makes it easier still.' : '')]);

  s = when === 2 && checked === 2 ? 0 : when >= 1 && checked >= 1 ? 1 : 2;
  let why = s === 0 ? 'Claimed hours are checked against scans in and out.'
    : checked === 0 ? 'Claimed hours are paid without being checked against time on site.'
    : when === 0 ? (a.method === 'none' ? 'Nothing records when anyone arrived or left.' : 'Hand-written times can’t show when someone really left.')
    : when === 1 ? 'A phone sign-in records the phone’s time, not the worker’s.'
    : 'Spot checks catch some weeks, not every week.';
  // Price work isn't billed by the hour, so open becomes partly: day work and extras still are.
  if (a.billing === 'price' && s === 2) { s = 1; why = 'Price work limits it, but day work and extras are still billed by time.'; }
  rows.push(['Inflated hours', s, why]);

  s = 2 - checked;
  rows.push(['Paid before it’s checked', s, s === 0 ? 'Every line is checked before payroll runs.'
    : s === 1 ? 'Spot checks leave most lines paid on trust.'
    : a.check === 'flag' ? 'Payroll runs on the invoice unless something looks wrong.' : 'Payroll runs on the invoice.']);

  const score = rows.reduce((t, r) => t + r[1], 0);
  return {
    rows,
    open: rows.filter((r) => r[1] === 2).length,
    partly: rows.filter((r) => r[1] === 1).length,
    level: score >= 6 ? 'high' : score >= 3 ? 'medium' : 'low',
  };
}

function headline(r) {
  const is = (n) => (n === 1 ? ' is' : ' are');
  if (!r.open && !r.partly) return 'All four checks are covered on your sites.';
  if (!r.open) return r.partly + ' of 4 checks' + is(r.partly) + ' only partly covered.';
  return r.open + ' of 4 checks' + is(r.open) + ' open on your sites' + (r.partly ? ', ' + r.partly + ' partly covered.' : '.');
}

export function initRisk() {
  const dlg = qs('#risk-check');
  if (!dlg || !dlg.showModal) return;
  const root = document.documentElement;
  const steps = qsa('.rk__step', dlg), res = qs('.rk__res', dlg), n = steps.length;
  const bar = qs('.rk__bar', dlg), count = qs('.rk__n', dlg);
  const out = (k) => qs('[data-rk="' + k + '"]', dlg);
  const back = out('back'), again = out('again'), note = qs('.rk__note', dlg);
  const a = {};
  let at = 0, opener = null, pushed = false, busy = false;

  function render() {
    const r = assess(a), spend = Number(a.spend), [word, tone, line] = LEVEL[r.level];
    out('level').textContent = word;
    out('level').className = 'tag ' + tone;
    out('head').textContent = headline(r);
    out('sub').textContent = line;
    out('checks').innerHTML = r.rows.map(([name, s, why]) => '<li><svg class="st ' + STATE[s][1] + '" aria-hidden="true"><use href="#' + STATE[s][2]
      + '"/></svg><div><strong>' + name + '</strong><span>' + why + '</span></div><em class="rk__s--' + s + '">' + STATE[s][0] + '</em></li>').join('');
    out('figs-k').textContent = r.level === 'low' ? 'If anything gets through, on one site' : 'What that could cost on one site';
    const week = spend * RATE, uk = spend * UK;
    out('ours').textContent = gbp(week);
    out('ours-y').textContent = 'a week · ' + gbp(week * 52) + ' a year';
    out('uk').textContent = gbp(uk);
    out('uk-y').textContent = 'a week · ' + gbp(uk * 52) + ' a year';
    out('pilot').textContent = gbp(heldBy90(spend));
    out('book').href = 'book.html?' + new URLSearchParams({ spend, risk: r.level, open: r.open, method: a.method });
    out('calc').href = 'calculator.html?' + new URLSearchParams({ spend, sites: 1, hourly: 32, rate: RATE * 100, method: a.method });
    // The WhatsApp button opens a chat with the result already written, so the reply can be the one-pager.
    out('wa').href = waLink('Hi PayRoll Protect, please send me the one-pager. My risk check came out ' + word.toLowerCase() + ', ' + r.open + ' of 4 checks open, on about '
      + gbp(spend) + ' a week of labour' + (METHODS[a.method] ? ' checked by ' + METHODS[a.method].toLowerCase() : '') + '. '
      + planLink({ workers: estWorkers(spend), sites: 1, spend, ...(METHODS[a.method] ? { method: a.method } : {}), rate: 32 }));
  }

  // One question at a time, or the result; focus goes to its heading, so a screen reader reads it.
  function show(k) {
    // Back slides in from the left, forward from the right.
    const rev = k < at;
    at = k;
    const done = k === n;
    steps.forEach((s, j) => { s.hidden = j !== k; s.classList.toggle('is-back', rev); });
    res.hidden = !done;
    if (done) render();
    bar.style.setProperty('--p', ((k + 1) / (n + 1)).toFixed(3));
    count.classList.toggle('is-off', done);
    out('at').textContent = String(k + 1);
    back.hidden = done;
    back.classList.toggle('is-off', k === 0);
    again.hidden = !done;
    // The result keeps its call to book in the bar at the foot, in sight however far it scrolls.
    out('book').hidden = !done;
    note.hidden = done;
    dlg.scrollTop = 0;
    (done ? out('head') : qs('.rk__q', steps[k])).focus({ preventScroll: true });
  }

  function choose(btn) {
    if (busy) return;
    const step = btn.closest('.rk__step');
    a[step.dataset.q] = btn.dataset.v;
    qsa('.rk__opts button', step).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    // A beat on the chosen answer, then on to the next, unless the visitor has gone back meanwhile.
    busy = true;
    const from = at;
    setTimeout(() => { busy = false; if (dlg.open && at === from) show(from + 1); }, RM ? 0 : 260);
  }

  function reset() {
    Object.keys(a).forEach((k) => delete a[k]);
    qsa('.rk__opts button', dlg).forEach((b) => b.setAttribute('aria-pressed', 'false'));
  }

  function open(arrived) {
    if (dlg.open) return;
    opener = document.activeElement;
    reset();
    dlg.showModal();
    root.classList.add('rk-on');
    stopScroll(true);
    // The address names the check: the browser's Back closes it, and a reload or a shared link opens it.
    if (!arrived) { history.pushState({ rk: 1 }, '', '#risk-check'); pushed = true; }
    show(0);
  }

  // Closing eases out (dimming the page back in) before the dialog goes; reduced motion just goes.
  function shut() {
    if (!dlg.open || dlg.classList.contains('is-closing')) return;
    if (RM) { dlg.close(); return; }
    dlg.classList.add('is-closing');
    setTimeout(() => { dlg.classList.remove('is-closing'); if (dlg.open) dlg.close(); }, 200);
  }
  // However it closes (the button, Escape, a click outside, Back, or the browser closing it on its
  // own after Escape), the page comes back as it was.
  dlg.addEventListener('close', () => {
    root.classList.remove('rk-on');
    stopScroll(false);
    if (opener && opener !== document.body && opener.focus) opener.focus({ preventScroll: true });
    opener = null;
  });

  function close() {
    if (pushed) { pushed = false; history.back(); return; }
    shut();
    if (location.hash === '#risk-check') history.replaceState(history.state, '', location.pathname + location.search);
  }

  window.addEventListener('popstate', () => {
    if (dlg.open) { pushed = false; shut(); }
    else if (location.hash === '#risk-check') open(true);
  });
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dlg.addEventListener('click', (e) => {
    const t = e.target;
    const opt = t.closest('.rk__opts button');
    if (opt) return choose(opt);
    if (t.closest('[data-rk="close"]')) return close();
    if (t.closest('[data-rk="back"]')) return show(Math.max(0, at - 1));
    if (t.closest('[data-rk="again"]')) { reset(); return show(0); }
    // A click on the dim around the card lands on the dialog itself, outside its box.
    if (t === dlg) {
      const r = dlg.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close();
    }
  });
  qsa('[data-risk-open]').forEach((el) => el.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); open(false); }));

  // Arriving at #risk-check (the footer on another page, a reload, a shared link): it opens once
  // the page is up, after the preloader.
  if (location.hash === '#risk-check') {
    const ready = () => root.classList.contains('is-ready');
    if (ready()) open(true);
    else new MutationObserver((_, o) => { if (ready()) { o.disconnect(); open(true); } }).observe(root, { attributes: true, attributeFilter: ['class'] });
  }
}
