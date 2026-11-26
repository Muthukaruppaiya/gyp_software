import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool, query } from '../db/pool.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  generateReceiptNumber,
  MEMBERSHIP_STATUSES,
  PAYMENT_METHODS,
  phoneKey,
  PHONE_KEY_SQL,
} from '../utils/codes.js';
import { gymToday } from '../config.js';
import { planInvoiceTitle, quotePlanForMember } from '../utils/pricing.js';
import { generateUniqueAccessCode } from '../utils/gym.js';

const router = express.Router();

router.use(authenticate, requireRole('owner'));

function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Another user (optionally excluding one id) already uses this phone number, compared by national number (last 10 digits). */
async function phoneTaken(db, phone, excludeUserId = null) {
  const digits = phoneKey(phone);
  if (!digits) return false;
  const { rowCount } = await db.query(
    `SELECT 1 FROM users
     WHERE ${PHONE_KEY_SQL('phone')} = $1
       AND ($2::int IS NULL OR id <> $2::int)`,
    [digits, excludeUserId]
  );
  return rowCount > 0;
}

// GET /api/members
router.get('/', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const status = (req.query.status || '').trim();

    const params = [req.user.gym_id];
    let where = `WHERE u.role = 'customer' AND u.gym_id = $1`;

    if (search) {
      params.push(`%${search}%`);
      where += ` AND (u.full_name ILIKE $${params.length} OR COALESCE(u.email, '') ILIKE $${params.length} OR COALESCE(u.phone, '') ILIKE $${params.length} OR mp.member_code ILIKE $${params.length} OR COALESCE(mp.onboarding_code, '') ILIKE $${params.length})`;
    }
    if (status && status !== 'all') {
      params.push(status);
      where += ` AND mp.membership_status = $${params.length}`;
    }

    const { rows } = await query(
      `SELECT
         u.id, u.email, u.full_name, u.phone, u.is_active, u.created_at,
         mp.member_code, mp.onboarding_code, mp.onboarding_completed, mp.profile_image,
         mp.plan_id, mp.plan_start_date, mp.plan_end_date,
         mp.membership_status, mp.gender, mp.date_of_birth, mp.address,
         mp.emergency_contact_name, mp.emergency_contact_phone,
         mp.height_cm, mp.weight_kg, mp.fitness_goal, mp.notes,
         pl.name AS plan_name, pl.price AS plan_price,
         (
           SELECT al.id FROM attendance_logs al
           WHERE al.member_id = u.id AND al.check_out_time IS NULL
           ORDER BY al.check_in_time DESC LIMIT 1
         ) AS open_attendance_id,
         (
           SELECT al.check_in_time FROM attendance_logs al
           WHERE al.member_id = u.id AND al.check_out_time IS NULL
           ORDER BY al.check_in_time DESC LIMIT 1
         ) AS active_check_in_time,
         COALESCE((
           SELECT SUM(fi.amount_due - fi.amount_paid)
           FROM fee_invoices fi
           WHERE fi.member_id = u.id AND fi.status IN ('pending', 'partial', 'overdue')
         ), 0)::numeric(10,2) AS balance_due
       FROM users u
       JOIN member_profiles mp ON mp.user_id = u.id
       LEFT JOIN membership_plans pl ON pl.id = mp.plan_id
       ${where}
       ORDER BY u.created_at DESC`,
      params
    );

    res.json({ members: rows });
  } catch (err) {
    console.error('List members error:', err);
    res.status(500).json({ error: 'Failed to load members' });
  }
});

// GET /api/members/:id
router.get('/:id', async (req, res) => {
  try {
    const memberId = parseId(req.params.id);
    if (!memberId) return res.status(400).json({ error: 'Invalid member id' });
    const memberRes = await query(
      `SELECT
         u.id, u.email, u.full_name, u.phone, u.is_active, u.created_at,
         mp.*, pl.name AS plan_name, pl.price AS plan_price, pl.duration_days AS plan_duration_days
       FROM users u
       JOIN member_profiles mp ON mp.user_id = u.id
       LEFT JOIN membership_plans pl ON pl.id = mp.plan_id
       WHERE u.id = $1 AND u.role = 'customer' AND u.gym_id = $2`,
      [memberId, req.user.gym_id]
    );
    if (memberRes.rowCount === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const [attendanceRes, invoicesRes, paymentsRes] = await Promise.all([
      query(
        'SELECT * FROM attendance_logs WHERE member_id = $1 ORDER BY check_in_time DESC LIMIT 20',
        [memberId]
      ),
      query(
        'SELECT * FROM fee_invoices WHERE member_id = $1 ORDER BY due_date DESC LIMIT 20',
        [memberId]
      ),
      query(
        'SELECT * FROM payments WHERE member_id = $1 ORDER BY payment_date DESC LIMIT 20',
        [memberId]
      ),
    ]);

    res.json({
      member: memberRes.rows[0],
      attendance: attendanceRes.rows,
      invoices: invoicesRes.rows,
      payments: paymentsRes.rows,
    });
  } catch (err) {
    console.error('Get member detail error:', err);
    res.status(500).json({ error: 'Failed to load member details' });
  }
});

// POST /api/members - Owner onboards a new client using ONLY Name + Phone (generates onboarding code)
router.post('/', async (req, res) => {
  const {
    full_name,
    phone,
    plan_id,
    create_invoice = true,
    initial_payment_amount = 0,
    payment_method = 'UPI',
  } = req.body;

  if (!full_name || !String(full_name).trim() || !phone || !String(phone).trim()) {
    return res.status(400).json({ error: 'Client Name and Phone Number are required to generate onboarding code' });
  }
  if (!String(phone).replace(/\D/g, '')) {
    return res.status(400).json({ error: 'Please enter a valid phone number' });
  }
  const initialPayment = Math.max(0, Number(initial_payment_amount || 0));
  if (!Number.isFinite(initialPayment)) {
    return res.status(400).json({ error: 'Initial payment must be a valid number' });
  }
  if (initialPayment > 0 && !PAYMENT_METHODS.includes(payment_method)) {
    return res.status(400).json({ error: `Payment method must be one of: ${PAYMENT_METHODS.join(', ')}` });
  }

  const client = await pool.connect();
  let inTransaction = false;
  try {
    await client.query('BEGIN');
    inTransaction = true;

    if (await phoneTaken(client, phone)) {
      await client.query('ROLLBACK');
      inTransaction = false;
      return res.status(409).json({ error: 'A member with this phone number is already registered' });
    }

    // Unusable random password until the member sets their own during onboarding.
    const tempPassHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
    const uRes = await client.query(
      `INSERT INTO users (email, password_hash, role, full_name, phone, gym_id)
       VALUES (NULL, $1, 'customer', $2, $3, $4)
       RETURNING id, email, role, full_name, phone, is_active`,
      [tempPassHash, String(full_name).trim(), String(phone).trim(), req.user.gym_id]
    );
    const user = uRes.rows[0];
    const memberCode = `IPF-${1000 + user.id}`;

    // Unique across member and gym-owner codes (both use the same Access Code login).
    const onboardingCode = await generateUniqueAccessCode(client, full_name);

    let plan = null;
    if (plan_id) {
      const pRes = await client.query('SELECT * FROM membership_plans WHERE id = $1 AND gym_id = $2', [
        Number(plan_id),
        req.user.gym_id,
      ]);
      plan = pRes.rows[0] || null;
      if (!plan) {
        await client.query('ROLLBACK');
        inTransaction = false;
        return res.status(404).json({ error: 'Selected membership plan was not found' });
      }
    }

    // Dates come from PostgreSQL in the gym's timezone (the old toISOString() used UTC,
    // so a member added before 5:30 AM IST got yesterday's start date).
    const datesRes = await client.query(
      'SELECT CURRENT_DATE::text AS start_date, (CURRENT_DATE + $1::int)::text AS end_date',
      [plan ? plan.duration_days : 0]
    );
    const startDate = datesRes.rows[0].start_date;
    const endDate = plan ? datesRes.rows[0].end_date : null;

    await client.query(
      `INSERT INTO member_profiles (
         user_id, member_code, onboarding_code, onboarding_completed,
         plan_id, plan_start_date, plan_end_date, membership_status
       ) VALUES ($1, $2, $3, FALSE, $4, $5, $6, 'active')`,
      [user.id, memberCode, onboardingCode, plan ? plan.id : null, startDate, endDate]
    );

    if (plan && create_invoice) {
      // A brand-new member always gets the plan's first-month (joining) price, if one is set.
      const quote = await quotePlanForMember(client, plan, user.id);
      const amountDue = quote.amount;
      const paidNow = Math.min(amountDue, initialPayment);
      const invStatus = paidNow >= amountDue ? 'paid' : paidNow > 0 ? 'partial' : 'pending';

      const invRes = await client.query(
        `INSERT INTO fee_invoices (
           member_id, plan_id, title, amount_due, amount_paid, due_date, status, period_start, period_end, pricing_tier, gym_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [
          user.id,
          plan.id,
          planInvoiceTitle(plan, quote.tier),
          amountDue,
          paidNow,
          startDate,
          invStatus,
          startDate,
          endDate,
          quote.tier,
          req.user.gym_id,
        ]
      );

      if (paidNow > 0) {
        await client.query(
          `INSERT INTO payments (
             invoice_id, member_id, amount, payment_method, receipt_number, reference_note, recorded_by, gym_id
           ) VALUES ($1,$2,$3,$4,$5,'Enrollment payment',$6,$7)`,
          [invRes.rows[0].id, user.id, paidNow, payment_method, generateReceiptNumber(gymToday()), req.user.id, req.user.gym_id]
        );
      }
    }

    await client.query('COMMIT');
    inTransaction = false;
    res.status(201).json({
      message: 'Client onboarded successfully! Share the onboarding code with the client.',
      member: {
        ...user,
        member_code: memberCode,
        onboarding_code: onboardingCode,
        onboarding_completed: false,
      },
      onboarding_code: onboardingCode,
    });
  } catch (err) {
    if (inTransaction) await client.query('ROLLBACK').catch(() => {});
    console.error('Create member error:', err);
    res.status(500).json({ error: 'Failed to onboard member' });
  } finally {
    client.release();
  }
});

// Normalisers for editable fields. Empty string → NULL so the owner can actually clear a field
// (the old COALESCE(...) update silently ignored every attempt to blank a value).
const emptyToNull = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());
const numberOrNull = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new RangeError('must be a non-negative number');
  return n;
};
const dateOrNull = (v) => {
  const s = emptyToNull(v);
  if (s === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) throw new RangeError('must be a date (YYYY-MM-DD)');
  return s.slice(0, 10);
};

const PROFILE_FIELDS = {
  plan_id: (v) => {
    if (v === undefined || v === null || v === '') return null;
    const id = parseId(v);
    if (!id) throw new RangeError('must be a valid plan id');
    return id;
  },
  plan_start_date: dateOrNull,
  plan_end_date: dateOrNull,
  membership_status: (v) => {
    if (!MEMBERSHIP_STATUSES.includes(v)) throw new RangeError(`must be one of ${MEMBERSHIP_STATUSES.join(', ')}`);
    return v;
  },
  gender: emptyToNull,
  date_of_birth: dateOrNull,
  address: emptyToNull,
  emergency_contact_name: emptyToNull,
  emergency_contact_phone: emptyToNull,
  height_cm: numberOrNull,
  weight_kg: numberOrNull,
  fitness_goal: emptyToNull,
  notes: emptyToNull,
};

// PUT /api/members/:id — only the fields present in the body are changed.
router.put('/:id', async (req, res) => {
  const memberId = parseId(req.params.id);
  if (!memberId) return res.status(400).json({ error: 'Invalid member id' });
  const body = req.body || {};

  // Validate & normalise before touching the database.
  const userSets = [];
  const userParams = [];
  const profileSets = [];
  const profileParams = [];
  try {
    if ('full_name' in body) {
      const name = emptyToNull(body.full_name);
      if (!name) return res.status(400).json({ error: 'Full name cannot be empty' });
      userParams.push(name);
      userSets.push(`full_name = $${userParams.length}`);
    }
    if ('phone' in body) {
      const phone = emptyToNull(body.phone);
      if (!phone || !phone.replace(/\D/g, '')) return res.status(400).json({ error: 'Please enter a valid phone number' });
      userParams.push(phone);
      userSets.push(`phone = $${userParams.length}`);
    }
    if ('is_active' in body) {
      userParams.push(body.is_active === true || body.is_active === 'true');
      userSets.push(`is_active = $${userParams.length}`);
    }
    for (const [field, normalise] of Object.entries(PROFILE_FIELDS)) {
      if (!(field in body)) continue;
      try {
        profileParams.push(normalise(body[field]));
      } catch (e) {
        return res.status(400).json({ error: `${field.replace(/_/g, ' ')} ${e.message}` });
      }
      profileSets.push(`${field} = $${profileParams.length}`);
    }
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const client = await pool.connect();
  let inTransaction = false;
  try {
    await client.query('BEGIN');
    inTransaction = true;

    const exists = await client.query(
      "SELECT 1 FROM users WHERE id = $1 AND role = 'customer' AND gym_id = $2 FOR UPDATE",
      [memberId, req.user.gym_id]
    );
    if (exists.rowCount === 0) {
      await client.query('ROLLBACK');
      inTransaction = false;
      return res.status(404).json({ error: 'Member not found' });
    }

    // A plan can only be assigned from this gym's own plans.
    if (body.plan_id !== undefined && body.plan_id !== null && body.plan_id !== '') {
      const planOk = await client.query('SELECT 1 FROM membership_plans WHERE id = $1 AND gym_id = $2', [
        parseId(body.plan_id),
        req.user.gym_id,
      ]);
      if (planOk.rowCount === 0) {
        await client.query('ROLLBACK');
        inTransaction = false;
        return res.status(400).json({ error: 'Selected membership plan does not exist' });
      }
    }

    if ('phone' in body && (await phoneTaken(client, body.phone, memberId))) {
      await client.query('ROLLBACK');
      inTransaction = false;
      return res.status(409).json({ error: 'Another account already uses this phone number' });
    }

    if (userSets.length > 0) {
      userParams.push(memberId);
      await client.query(
        `UPDATE users SET ${userSets.join(', ')}, updated_at = NOW() WHERE id = $${userParams.length}`,
        userParams
      );
    }
    if (profileSets.length > 0) {
      profileParams.push(memberId);
      await client.query(
        `UPDATE member_profiles SET ${profileSets.join(', ')}, updated_at = NOW() WHERE user_id = $${profileParams.length}`,
        profileParams
      );
    }

    await client.query('COMMIT');
    inTransaction = false;
    res.json({ message: 'Member updated successfully' });
  } catch (err) {
    if (inTransaction) await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Selected membership plan does not exist' });
    }
    console.error('Update member error:', err);
    res.status(500).json({ error: 'Failed to update member' });
  } finally {
    client.release();
  }
});

export default router;
