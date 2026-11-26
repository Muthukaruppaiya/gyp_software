import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/pool.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { phoneKey, PHONE_KEY_SQL } from '../utils/codes.js';

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

    // Uploaded photos arrive as data URLs; demo/test avatars are site-relative paths.
    if (
      profile_image &&
      !/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(String(profile_image)) &&
      !/^\/images\/[\w\-/.]+\.(svg|png|jpe?g|webp)$/i.test(String(profile_image))
    ) {
      return res.status(400).json({ error: 'Profile photo must be a PNG, JPEG, WebP or GIF image' });
    }

    if (email && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    // Phone is a login identifier, so it must stay unique (login matches by the last 10 digits).
    if (phone && String(phone).trim()) {
      const digits = phoneKey(phone);
      if (!digits) return res.status(400).json({ error: 'Please enter a valid phone number' });
      const dupPhone = await query(
        `SELECT 1 FROM users WHERE ${PHONE_KEY_SQL('phone')} = $1 AND id <> $2`,
        [digits, req.user.id]
      );
      if (dupPhone.rowCount > 0) {
        return res.status(409).json({ error: 'This phone number is already in use by another account' });
      }
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
      // Only fields present in the request are written. Previously any field the client omitted
      // was overwritten with NULL, so a partial update (e.g. a future mobile app) wiped data.
      const text = (v) => (v === null || String(v).trim() === '' ? null : String(v).trim());
      const num = (v) => (v === null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
      const date = (v) => (v && /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? String(v).slice(0, 10) : null);
      const fields = {
        date_of_birth: [date_of_birth, date],
        gender: [gender, text],
        address: [address, text],
        emergency_contact_name: [emergency_contact_name, text],
        emergency_contact_phone: [emergency_contact_phone, text],
        height_cm: [height_cm, num],
        weight_kg: [weight_kg, num],
        fitness_goal: [fitness_goal, text],
        // '' removes the photo; null/absent keeps it.
        profile_image: [profile_image === null ? undefined : profile_image, (v) => v || null],
      };

      const sets = [];
      const params = [];
      for (const [column, [value, normalise]] of Object.entries(fields)) {
        if (value === undefined) continue;
        params.push(normalise(value));
        sets.push(`${column} = $${params.length}`);
      }
      params.push(req.user.id);

      const profRes = await query(
        `UPDATE member_profiles
         SET ${sets.join(', ')}${sets.length ? ',' : ''}
             onboarding_completed = TRUE,
             updated_at = NOW()
         WHERE user_id = $${params.length}
         RETURNING *`,
        params
      );
      profile = profRes.rows[0] || null;
    }

    res.json({
      message: isCompletingOnboarding
        ? 'Onboarding profile completed! Welcome to the gym.'
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

// Gym profile fields the owner can edit, with per-field limits.
const GYM_TEXT_FIELDS = {
  tagline: 255,
  phone: 30,
  email: 255,
  address: 1000,
  opening_hours: 120,
  currency_symbol: 10,
  whatsapp: 30,
  website: 255,
  instagram: 120,
  upi_id: 100,
  gstin: 20,
};

// PUT /api/profile/gym - Owner updates gym profile/settings (only the fields sent are changed)
router.put('/gym', authenticate, requireRole('owner'), async (req, res) => {
  try {
    const body = req.body || {};
    const values = {};

    if (!('gym_name' in body) || !String(body.gym_name || '').trim()) {
      return res.status(400).json({ error: 'Gym name is required' });
    }
    values.gym_name = String(body.gym_name).trim().slice(0, 150);

    for (const [field, max] of Object.entries(GYM_TEXT_FIELDS)) {
      if (!(field in body)) continue;
      const v = String(body[field] ?? '').trim();
      if (v.length > max) {
        return res.status(400).json({ error: `${field.replace(/_/g, ' ')} must be ${max} characters or fewer` });
      }
      values[field] = v;
    }
    if (values.currency_symbol === '') values.currency_symbol = '₹';
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      return res.status(400).json({ error: 'Please enter a valid gym email address' });
    }
    if (values.upi_id && !/^[\w.\-]{2,}@[a-zA-Z][\w.\-]*$/.test(values.upi_id)) {
      return res.status(400).json({ error: 'UPI ID should look like name@bank (e.g. ironpulse@okhdfcbank)' });
    }
    if (values.gstin && !/^[0-9]{2}[A-Z0-9]{13}$/i.test(values.gstin)) {
      return res.status(400).json({ error: 'GSTIN must be 15 characters (e.g. 29ABCDE1234F1Z5)' });
    }
    if (values.gstin) values.gstin = values.gstin.toUpperCase();
    if (values.website && !/^https?:\/\//i.test(values.website)) values.website = `https://${values.website}`;
    if (values.instagram) values.instagram = values.instagram.replace(/^@/, '');

    if ('logo_image' in body) {
      const logo = body.logo_image;
      if (logo && !/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(String(logo))) {
        return res.status(400).json({ error: 'Logo must be a PNG, JPEG, WebP or GIF image' });
      }
      values.logo_image = logo || null;
    }

    const columns = Object.keys(values);
    const params = columns.map((c) => values[c]);

    const existing = await query('SELECT id FROM gym_settings ORDER BY id ASC LIMIT 1');
    let result;
    if (existing.rowCount === 0) {
      params.push(req.user.id);
      result = await query(
        `INSERT INTO gym_settings (${columns.join(', ')}, owner_user_id)
         VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}, $${params.length})
         RETURNING *`,
        params
      );
    } else {
      params.push(existing.rows[0].id);
      result = await query(
        `UPDATE gym_settings
         SET ${columns.map((c, i) => `${c} = $${i + 1}`).join(', ')}, updated_at = NOW()
         WHERE id = $${params.length}
         RETURNING *`,
        params
      );
    }

    res.json({ message: 'Gym settings updated successfully', gym: result.rows[0] });
  } catch (err) {
    console.error('Update gym settings error:', err);
    res.status(500).json({ error: 'Failed to update gym settings' });
  }
});

export default router;
