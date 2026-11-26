import { generateOnboardingCode } from './codes.js';

/** Gym fields safe to send to that gym's owner and members (never the owner's activation code). */
export function publicGym(row) {
  if (!row) return null;
  // eslint-disable-next-line no-unused-vars
  const { onboarding_code, ...rest } = row;
  return rest;
}

export async function getGym(db, gymId) {
  if (!gymId) return null;
  const { rows } = await db.query('SELECT * FROM gym_settings WHERE id = $1', [gymId]);
  return rows[0] || null;
}

/** Same as getGym but without secrets, for API responses to owners and members. */
export async function getPublicGym(db, gymId) {
  return publicGym(await getGym(db, gymId));
}

/**
 * A one-time access code that is unique across BOTH member codes and gym-owner codes,
 * since the same "Access Code" login box accepts either.
 */
export async function generateUniqueAccessCode(db, name) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = generateOnboardingCode(name);
    const { rowCount } = await db.query(
      `SELECT 1 FROM member_profiles WHERE UPPER(onboarding_code) = $1
       UNION ALL
       SELECT 1 FROM gym_settings WHERE UPPER(onboarding_code) = $1`,
      [candidate]
    );
    if (rowCount === 0) return candidate;
  }
  throw new Error('Could not generate a unique access code');
}
