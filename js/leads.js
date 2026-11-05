// Leads: "Send this plan to my inbox" (start.html) posts the visitor's email and plan figures to the
// pp-leads Worker (worker/ in the project). The Worker renders their one-pager PDF, writes the contact
// into GoHighLevel and sends the email from there. WEBHOOK is set by `npm run setup` in worker/;
// while it is empty the form stays hidden.
export const WEBHOOK = '';

export function sendLead(fields) {
  if (!WEBHOOK) return Promise.resolve(false);
  // Rendering the PDF takes a few seconds; give up after 45.
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 45000);
  return fetch(WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields), signal: ctl.signal })
    .then((r) => r.json())
    .then((d) => !!(d && d.ok), () => false)
    .finally(() => clearTimeout(t));
}
sendLead.ready = Promise.resolve(!!WEBHOOK);
