import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
    process.env.JWT_SECRET || 'gym-proposal-dev-secret-change-in-prod',
    { expiresIn: '7d' }
  );
}

async function getGymSettings() {
  const { rows } = await query('SELECT * FROM gym_settings ORDER BY id ASC LIMIT 1');
  return rows[0] || {
    gym_name: 'IronPulse Fitness Studio',
    tagline: 'Strength • Conditioning • Community',
    currency_symbol: '₹',
  };
}

// POST /api/auth/login (Email or Phone + Password)
router.post('/login', async (req, res) => {
  try {
    const rawIdentifier = (req.body.identifier || req.body.email || '').trim();
    const { password } = req.body;
    if (!rawIdentifier || !password) {
      return res.status(400).json({ error: 'Email or phone number and password are required' });
    }

    const digitsOnly = rawIdentifier.replace(/\D/g, '');
    const { rows } = await query(
      `SELECT id, email, password_hash, role, full_name, phone, is_active
       FROM users
       WHERE LOWER(COALESCE(email, '')) = LOWER($1)
          OR ($2 <> '' AND REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g') = $2)
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
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken(user);
    const gym = await getGymSettings();

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
});

// POST /api/auth/onboard-login (Client first-time login using Owner-generated code)
router.post('/onboard-login', async (req, res) => {
  try {
    const code = (req.body.onboarding_code || '').trim().toUpperCase();
    if (!code) {
      return res.status(400).json({ error: 'Please enter the onboarding code shared by the gym owner' });
    }

    const { rows } = await query(
      `SELECT u.id, u.email, u.role, u.full_name, u.phone, u.is_active,
              mp.*, pl.name AS plan_name, pl.price AS plan_price, pl.duration_days AS plan_duration_days
       FROM member_profiles mp
       JOIN users u ON u.id = mp.user_id
       LEFT JOIN membership_plans pl ON pl.id = mp.plan_id
       WHERE UPPER(mp.onboarding_code) = $1`,
      [code]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Invalid onboarding code. Please check with the gym owner.' });
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

    const token = signToken(user);
    const gym = await getGymSettings();

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

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT id, email, role, full_name, phone, is_active, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = rows[0];
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

    const gym = await getGymSettings();
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
