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
    // Geofence: members can only self check-in/out within radius of this point.
    ['latitude', 'NUMERIC(9, 6)'],
    ['longitude', 'NUMERIC(9, 6)'],
    ['geofence_radius_m', 'INTEGER NOT NULL DEFAULT 100'],
  ]) {
    await run(`ALTER TABLE gym_settings ADD COLUMN IF NOT EXISTS ${column} ${type}`);
  }

  // Where the member was (metres from the gym) when they checked in / out themselves.
  await run('ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS check_in_distance_m INTEGER');
  await run('ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS check_out_distance_m INTEGER');

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

  await runMultiGymMigrations(run);
}

/** Adds a constraint only when no constraint with that name exists yet. */
async function addConstraint(run, table, name, definition) {
  await run(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
        ALTER TABLE ${table} ADD CONSTRAINT ${name} ${definition};
      END IF;
    END $$;
  `);
}

/**
 * Multi-gym (multi-tenant) model.
 *
 * gym_settings is the "gyms" table: one row per gym. Every owner, member, plan, attendance row,
 * invoice and payment carries gym_id. Composite foreign keys such as
 * (member_id, gym_id) → users(id, gym_id) make it impossible at the database level for a row to
 * point at a member, plan or invoice that belongs to a different gym.
 *
 * Existing single-gym databases are upgraded in place: all current data is assigned to the first gym.
 */
async function runMultiGymMigrations(run) {
  // Roles: superadmin (platform, no gym) · owner · customer
  await run(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check'
                 AND pg_get_constraintdef(oid) NOT LIKE '%superadmin%') THEN
        ALTER TABLE users DROP CONSTRAINT users_role_check;
      END IF;
    END $$;
  `);
  await addConstraint(run, 'users', 'users_role_check', "CHECK (role IN ('superadmin', 'owner', 'customer'))");

  // Gym lifecycle: the super admin creates the gym + owner with a one-time activation code.
  await run('ALTER TABLE gym_settings ADD COLUMN IF NOT EXISTS onboarding_code VARCHAR(20) UNIQUE');
  // Existing gyms are already set up, so they default to onboarded.
  await run('ALTER TABLE gym_settings ADD COLUMN IF NOT EXISTS owner_onboarded BOOLEAN NOT NULL DEFAULT TRUE');
  await run("ALTER TABLE gym_settings ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'");
  await addConstraint(run, 'gym_settings', 'gym_settings_status_check', "CHECK (status IN ('active', 'suspended'))");
  await run('ALTER TABLE gym_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');

  // A legacy database with users but no gym row gets one to own its data.
  await run(`
    INSERT INTO gym_settings (gym_name)
    SELECT 'IronPulse Fitness Studio'
    WHERE NOT EXISTS (SELECT 1 FROM gym_settings)
      AND EXISTS (SELECT 1 FROM users WHERE role <> 'superadmin')
  `);
  const FIRST_GYM = '(SELECT MIN(id) FROM gym_settings)';

  // users.gym_id: NULL only for the super admin.
  await run('ALTER TABLE users ADD COLUMN IF NOT EXISTS gym_id INTEGER REFERENCES gym_settings(id) ON DELETE CASCADE');
  await run(`UPDATE users SET gym_id = ${FIRST_GYM} WHERE gym_id IS NULL AND role <> 'superadmin'`);
  await addConstraint(run, 'users', 'users_gym_role_check', "CHECK ((role = 'superadmin') = (gym_id IS NULL))");
  await run(`
    UPDATE gym_settings g SET owner_user_id = (
      SELECT u.id FROM users u WHERE u.gym_id = g.id AND u.role = 'owner' ORDER BY u.id LIMIT 1
    )
    WHERE g.owner_user_id IS NULL
  `);
  await run('CREATE UNIQUE INDEX IF NOT EXISTS uniq_users_id_gym ON users (id, gym_id)');
  await run('CREATE INDEX IF NOT EXISTS idx_users_gym_role ON users (gym_id, role)');

  // Plans belong to a gym.
  await run(
    'ALTER TABLE membership_plans ADD COLUMN IF NOT EXISTS gym_id INTEGER REFERENCES gym_settings(id) ON DELETE CASCADE'
  );
  await run(`UPDATE membership_plans SET gym_id = ${FIRST_GYM} WHERE gym_id IS NULL`);
  await run('ALTER TABLE membership_plans ALTER COLUMN gym_id SET NOT NULL');
  await run('CREATE UNIQUE INDEX IF NOT EXISTS uniq_plans_id_gym ON membership_plans (id, gym_id)');

  // Member-owned rows copy the member's gym and are pinned to it.
  for (const table of ['attendance_logs', 'fee_invoices', 'payments']) {
    await run(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS gym_id INTEGER`);
    await run(`
      UPDATE ${table} t SET gym_id = u.gym_id
      FROM users u
      WHERE u.id = t.member_id AND t.gym_id IS NULL
    `);
    await run(`ALTER TABLE ${table} ALTER COLUMN gym_id SET NOT NULL`);
    await addConstraint(
      run,
      table,
      `${table}_member_gym_fk`,
      'FOREIGN KEY (member_id, gym_id) REFERENCES users (id, gym_id) ON DELETE CASCADE'
    );
  }
  await run('CREATE UNIQUE INDEX IF NOT EXISTS uniq_invoices_id_gym ON fee_invoices (id, gym_id)');
  await addConstraint(
    run,
    'fee_invoices',
    'fee_invoices_plan_gym_fk',
    'FOREIGN KEY (plan_id, gym_id) REFERENCES membership_plans (id, gym_id)'
  );
  await addConstraint(
    run,
    'payments',
    'payments_invoice_gym_fk',
    'FOREIGN KEY (invoice_id, gym_id) REFERENCES fee_invoices (id, gym_id)'
  );

  await run('CREATE INDEX IF NOT EXISTS idx_attendance_gym_time ON attendance_logs (gym_id, check_in_time DESC)');
  await run('CREATE INDEX IF NOT EXISTS idx_invoices_gym_status ON fee_invoices (gym_id, status)');
  await run('CREATE INDEX IF NOT EXISTS idx_payments_gym_date ON payments (gym_id, payment_date DESC)');
  await run('CREATE INDEX IF NOT EXISTS idx_plans_gym ON membership_plans (gym_id)');
}
