// WhatsApp: one number and one link builder for the "WhatsApp me the one-pager" buttons. The
// prospect sends the first message, which opens the 24-hour window in which the business can reply
// with the one-pager (GoHighLevel workflow) without a pre-approved template. Change the number
// here if the WhatsApp Business line is not the main one.
export const WA_NUMBER = '448000247456';

export const waLink = (text) => 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(text);

// The plan link that ends each message. The leads Worker (worker/ in the project) finds it in the
// incoming WhatsApp message and replies with that prospect's one-pager, so keep it last and keep
// it on this site. Without a head count, it is estimated from the spend at 45 hours a week.
export const estWorkers = (spend, hourly = 32) => Math.min(500, Math.max(5, Math.round(spend / (hourly * 45) / 5) * 5));
export const planLink = (p) => location.origin + '/start.html?' + new URLSearchParams(p) + '#plan';
