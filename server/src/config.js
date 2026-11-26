import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

function resolveJwtSecret() {
  const secret = (process.env.JWT_SECRET || '').trim();
  if (secret) return secret;
  if (isProduction) {
    throw new Error('JWT_SECRET must be set in production. Refusing to start with a guessable signing key.');
  }
  // Dev only: a random per-process secret. Sessions reset whenever the server restarts.
  console.warn('[config] JWT_SECRET is not set. Using a random development secret (sessions reset on restart).');
  return crypto.randomBytes(48).toString('hex');
}

function resolveTimezone() {
  const candidate =
    process.env.GYM_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  try {
    // Throws RangeError for an unknown zone; also guards the value we pass to PostgreSQL.
    new Intl.DateTimeFormat('en-US', { timeZone: candidate });
    if (!/^[A-Za-z0-9_+\-/]+$/.test(candidate)) throw new RangeError('bad characters');
    return candidate;
  } catch {
    console.warn(`[config] Invalid GYM_TIMEZONE "${candidate}", falling back to Asia/Kolkata.`);
    return 'Asia/Kolkata';
  }
}

export const JWT_SECRET = resolveJwtSecret();

// The gym's local timezone. Every "today", "midnight" and DATE value is interpreted in this zone,
// both in Node and in PostgreSQL (the pool sets the session TimeZone to it).
export const GYM_TIMEZONE = resolveTimezone();

/** Today's date (YYYY-MM-DD) in the gym's timezone, optionally shifted by whole days. */
export function gymToday(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: GYM_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}
