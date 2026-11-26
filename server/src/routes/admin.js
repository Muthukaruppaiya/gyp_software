import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool, query } from '../db/pool.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { phoneKey, PHONE_KEY_SQL } from '../utils/codes.js';
import { generateUniqueAccessCode } from '../utils/gym.js';

/**
 * Super admin (platform) API: create gyms + their owners, watch every gym's activity,
 * suspend/reactivate gyms. The super admin has no gym of their own and cannot use the
 * owner/member routes; this router is the only place cross-gym data is read.
 */
const router = express.Router();
router.use(authenticate, requireRole('superadmin'));

function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Per-gym stats, computed with correlated subqueries keyed on g.id.
const GYM_STATS_SQL = `
  g.id, g.gym_name, g.logo_image, g.phone AS gym_phone, g.email AS gym_email, g.address, g.status,
  g.owner_onboarded, g.onboarding_code, g.created_at, g.currency_symbol,
  (g.latitude IS NOT NULL AND g.longitude IS NOT NULL) AS location_set,
  o.id AS owner_id, o.full_name AS owner_name, o.phone AS owner_phone, o.email AS owner_email,
  (SELECT COUNT(*) FROM users u WHERE u.gym_id = g.id AND u.role = 'customer')::int AS total_members,
  (SELECT COUNT(*) FROM users u JOIN member_profiles mp ON mp.user_id = u.id
     WHERE u.gym_id = g.id AND mp.membership_status = 'active')::int AS active_members,
  (SELECT COUNT(*) FROM attendance_logs a WHERE a.gym_id = g.id AND a.check_out_time IS NULL)::int AS in_gym_now,
  (SELECT COUNT(*) FROM attendance_logs a WHERE a.gym_id = g.id AND a.check_in_time::date = CURRENT_DATE)::int AS checkins_today,
  (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.gym_id = g.id
     AND DATE_TRUNC('month', p.payment_date) = DATE_TRUNC('month', CURRENT_DATE))::numeric(12,2) AS revenue_month,
  (SELECT COALESCE(SUM(fi.amount_due - fi.amount_paid), 0) FROM fee_invoices fi WHERE fi.gym_id = g.id
     AND fi.status IN ('pending', 'partial', 'overdue'))::numeric(12,2) AS pending_dues,
  (SELECT MAX(a.check_in_time) FROM attendance_logs a WHERE a.gym_id = g.id) AS last_activity
`;

function gymResponse(row) {
  if (!row) return row;
  // The activation code is only meaningful until the owner activates.
  return { ...row, onboarding_code: row.owner_onboarded ? null : row.onboarding_code };
}

async function phoneInUse(db, phone, excludeUserId = null) {
  const digits = phoneKey(phone);
  if (!digits) return false;
  const { rowCount } = await db.query(
    `SELECT 1 FROM users WHERE ${PHONE_KEY_SQL('phone')} = $1 AND ($2::int IS NULL OR id <> $2::int)`,
    [digits, excludeUserId]
  );
  return rowCount > 0;
}

// GET /api/admin/overview — platform totals + every gym with its stats
router.get('/overview', async (req, res) => {
  try {
    const { rows: gyms } = await query(
      `SELECT ${GYM_STATS_SQL}
       FROM gym_settings g
       LEFT JOIN users o ON o.id = g.owner_user_id
       ORDER BY g.created_at DESC, g.id DESC`
    );
    const sum = (key) => gyms.reduce((t, g) => t + Number(g[key] || 0), 0);
    res.json({
      totals: {
        gyms: gyms.length,
        activeGyms: gyms.filter((g) => g.status === 'active' && g.owner_onboarded).length,
        pendingActivation: gyms.filter((g) => !g.owner_onboarded).length,
        suspendedGyms: gyms.filter((g) => g.status === 'suspended').length,
        members: sum('total_members'),
        activeMembers: sum('active_members'),
        inGymNow: sum('in_gym_now'),
        checkinsToday: sum('checkins_today'),
        revenueMonth: sum('revenue_month'),
        pendingDues: sum('pending_dues'),
      },
      gyms: gyms.map(gymResponse),
    });
  } catch (err) {
    console.error('Admin overview error:', err);
    res.status(500).json({ error: 'Failed to load platform overview' });
  }
});

// POST /api/admin/gyms — create a gym + its owner, returns the owner's one-time access code
router.post('/gyms', async (req, res) => {
  const gymName = String(req.body?.gym_name || '').trim();
  const ownerName = String(req.body?.owner_name || '').trim();
  const ownerPhone = String(req.body?.owner_phone || '').trim();
  const address = String(req.body?.address || '').trim();

  if (!gymName || !ownerName || !ownerPhone) {
    return res.status(400).json({ error: 'Gym name, owner name and owner phone number are required' });
  }
  if (gymName.length > 150 || ownerName.length > 120) {
    return res.status(400).json({ error: 'Gym name or owner name is too long' });
  }
  if (phoneKey(ownerPhone).length < 7) {
    return res.status(400).json({ error: 'Please enter a valid owner phone number' });
  }

  const client = await pool.connect();
  let inTransaction = false;
  try {
    await client.query('BEGIN');
    inTransaction = true;

    if (await phoneInUse(client, ownerPhone)) {
      await client.query('ROLLBACK');
      inTransaction = false;
      return res.status(409).json({ error: 'This phone number is already registered to another account' });
    }

    const code = await generateUniqueAccessCode(client, gymName);
    const gymRes = await client.query(
      `INSERT INTO gym_settings (gym_name, tagline, phone, address, onboarding_code, owner_onboarded, status)
       VALUES ($1, NULL, $2, $3, $4, FALSE, 'active')
       RETURNING id`,
      [gymName, ownerPhone, address || null, code]
    );
    const gymId = gymRes.rows[0].id;

    // Unusable random password until the owner activates with the code and sets their own.
    const tempHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
    const ownerRes = await client.query(
      `INSERT INTO users (email, password_hash, role, full_name, phone, gym_id)
       VALUES (NULL, $1, 'owner', $2, $3, $4) RETURNING id`,
      [tempHash, ownerName, ownerPhone, gymId]
    );
    await client.query('UPDATE gym_settings SET owner_user_id = $1 WHERE id = $2', [ownerRes.rows[0].id, gymId]);

    await client.query('COMMIT');
    inTransaction = false;

    const { rows } = await query(
      `SELECT ${GYM_STATS_SQL} FROM gym_settings g LEFT JOIN users o ON o.id = g.owner_user_id WHERE g.id = $1`,
      [gymId]
    );
    res.status(201).json({ message: 'Gym created. Share the access code with the owner.', gym: gymResponse(rows[0]), access_code: code });
  } catch (err) {
    if (inTransaction) await client.query('ROLLBACK').catch(() => {});
    console.error('Create gym error:', err);
    res.status(500).json({ error: 'Failed to create gym' });
  } finally {
    client.release();
  }
});

// GET /api/admin/gyms/:id — one gym's full picture (read-only)
router.get('/gyms/:id', async (req, res) => {
  try {
    const gymId = parseId(req.params.id);
    if (!gymId) return res.status(400).json({ error: 'Invalid gym id' });

    const gymRes = await query(
      `SELECT ${GYM_STATS_SQL}, g.tagline, g.opening_hours, g.whatsapp, g.website, g.instagram, g.upi_id, g.gstin
       FROM gym_settings g LEFT JOIN users o ON o.id = g.owner_user_id WHERE g.id = $1`,
      [gymId]
    );
    if (gymRes.rowCount === 0) return res.status(404).json({ error: 'Gym not found' });

    const [members, attendance, payments, dues, plans] = await Promise.all([
      query(
        `SELECT u.id, u.full_name, u.phone, u.email, u.is_active, u.created_at,
                mp.member_code, mp.profile_image, mp.membership_status, mp.plan_end_date, mp.onboarding_completed,
                pl.name AS plan_name
         FROM users u
         JOIN member_profiles mp ON mp.user_id = u.id
         LEFT JOIN membership_plans pl ON pl.id = mp.plan_id
         WHERE u.gym_id = $1 AND u.role = 'customer'
         ORDER BY u.created_at DESC
         LIMIT 500`,
        [gymId]
      ),
      query(
        `SELECT al.id, al.check_in_time, al.check_out_time, al.duration_minutes, al.marked_by, al.auto_checked_out,
                u.full_name, mp.member_code, mp.profile_image
         FROM attendance_logs al
         JOIN users u ON u.id = al.member_id
         LEFT JOIN member_profiles mp ON mp.user_id = u.id
         WHERE al.gym_id = $1
         ORDER BY al.check_in_time DESC
         LIMIT 100`,
        [gymId]
      ),
      query(
        `SELECT p.id, p.amount, p.payment_method, p.payment_date, p.receipt_number,
                u.full_name, mp.member_code, fi.title AS invoice_title
         FROM payments p
         JOIN users u ON u.id = p.member_id
         LEFT JOIN member_profiles mp ON mp.user_id = u.id
         LEFT JOIN fee_invoices fi ON fi.id = p.invoice_id
         WHERE p.gym_id = $1
         ORDER BY p.payment_date DESC
         LIMIT 100`,
        [gymId]
      ),
      query(
        `SELECT fi.id, fi.title, fi.amount_due, fi.amount_paid, fi.due_date, fi.status,
                (fi.amount_due - fi.amount_paid)::numeric(10,2) AS balance_due,
                u.full_name, mp.member_code
         FROM fee_invoices fi
         JOIN users u ON u.id = fi.member_id
         LEFT JOIN member_profiles mp ON mp.user_id = u.id
         WHERE fi.gym_id = $1 AND fi.status IN ('pending', 'partial', 'overdue')
         ORDER BY fi.due_date ASC`,
        [gymId]
      ),
      query(
        'SELECT id, name, duration_days, price, first_month_price, is_active FROM membership_plans WHERE gym_id = $1 ORDER BY duration_days',
        [gymId]
      ),
    ]);

    res.json({
      gym: gymResponse(gymRes.rows[0]),
      members: members.rows,
      attendance: attendance.rows,
      payments: payments.rows,
      dues: dues.rows,
      plans: plans.rows,
    });
  } catch (err) {
    console.error('Admin gym detail error:', err);
    res.status(500).json({ error: 'Failed to load gym details' });
  }
});

// PATCH /api/admin/gyms/:id — suspend/reactivate, or fix the gym/owner name and owner phone
router.patch('/gyms/:id', async (req, res) => {
  const gymId = parseId(req.params.id);
  if (!gymId) return res.status(400).json({ error: 'Invalid gym id' });
  const body = req.body || {};

  const client = await pool.connect();
  let inTransaction = false;
  try {
    await client.query('BEGIN');
    inTransaction = true;
    const gymRes = await client.query('SELECT * FROM gym_settings WHERE id = $1 FOR UPDATE', [gymId]);
    const gym = gymRes.rows[0];
    if (!gym) {
      await client.query('ROLLBACK');
      inTransaction = false;
      return res.status(404).json({ error: 'Gym not found' });
    }

    const fail = async (status, error) => {
      await client.query('ROLLBACK');
      inTransaction = false;
      return res.status(status).json({ error });
    };

    if ('status' in body) {
      if (!['active', 'suspended'].includes(body.status)) return fail(400, 'Status must be active or suspended');
      await client.query('UPDATE gym_settings SET status = $1, updated_at = NOW() WHERE id = $2', [body.status, gymId]);
    }
    if ('gym_name' in body) {
      const name = String(body.gym_name || '').trim();
      if (!name || name.length > 150) return fail(400, 'Gym name is required (max 150 characters)');
      await client.query('UPDATE gym_settings SET gym_name = $1, updated_at = NOW() WHERE id = $2', [name, gymId]);
    }
    if ('owner_name' in body || 'owner_phone' in body) {
      if (!gym.owner_user_id) return fail(400, 'This gym has no owner account');
      if ('owner_name' in body) {
        const name = String(body.owner_name || '').trim();
        if (!name || name.length > 120) return fail(400, 'Owner name is required');
        await client.query('UPDATE users SET full_name = $1, updated_at = NOW() WHERE id = $2', [name, gym.owner_user_id]);
      }
      if ('owner_phone' in body) {
        const phone = String(body.owner_phone || '').trim();
        if (phoneKey(phone).length < 7) return fail(400, 'Please enter a valid owner phone number');
        if (await phoneInUse(client, phone, gym.owner_user_id)) {
          return fail(409, 'This phone number is already registered to another account');
        }
        await client.query('UPDATE users SET phone = $1, updated_at = NOW() WHERE id = $2', [phone, gym.owner_user_id]);
      }
    }

    await client.query('COMMIT');
    inTransaction = false;
    const { rows } = await query(
      `SELECT ${GYM_STATS_SQL} FROM gym_settings g LEFT JOIN users o ON o.id = g.owner_user_id WHERE g.id = $1`,
      [gymId]
    );
    res.json({ gym: gymResponse(rows[0]) });
  } catch (err) {
    if (inTransaction) await client.query('ROLLBACK').catch(() => {});
    console.error('Update gym error:', err);
    res.status(500).json({ error: 'Failed to update gym' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/admin/gyms/:id/reset-code — issue a new owner access code.
 * Also the recovery path when an owner loses their password: the owner re-activates with the
 * new code and sets a fresh password. Their gym data is untouched.
 */
router.post('/gyms/:id/reset-code', async (req, res) => {
  try {
    const gymId = parseId(req.params.id);
    if (!gymId) return res.status(400).json({ error: 'Invalid gym id' });
    const gymRes = await query('SELECT id, gym_name, owner_user_id FROM gym_settings WHERE id = $1', [gymId]);
    const gym = gymRes.rows[0];
    if (!gym) return res.status(404).json({ error: 'Gym not found' });
    if (!gym.owner_user_id) return res.status(400).json({ error: 'This gym has no owner account' });

    const code = await generateUniqueAccessCode({ query }, gym.gym_name);
    await query(
      'UPDATE gym_settings SET onboarding_code = $1, owner_onboarded = FALSE, updated_at = NOW() WHERE id = $2',
      [code, gymId]
    );
    res.json({ message: 'New access code generated', access_code: code });
  } catch (err) {
    console.error('Reset gym code error:', err);
    res.status(500).json({ error: 'Failed to generate a new access code' });
  }
});

export default router;
