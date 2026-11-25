import { query } from '../db/pool.js';

// Gym's local timezone, used to decide where "midnight" falls.
export const GYM_TIMEZONE =
  process.env.GYM_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';

// How many back-to-back auto check-outs before a member gets the warning.
export const MISSED_CHECKOUT_WARN_AT = Number(process.env.MISSED_CHECKOUT_WARN_AT || 2);

export async function ensureAttendanceSchema() {
  await query(
    'ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS auto_checked_out BOOLEAN NOT NULL DEFAULT FALSE'
  );
}

/**
 * Closes every session that is still open from a previous day.
 * Out-time is set to 12:00 AM (midnight) at the end of the check-in day,
 * and the row is flagged so we can warn the member.
 */
export async function autoCheckoutStaleSessions() {
  const { rows } = await query(
    `UPDATE attendance_logs
     SET check_out_time = ((check_in_time AT TIME ZONE $1)::date + 1)::timestamp AT TIME ZONE $1,
         auto_checked_out = TRUE,
         notes = LEFT(CONCAT_WS(' • ', notes, 'Auto checked-out at midnight'), 255)
     WHERE check_out_time IS NULL
       AND (check_in_time AT TIME ZONE $1)::date < (NOW() AT TIME ZONE $1)::date
     RETURNING id`,
    [GYM_TIMEZONE]
  );
  if (rows.length > 0) {
    console.log(`[auto-checkout] Closed ${rows.length} session(s) left open past midnight.`);
  }
  return rows.length;
}

/** Number of most recent finished sessions in a row that were auto checked-out. */
export async function getMissedCheckoutStreak(memberId) {
  const { rows } = await query(
    `SELECT auto_checked_out FROM attendance_logs
     WHERE member_id = $1 AND check_out_time IS NOT NULL
     ORDER BY check_in_time DESC
     LIMIT 30`,
    [memberId]
  );
  let streak = 0;
  for (const r of rows) {
    if (!r.auto_checked_out) break;
    streak++;
  }
  return streak;
}

function msUntilNextMidnight() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 5, 0); // 00:00:05 tomorrow (server local time)
  return next.getTime() - now.getTime();
}

export async function startAutoCheckoutScheduler() {
  await ensureAttendanceSchema();
  await autoCheckoutStaleSessions(); // catch up anything missed while the server was off

  const scheduleMidnight = () => {
    setTimeout(async () => {
      try {
        await autoCheckoutStaleSessions();
      } catch (err) {
        console.error('[auto-checkout] Midnight run failed:', err.message);
      }
      scheduleMidnight();
    }, msUntilNextMidnight());
  };
  scheduleMidnight();

  // Safety net (e.g. laptop asleep at midnight): re-check every 15 minutes.
  setInterval(() => {
    autoCheckoutStaleSessions().catch((err) => console.error('[auto-checkout] Check failed:', err.message));
  }, 15 * 60 * 1000);

  console.log(`[auto-checkout] Scheduler active (timezone: ${GYM_TIMEZONE}).`);
}
