// WhatsApp: one number and one link builder for the "WhatsApp me the one-pager" buttons. The
// prospect sends the first message, which opens the 24-hour window in which the business can reply
// with the one-pager (GoHighLevel workflow) without a pre-approved template. Change the number
// here if the WhatsApp Business line is not the main one.
export const WA_NUMBER = '448000247456';

export const waLink = (text) => 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(text);
