// Leads: "Send this plan to my inbox" (start.html) posts the visitor's email and figures to a
// GoHighLevel inbound webhook, and a GHL workflow sends the email. Set WEBHOOK to the URL GHL gives
// for the workflow's "Inbound Webhook" trigger; until it is set, the form stays hidden.
//
// The fields arrive as form data, so the workflow can use them as {{inboundWebhookRequest.email}},
// {{inboundWebhookRequest.plan}} (the link to the visitor's plan page), {{inboundWebhookRequest.proposal}}
// (the one-pager, filled in), plus company, workers, sites, spend, method, exposure_year, price_month,
// invoice_hours, invoice_flags and source.
export const WEBHOOK = '';

export function sendLead(fields) {
  if (!WEBHOOK) return Promise.resolve(false);
  const body = new URLSearchParams();
  Object.entries(fields).forEach(([k, v]) => body.set(k, v == null ? '' : String(v)));
  // Form-encoded and no-cors: the browser sends it without a preflight, and the opaque reply is
  // enough, since the workflow's email is the confirmation.
  return fetch(WEBHOOK, { method: 'POST', mode: 'no-cors', body }).then(() => true, () => false);
}
sendLead.ready = Promise.resolve(!!WEBHOOK);
