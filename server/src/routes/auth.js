import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { JWT_SECRET } from '../config.js';
import { phoneKey, PHONE_KEY_SQL } from '../utils/codes.js';
import { getGym, getPublicGym, publicGym } from '../utils/gym.js';

const router = express.Router();

const FIFTEEN_MIN = 15 * 60 * 1000;
// Per IP + identifier, so one attacker can't lock out everyone behind the same NAT.
const loginLimiter = rateLimit({
  windowMs: FIFTEEN_MIN,
  max: 10,
  keyFn: (req) => `${req.ip}|${String(req.body?.identifier || req.body?.email || '').trim().toLowerCase()}`,
  message: 'Too many sign-in attempts. Please wait 15 minutes and try again.',
});
// Onboarding codes are the only secret for a not-yet-activated account: limit guesses per IP hard.
const onboardLimiter = rateLimit({
  windowMs: FIFTEEN_MIN,
  max: 8,
  message: 'Too many onboarding code attempts. Please wait 15 minutes or ask the gym owner for your code.',
});

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

const SUSPENDED_MSG = 'This gym account is suspended. Please contact support.';

// The platform super admin signs in only through its own endpoint (separate, unlisted login page).
// The public gym login treats super admin credentials as invalid, and vice versa.
const adminLoginLimiter = rateLimit({
  windowMs: FIFTEEN_MIN,
  max: 5,
  keyFn: (req) => `admin|${req.ip}`,
  message: 'Too many sign-in attempts. Please wait 15 minutes and try again.',
});

/** scope 'gym' → owners & members only; scope 'admin' → super admin only. */
const passwordLogin = (scope) => async (req, res) => {
  try {
    const rawIdentifier = (req.body.identifier || req.body.email || '').trim();
    const { password } = req.body;
    if (!rawIdentifier || !password) {
      return res.status(400).json({ error: 'Email or phone number and password are required' });
    }

    // Treat the identifier as a phone only if it isn't an email and has enough digits;
    // otherwise an email like "arjun123@x.com" could match a phone ending in 123.
    const phoneDigits = rawIdentifier.includes('@') ? '' : phoneKey(rawIdentifier);
    const digitsOnly = phoneDigits.length >= 7 ? phoneDigits : '';
    const { rows } = await query(
      `SELECT id, email, password_hash, role, full_name, phone, is_active, gym_id
       FROM users
       WHERE LOWER(COALESCE(email, '')) = LOWER($1)
          OR ($2 <> '' AND ${PHONE_KEY_SQL('phone')} = $2)
       ORDER BY (LOWER(COALESCE(email, '')) = LOWER($1)) DESC, is_active DESC, id ASC
       LIMIT 1`,
      [rawIdentifier, digitsOnly]
    );

    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated. Please contact the gym owner.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    const allowedHere = scope === 'admin' ? user.role === 'superadmin' : user.role !== 'superadmin';
    if (!valid || !allowedHere) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const gymRow = await getGym({ query }, user.gym_id);
    if (user.role !== 'superadmin' && gymRow?.status === 'suspended') {
      return res.status(403).json({ error: SUSPENDED_MSG, code: 'GYM_SUSPENDED' });
    }

    const token = signToken(user);
    const gym = publicGym(gymRow);

    let profile = null;
    if (user.role === 'customer') {
      const profRes = await query(
        `SELECT mp.*, pl.name AS plan_name, pl.price AS plan_price, pl.duration_days AS plan_duration_days
         FROM member_profiles mp
         LEFT JOIN membership_plans pl ON pl.id = mp.plan_id
         WHERE mp.user_id = $1`,
        [user.id]
      );
      profile = profRes.rows[0] || null;
    }

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        full_name: user.full_name,
        phone: user.phone,
      },
      profile,
      gym,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to sign in' });
  }
};

// POST /api/auth/login (Email or Phone + Password) — gym owners and members
router.post('/login', loginLimiter, passwordLogin('gym'));
// POST /api/auth/admin-login — platform super admin only
router.post('/admin-login', adminLoginLimiter, passwordLogin('admin'));

// POST /api/auth/onboard-login (Client first-time login using Owner-generated code)
router.post('/onboard-login', onboardLimiter, async (req, res) => {
  try {
    const code = (req.body.onboarding_code || '').trim().toUpperCase();
    if (!code) {
      return res.status(400).json({ error: 'Please enter the onboarding code shared by the gym owner' });
    }

    const { rows } = await query(
      `SELECT u.id, u.email, u.role, u.full_name, u.phone, u.is_active, u.gym_id,
              mp.*, pl.name AS plan_name, pl.price AS plan_price, pl.duration_days AS plan_duration_days
       FROM member_profiles mp
       JOIN users u ON u.id = mp.user_id
       LEFT JOIN membership_plans pl ON pl.id = mp.plan_id
       WHERE UPPER(mp.onboarding_code) = $1`,
      [code]
    );

    if (rows.length === 0) {
      // Not a member code: it may be a gym owner's activation code issued by the super admin.
      return ownerOnboardLogin(code, res);
    }

    const record = rows[0];
    if (!record.is_active) {
      return res.status(403).json({ error: 'Account is deactivated. Please contact the gym owner.' });
    }

    if (record.onboarding_completed) {
      return res.status(400).json({
        error: 'This onboarding code has already been activated. Please sign in with your Email/Phone and Password.',
      });
    }

    const user = {
      id: record.user_id,
      email: record.email,
      role: record.role,
      full_name: record.full_name,
      phone: record.phone,
    };

    const gymRow = await getGym({ query }, record.gym_id);
    if (gymRow?.status === 'suspended') {
      return res.status(403).json({ error: SUSPENDED_MSG, code: 'GYM_SUSPENDED' });
    }

    const token = signToken(user);
    const gym = publicGym(gymRow);

    const profile = {
      id: record.id,
      user_id: record.user_id,
      member_code: record.member_code,
      onboarding_code: record.onboarding_code,
      onboarding_completed: record.onboarding_completed,
      profile_image: record.profile_image,
      plan_id: record.plan_id,
      plan_start_date: record.plan_start_date,
      plan_end_date: record.plan_end_date,
      membership_status: record.membership_status,
      plan_name: record.plan_name,
      plan_price: record.plan_price,
      plan_duration_days: record.plan_duration_days,
    };

    res.json({
      message: 'Successfully onboarded! Please complete your profile details to continue.',
      firstTimeOnboarded: true,
      token,
      user,
      profile,
      gym,
    });
  } catch (err) {
    console.error('Onboard login error:', err);
    res.status(500).json({ error: 'Onboarding verification failed' });
  }
});

async function ownerOnboardLogin(code, res) {
  const { rows } = await query(
    `SELECT g.*, u.id AS owner_id, u.email AS owner_email, u.full_name AS owner_name,
            u.phone AS owner_phone, u.is_active AS owner_active
     FROM gym_settings g
     JOIN users u ON u.id = g.owner_user_id
     WHERE UPPER(g.onboarding_code) = $1`,
    [code]
  );
  const g = rows[0];
  if (!g) {
    return res.status(404).json({ error: 'Invalid access code. Please check the code and try again.' });
  }
  if (g.status === 'suspended') {
    return res.status(403).json({ error: SUSPENDED_MSG, code: 'GYM_SUSPENDED' });
  }
  if (!g.owner_active) {
    return res.status(403).json({ error: 'This owner account is deactivated. Please contact support.' });
  }
  if (g.owner_onboarded) {
    return res.status(400).json({
      error: 'This access code has already been activated. Please sign in with your Email/Phone and Password.',
    });
  }

  const user = { id: g.owner_id, email: g.owner_email, role: 'owner', full_name: g.owner_name, phone: g.owner_phone };
  const { owner_id, owner_email, owner_name, owner_phone, owner_active, ...gymRow } = g; // eslint-disable-line no-unused-vars
  res.json({
    message: 'Access code verified. Set up your account to continue.',
    firstTimeOnboarded: true,
    ownerOnboarding: true,
    token: signToken(user),
    user,
    profile: null,
    gym: publicGym(gymRow),
  });
}

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT id, email, role, full_name, phone, is_active, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = rows[0];
    // gym is null for the super admin.
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let profile = null;
    if (user.role === 'customer') {
      const profRes = await query(
        `SELECT mp.*, pl.name AS plan_name, pl.price AS plan_price, pl.duration_days AS plan_duration_days
         FROM member_profiles mp
         LEFT JOIN membership_plans pl ON pl.id = mp.plan_id
         WHERE mp.user_id = $1`,
        [user.id]
      );
      profile = profRes.rows[0] || null;
    }

    const gym = await getPublicGym({ query }, req.user.gym_id);
    res.json({ user, profile, gym });
  } catch (err) {
    console.error('Auth me error:', err);
    res.status(500).json({ error: 'Failed to load session' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Current password and a new password (min 6 chars) are required' });
    }

    const { rows } = await query('SELECT id, password_hash FROM users WHERE id = $1', [req.user.id]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok) return res.status(400).json({ error: 'Current password is incorrect' });

    const newHash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, req.user.id]);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Password update error:', err);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

export default router;
