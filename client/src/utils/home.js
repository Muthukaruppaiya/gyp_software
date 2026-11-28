/** Where a signed-in user belongs, including first-time setup screens. */
export function homePath(user, profile, gym) {
  if (!user) return '/login';
  if (user.role === 'superadmin') return '/admin';
  if (user.role === 'owner') return gym && gym.owner_onboarded === false ? '/owner/setup' : '/owner';
  if (profile && profile.onboarding_completed === false) return '/member/profile';
  return '/member';
}

/** The path a user is forced onto until they finish setup, or null. */
export function setupLockPath(user, profile, gym) {
  if (user?.role === 'owner' && gym && gym.owner_onboarded === false) return '/owner/setup';
  if (user?.role === 'customer' && profile && profile.onboarding_completed === false) return '/member/profile';
  return null;
}

/**
 * Unlisted sign-in page for the platform super admin. Not linked anywhere in the app.
 * Override per deployment with VITE_ADMIN_LOGIN_PATH (e.g. "/ops-7f3k") in client/.env.
 */
export const ADMIN_LOGIN_PATH = (import.meta.env.VITE_ADMIN_LOGIN_PATH || '/platform-console').replace(/\/+$/, '');
