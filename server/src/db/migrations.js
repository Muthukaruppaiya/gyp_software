/**
 * Idempotent schema upgrades for databases created by older versions.
 * Safe to run on every server start and from `npm run db:setup`.
 * @param {(sql: string, params?: any[]) => Promise<any>} run
 */
export async function runMigrations(run) {
  await run('ALTER TABLE users ALTER COLUMN email DROP NOT NULL');
  await run('ALTER TABLE member_profiles ADD COLUMN IF NOT EXISTS onboarding_code VARCHAR(20) UNIQUE');
  await run(
    'ALTER TABLE member_profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT TRUE'
  );
  await run('ALTER TABLE member_profiles ADD COLUMN IF NOT EXISTS profile_image TEXT');
  await run(
    'ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS auto_checked_out BOOLEAN NOT NULL DEFAULT FALSE'
  );

  // Two-tier pricing: first-month (joining) price per plan, and which tier each invoice used.
  await run(
    'ALTER TABLE membership_plans ADD COLUMN IF NOT EXISTS first_month_price NUMERIC(10, 2) CHECK (first_month_price >= 0)'
  );
  await run(
    "ALTER TABLE fee_invoices ADD COLUMN IF NOT EXISTS pricing_tier VARCHAR(10) CHECK (pricing_tier IN ('first', 'regular'))"
  );

  // Extended gym profile.
  for (const [column, type] of [
    ['logo_image', 'TEXT'],
    ['whatsapp', 'VARCHAR(30)'],
    ['website', 'VARCHAR(255)'],
    ['instagram', 'VARCHAR(120)'],
    ['upi_id', 'VARCHAR(100)'],
    ['gstin', 'VARCHAR(20)'],
  ]) {
    await run(`ALTER TABLE gym_settings ADD COLUMN IF NOT EXISTS ${column} ${type}`);
  }

  // At most one open session per member. Older versions could create duplicates when two
  // check-ins raced, so first close every older duplicate at the moment the next one started.
  await run(`
    UPDATE attendance_logs al
    SET check_out_time = (
          SELECT MIN(n.check_in_time) FROM attendance_logs n
          WHERE n.member_id = al.member_id AND n.check_out_time IS NULL AND n.check_in_time > al.check_in_time
        ),
        notes = LEFT(CONCAT_WS(' • ', al.notes, 'Closed duplicate open session'), 255)
    WHERE al.check_out_time IS NULL
      AND EXISTS (
        SELECT 1 FROM attendance_logs n
        WHERE n.member_id = al.member_id AND n.check_out_time IS NULL AND n.check_in_time > al.check_in_time
      )
  `);
  await run(
    'CREATE UNIQUE INDEX IF NOT EXISTS uniq_attendance_one_open ON attendance_logs (member_id) WHERE check_out_time IS NULL'
  );
}
