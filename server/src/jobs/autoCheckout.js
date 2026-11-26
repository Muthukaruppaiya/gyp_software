import { query } from '../db/pool.js';
import { runMigrations } from '../db/migrations.js';
import { GYM_TIMEZONE } from '../config.js';

export { GYM_TIMEZONE };

// How many back-to-back auto check-outs before a member gets the warning.
export const MISSED_CHECKOUT_WARN_AT = Number(process.env.MISSED_CHECKOUT_WARN_AT || 2);

export async function ensureAttendanceSchema() {
  await runMigrations((sql, params) => query(sql, params));
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

/**
 * Keeps time-based statuses honest. Previously nothing ever moved an invoice to "overdue"
 * or a membership to "expired", so dashboards and the dues list went stale.
 */
export async function refreshDerivedStatuses() {
  const invoices = await query(
    `UPDATE fee_invoices
     SET status = 'overdue', updated_at = NOW()
     WHERE status IN ('pending', 'partial')
       AND due_date < CURRENT_DATE
       AND amount_paid < amount_due`
  );
  const memberships = await query(
    `UPDATE member_profiles
     SET membership_status = 'expired', updated_at = NOW()
     WHERE membership_status = 'active'
       AND plan_end_date IS NOT NULL
       AND plan_end_date < CURRENT_DATE`
  );
  if (invoices.rowCount > 0 || memberships.rowCount > 0) {
    console.log(
      `[status-refresh] Marked ${invoices.rowCount} invoice(s) overdue, ${memberships.rowCount} membership(s) expired.`
    );
  }
}

async function runDailyMaintenance() {
  await autoCheckoutStaleSessions();
  await refreshDerivedStatuses();
}

/** Milliseconds until 00:00:05 of the next day in the gym's timezone. */
function msUntilNextMidnight() {
  const now = new Date();
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: GYM_TIMEZONE,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  const secondsIntoDay = (Number(parts.hour) % 24) * 3600 + Number(parts.minute) * 60 + Number(parts.second);
  return Math.max(1000, (86400 - secondsIntoDay + 5) * 1000);
}

export async function startAutoCheckoutScheduler() {
  await ensureAttendanceSchema();
  await runDailyMaintenance(); // catch up anything missed while the server was off

  const scheduleMidnight = () => {
    setTimeout(async () => {
      try {
        await runDailyMaintenance();
      } catch (err) {
        console.error('[maintenance] Midnight run failed:', err.message);
      }
      scheduleMidnight();
    }, msUntilNextMidnight());
  };
  scheduleMidnight();

  // Safety net (e.g. laptop asleep at midnight): re-check every 15 minutes.
  setInterval(() => {
    runDailyMaintenance().catch((err) => console.error('[maintenance] Check failed:', err.message));
  }, 15 * 60 * 1000);

  console.log(`[auto-checkout] Scheduler active (timezone: ${GYM_TIMEZONE}).`);
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
