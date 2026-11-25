import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/pool.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// GET /api/profile
router.get('/', authenticate, async (req, res) => {
  try {
    const userRes = await query(
      'SELECT id, email, role, full_name, phone, is_active, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const gymRes = await query('SELECT * FROM gym_settings ORDER BY id ASC LIMIT 1');
    const gym = gymRes.rows[0] || null;

    let profile = null;
    if (user.role === 'customer') {
      const profRes = await query(
        `SELECT mp.*, pl.name AS plan_name, pl.price AS plan_price, pl.duration_days AS plan_duration_days, pl.description AS plan_description
         FROM member_profiles mp
         LEFT JOIN membership_plans pl ON pl.id = mp.plan_id
         WHERE mp.user_id = $1`,
        [user.id]
      );
      profile = profRes.rows[0] || null;
    }

    res.json({ user, profile, gym });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// PUT /api/profile - Update personal profile & image (both customer & owner)
router.put('/', authenticate, async (req, res) => {
  try {
    const {
      full_name,
      email,
      phone,
      date_of_birth,
      gender,
      address,
      emergency_contact_name,
      emergency_contact_phone,
      height_cm,
      weight_kg,
      fitness_goal,
      profile_image,
      password,
    } = req.body;

    if (!full_name || !full_name.trim()) {
      return res.status(400).json({ error: 'Full name is required' });
    }

    if (email && email.trim()) {
      const dup = await query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2',
        [email.trim(), req.user.id]
      );
      if (dup.rowCount > 0) {
        return res.status(409).json({ error: 'This email is already in use by another account' });
      }
    }

    // Check if this is completing first-time onboarding
    let isCompletingOnboarding = false;
    if (req.user.role === 'customer') {
      const checkRes = await query(
        'SELECT onboarding_completed FROM member_profiles WHERE user_id = $1',
        [req.user.id]
      );
      if (checkRes.rowCount > 0 && !checkRes.rows[0].onboarding_completed) {
        isCompletingOnboarding = true;
        if (!email || !email.trim()) {
          return res.status(400).json({ error: 'Please enter your email address to complete onboarding' });
        }
        if (!password || password.length < 6) {
          return res.status(400).json({ error: 'Please set a login password (min 6 characters) for future sign-ins' });
        }
      }
    }

    let passwordHashClause = '';
    const userParams = [full_name.trim(), phone || null, email ? email.trim().toLowerCase() : null];
    if (password && password.length >= 6) {
      const hash = await bcrypt.hash(password, 10);
      userParams.push(hash);
      passwordHashClause = `, password_hash = $${userParams.length}`;
    }
    userParams.push(req.user.id);

    const userRes = await query(
      `UPDATE users
       SET full_name = $1,
           phone = COALESCE($2, phone),
           email = COALESCE($3, email)
           ${passwordHashClause},
           updated_at = NOW()
       WHERE id = $${userParams.length}
       RETURNING id, email, role, full_name, phone, is_active`,
      userParams
    );

    let profile = null;
    if (req.user.role === 'customer') {
      const profRes = await query(
        `UPDATE member_profiles
         SET date_of_birth = $1,
             gender = $2,
             address = $3,
             emergency_contact_name = $4,
             emergency_contact_phone = $5,
             height_cm = $6,
             weight_kg = $7,
             fitness_goal = $8,
             profile_image = CASE WHEN $9::text IS NOT NULL THEN $9::text ELSE profile_image END,
             onboarding_completed = TRUE,
             updated_at = NOW()
         WHERE user_id = $10
         RETURNING *`,
        [
          date_of_birth || null,
          gender || null,
          address || null,
          emergency_contact_name || null,
          emergency_contact_phone || null,
          height_cm ? Number(height_cm) : null,
          weight_kg ? Number(weight_kg) : null,
          fitness_goal || null,
          profile_image !== undefined ? profile_image : null,
          req.user.id,
        ]
      );
      profile = profRes.rows[0] || null;
    }

    res.json({
      message: isCompletingOnboarding
        ? 'Onboarding profile completed! Welcome to IronPulse Gym.'
        : 'Profile updated successfully',
      onboardingCompletedNow: isCompletingOnboarding,
      user: userRes.rows[0],
      profile,
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// PUT /api/profile/gym - Owner updates gym profile/settings
router.put('/gym', authenticate, requireRole('owner'), async (req, res) => {
  try {
    const { gym_name, tagline, phone, email, address, opening_hours, currency_symbol } = req.body;
    if (!gym_name || !gym_name.trim()) {
      return res.status(400).json({ error: 'Gym name is required' });
    }

    const existing = await query('SELECT id FROM gym_settings ORDER BY id ASC LIMIT 1');
    let result;
    if (existing.rowCount === 0) {
      result = await query(
        `INSERT INTO gym_settings (owner_user_id, gym_name, tagline, phone, email, address, opening_hours, currency_symbol)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          req.user.id,
          gym_name.trim(),
          tagline || '',
          phone || '',
          email || '',
          address || '',
          opening_hours || '',
          currency_symbol || '₹',
        ]
      );
    } else {
      result = await query(
        `UPDATE gym_settings
         SET gym_name = $1, tagline = $2, phone = $3, email = $4, address = $5,
             opening_hours = $6, currency_symbol = $7, updated_at = NOW()
         WHERE id = $8 RETURNING *`,
        [
          gym_name.trim(),
          tagline || '',
          phone || '',
          email || '',
          address || '',
          opening_hours || '',
          currency_symbol || '₹',
          existing.rows[0].id,
        ]
      );
    }

    res.json({ message: 'Gym settings updated successfully', gym: result.rows[0] });
  } catch (err) {
    console.error('Update gym settings error:', err);
    res.status(500).json({ error: 'Failed to update gym settings' });
  }
});

export default router;
