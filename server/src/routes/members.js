import express from 'express';
import bcrypt from 'bcryptjs';
import { pool, query } from '../db/pool.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate, requireRole('owner'));

function generateOnboardingCode(name, phone) {
  const prefix = (name || 'GYM')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, 3)
    .padEnd(3, 'X');
  const phoneDigits = (phone || '').replace(/\D/g, '').slice(-3).padStart(3, '0');
  const rand = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${phoneDigits}${rand}`;
}

// GET /api/members
router.get('/', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const status = (req.query.status || '').trim();

    let where = `WHERE u.role = 'customer'`;
    const params = [];

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
    const memberId = req.params.id;
    const memberRes = await query(
      `SELECT
         u.id, u.email, u.full_name, u.phone, u.is_active, u.created_at,
         mp.*, pl.name AS plan_name, pl.price AS plan_price, pl.duration_days AS plan_duration_days
       FROM users u
       JOIN member_profiles mp ON mp.user_id = u.id
       LEFT JOIN membership_plans pl ON pl.id = mp.plan_id
       WHERE u.id = $1 AND u.role = 'customer'`,
      [memberId]
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
  const client = await pool.connect();
  try {
    const {
      full_name,
      phone,
      plan_id,
      create_invoice = true,
      initial_payment_amount = 0,
      payment_method = 'UPI',
    } = req.body;

    if (!full_name || !full_name.trim() || !phone || !phone.trim()) {
      return res.status(400).json({ error: 'Client Name and Phone Number are required to generate onboarding code' });
    }

    await client.query('BEGIN');

    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly) {
      const dupPhone = await client.query(
        `SELECT id FROM users WHERE REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g') = $1`,
        [digitsOnly]
      );
      if (dupPhone.rowCount > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'A member with this phone number is already registered' });
      }
    }

    const tempPassHash = await bcrypt.hash(`temp-${Date.now()}`, 10);
    const uRes = await client.query(
      `INSERT INTO users (email, password_hash, role, full_name, phone)
       VALUES (NULL, $1, 'customer', $2, $3)
       RETURNING id, email, role, full_name, phone, is_active`,
      [tempPassHash, full_name.trim(), phone.trim()]
    );
    const user = uRes.rows[0];
    const memberCode = `IPF-${1000 + user.id}`;
    const onboardingCode = generateOnboardingCode(full_name, phone);

    let plan = null;
    if (plan_id) {
      const pRes = await client.query('SELECT * FROM membership_plans WHERE id = $1', [plan_id]);
      plan = pRes.rows[0] || null;
    }

    const start = new Date();
    let end = null;
    if (plan) {
      end = new Date(start);
      end.setDate(end.getDate() + plan.duration_days);
    }

    await client.query(
      `INSERT INTO member_profiles (
         user_id, member_code, onboarding_code, onboarding_completed,
         plan_id, plan_start_date, plan_end_date, membership_status
       ) VALUES ($1, $2, $3, FALSE, $4, $5, $6, 'active')`,
      [
        user.id,
        memberCode,
        onboardingCode,
        plan ? plan.id : null,
        start.toISOString().slice(0, 10),
        end ? end.toISOString().slice(0, 10) : null,
      ]
    );

    if (plan && create_invoice) {
      const amountDue = Number(plan.price);
      const paidNow = Math.min(amountDue, Math.max(0, Number(initial_payment_amount || 0)));
      const invStatus = paidNow >= amountDue ? 'paid' : paidNow > 0 ? 'partial' : 'pending';

      const invRes = await client.query(
        `INSERT INTO fee_invoices (
           member_id, plan_id, title, amount_due, amount_paid, due_date, status, period_start, period_end
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [
          user.id,
          plan.id,
          `${plan.name} Membership`,
          amountDue,
          paidNow,
          start.toISOString().slice(0, 10),
          invStatus,
          start.toISOString().slice(0, 10),
          end.toISOString().slice(0, 10),
        ]
      );

      if (paidNow > 0) {
        const receipt = `RCP-${Date.now().toString().slice(-6)}`;
        await client.query(
          `INSERT INTO payments (
             invoice_id, member_id, amount, payment_method, receipt_number, reference_note, recorded_by
           ) VALUES ($1,$2,$3,$4,$5,'Enrollment payment',$6)`,
          [invRes.rows[0].id, user.id, paidNow, payment_method, receipt, req.user.id]
        );
      }
    }

    await client.query('COMMIT');
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
    await client.query('ROLLBACK');
    console.error('Create member error:', err);
    res.status(500).json({ error: 'Failed to onboard member' });
  } finally {
    client.release();
  }
});

// PUT /api/members/:id
router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const memberId = req.params.id;
    const {
      full_name,
      phone,
      is_active,
      plan_id,
      plan_start_date,
      plan_end_date,
      membership_status,
      gender,
      date_of_birth,
      address,
      emergency_contact_name,
      emergency_contact_phone,
      height_cm,
      weight_kg,
      fitness_goal,
      notes,
    } = req.body;

    await client.query('BEGIN');

    const userRes = await client.query(
      `UPDATE users
       SET full_name = COALESCE($1, full_name),
           phone = COALESCE($2, phone),
           is_active = COALESCE($3, is_active),
           updated_at = NOW()
       WHERE id = $4 AND role = 'customer'
       RETURNING id`,
      [full_name ? full_name.trim() : null, phone !== undefined ? phone : null, is_active !== undefined ? Boolean(is_active) : null, memberId]
    );
    if (userRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Member not found' });
    }

    await client.query(
      `UPDATE member_profiles
       SET plan_id = COALESCE($1, plan_id),
           plan_start_date = COALESCE($2, plan_start_date),
           plan_end_date = COALESCE($3, plan_end_date),
           membership_status = COALESCE($4, membership_status),
           gender = COALESCE($5, gender),
           date_of_birth = COALESCE($6, date_of_birth),
           address = COALESCE($7, address),
           emergency_contact_name = COALESCE($8, emergency_contact_name),
           emergency_contact_phone = COALESCE($9, emergency_contact_phone),
           height_cm = COALESCE($10, height_cm),
           weight_kg = COALESCE($11, weight_kg),
           fitness_goal = COALESCE($12, fitness_goal),
           notes = COALESCE($13, notes),
           updated_at = NOW()
       WHERE user_id = $14`,
      [
        plan_id || null,
        plan_start_date || null,
        plan_end_date || null,
        membership_status || null,
        gender !== undefined ? gender : null,
        date_of_birth || null,
        address !== undefined ? address : null,
        emergency_contact_name !== undefined ? emergency_contact_name : null,
        emergency_contact_phone !== undefined ? emergency_contact_phone : null,
        height_cm ? Number(height_cm) : null,
        weight_kg ? Number(weight_kg) : null,
        fitness_goal !== undefined ? fitness_goal : null,
        notes !== undefined ? notes : null,
        memberId,
      ]
    );

    await client.query('COMMIT');
    res.json({ message: 'Member updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update member error:', err);
    res.status(500).json({ error: 'Failed to update member' });
  } finally {
    client.release();
  }
});

export default router;
