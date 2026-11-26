import crypto from 'crypto';

// No 0/O, 1/I/L, so codes read cleanly over the phone or WhatsApp.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomChars(length) {
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return out;
}

/**
 * One-time onboarding code, e.g. "KAR-7K3M9Q".
 * The name prefix is only for readability: the 6 random chars carry ~887 million combinations,
 * unlike the old "last 3 phone digits + 3 random digits" (900 guesses for a known person).
 */
export function generateOnboardingCode(name) {
  const prefix = (name || 'GYM')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, 3)
    .padEnd(3, 'X');
  return `${prefix}-${randomChars(6)}`;
}

/** Receipt number, e.g. "RCP-20261126-4F7KQ2". Random part avoids same-millisecond collisions. */
export function generateReceiptNumber(dateStr) {
  const datePart = String(dateStr || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
  return `RCP-${datePart}-${randomChars(6)}`;
}

export const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer'];
export const MEMBERSHIP_STATUSES = ['active', 'expired', 'frozen'];

/**
 * Phones are compared by their last 10 digits (the national number), so "+91 98765 43210",
 * "098765 43210" and "9876543210" all match. Use with PHONE_KEY_SQL on the column side.
 */
export function phoneKey(phone) {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}
export const PHONE_KEY_SQL = (column) => `RIGHT(REGEXP_REPLACE(COALESCE(${column}, ''), '[^0-9]', '', 'g'), 10)`;

/** Round to paise to avoid float drift when comparing money amounts. */
export function toPaise(amount) {
  return Math.round(Number(amount) * 100);
}
