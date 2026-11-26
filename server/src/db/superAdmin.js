import bcrypt from 'bcryptjs';

/**
 * Creates the platform super admin from SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD (and optional
 * SUPERADMIN_NAME) if no account with that email exists yet. Never changes an existing account,
 * so rotating the env password does not silently reset anything.
 * @param {(sql: string, params?: any[]) => Promise<any>} run
 */
export async function ensureSuperAdmin(run) {
  const email = (process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD || '';
  if (!email || !password) return false;
  if (password.length < 8) {
    console.warn('[superadmin] SUPERADMIN_PASSWORD must be at least 8 characters; not creating the account.');
    return false;
  }
  const existing = await run('SELECT id FROM users WHERE LOWER(email) = $1', [email]);
  if (existing.rowCount > 0) return false;

  const hash = await bcrypt.hash(password, 10);
  await run(
    `INSERT INTO users (email, password_hash, role, full_name, gym_id)
     VALUES ($1, $2, 'superadmin', $3, NULL)`,
    [email, hash, (process.env.SUPERADMIN_NAME || 'Platform Admin').trim()]
  );
  console.log(`[superadmin] Created super admin account ${email}.`);
  return true;
}
