import { localDateKey } from '../api/client';

// Colour bands for the member's "membership ends in" countdown.
export const COUNTDOWN_GREEN_ABOVE = 20; // > 20 days left → green, blinking
export const COUNTDOWN_RED_AT_OR_BELOW = 10; // 0–10 days left → red (11–20 → neutral)
export const REMINDER_POPUP_DAYS = 3; // ≤ 3 days left (or expired) → popup at login

/** Whole days from today (local) until a 'YYYY-MM-DD' end date. 0 = ends today, negative = expired. */
export function daysUntil(endDate) {
  if (!endDate) return null;
  const [ey, em, ed] = String(endDate).slice(0, 10).split('-').map(Number);
  const [ty, tm, td] = localDateKey().split('-').map(Number);
  if (!ey || !em || !ed) return null;
  return Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(ty, tm - 1, td)) / 86400000);
}

/**
 * Describes the member's membership countdown.
 * level: 'green' | 'neutral' | 'red' | 'expired' | 'frozen' | null (no plan end date)
 */
export function membershipCountdown(profile) {
  if (!profile?.plan_end_date) return { level: null, days: null };
  const days = daysUntil(profile.plan_end_date);
  if (days === null) return { level: null, days: null };

  if (profile.membership_status === 'frozen') {
    return { level: 'frozen', days, headline: 'Membership frozen', detail: 'Contact the gym to resume your plan' };
  }
  if (days < 0) {
    const ago = Math.abs(days);
    return {
      level: 'expired',
      days,
      headline: 'Membership expired',
      detail: `Ended ${ago} day${ago === 1 ? '' : 's'} ago — renew to keep checking in`,
    };
  }

  const headline =
    days === 0 ? 'Membership ends today' : `Membership ends in ${days} day${days === 1 ? '' : 's'}`;
  let level = 'neutral';
  if (days > COUNTDOWN_GREEN_ABOVE) level = 'green';
  else if (days <= COUNTDOWN_RED_AT_OR_BELOW) level = 'red';

  const detail =
    level === 'green'
      ? 'You are all set — keep training!'
      : level === 'neutral'
        ? 'Plan your renewal in the coming days'
        : 'Renew soon to avoid interruption';
  return { level, days, headline, detail };
}

/** Should the login reminder popup be shown for this countdown? */
export function needsRenewalReminder(countdown) {
  return countdown.level === 'expired' || (countdown.level === 'red' && countdown.days <= REMINDER_POPUP_DAYS);
}

// Login sets this flag; the member layout shows the reminder once and clears it.
const REMINDER_FLAG = 'membership-reminder-pending';
export const markReminderPending = () => sessionStorage.setItem(REMINDER_FLAG, '1');
export const consumeReminderFlag = () => {
  const pending = sessionStorage.getItem(REMINDER_FLAG) === '1';
  sessionStorage.removeItem(REMINDER_FLAG);
  return pending;
};
