import express from 'express';
import { query } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import {
  autoCheckoutStaleSessions,
  getMissedCheckoutStreak,
  MISSED_CHECKOUT_WARN_AT,
} from '../jobs/autoCheckout.js';

const router = express.Router();

router.use(authenticate);

// GET /api/attendance/status
router.get('/status', async (req, res) => {
  try {
    await autoCheckoutStaleSessions();
    if (req.user.role === 'customer') {
      const [openRes, todayRes, monthRes, missedStreak] = await Promise.all([
        query(
          `SELECT * FROM attendance_logs
           WHERE member_id = $1 AND check_out_time IS NULL
           ORDER BY check_in_time DESC LIMIT 1`,
          [req.user.id]
        ),
        query(
          `SELECT * FROM attendance_logs
           WHERE member_id = $1 AND check_in_time::date = CURRENT_DATE
           ORDER BY check_in_time DESC`,
          [req.user.id]
        ),
        query(
          `SELECT COUNT(*)::int AS visits,
                  COALESCE(SUM(duration_minutes), 0)::int AS total_minutes
           FROM attendance_logs
           WHERE member_id = $1
             AND DATE_TRUNC('month', check_in_time) = DATE_TRUNC('month', CURRENT_DATE)`,
          [req.user.id]
        ),
        getMissedCheckoutStreak(req.user.id),
      ]);

      return res.json({
        missedCheckouts: {
          streak: missedStreak,
          warnAt: MISSED_CHECKOUT_WARN_AT,
          warn: missedStreak >= MISSED_CHECKOUT_WARN_AT,
        },
        activeSession: openRes.rows[0] || null,
        todayLogs: todayRes.rows,
        monthSummary: monthRes.rows[0] || { visits: 0, total_minutes: 0 },
      });
    }

    // Owner view: currently checked-in members + today's check-in count
    const [activeRes, todayCountRes] = await Promise.all([
      query(
        `SELECT al.*, u.full_name, u.phone, mp.member_code, mp.profile_image, pl.name AS plan_name
         FROM attendance_logs al
         JOIN users u ON u.id = al.member_id
         LEFT JOIN member_profiles mp ON mp.user_id = u.id
         LEFT JOIN membership_plans pl ON pl.id = mp.plan_id
         WHERE al.check_out_time IS NULL
         ORDER BY al.check_in_time DESC`
      ),
      query(
        `SELECT COUNT(*)::int AS total_today
         FROM attendance_logs
         WHERE check_in_time::date = CURRENT_DATE`
      ),
    ]);

    res.json({
      activeMembers: activeRes.rows,
      totalToday: todayCountRes.rows[0]?.total_today || 0,
    });
  } catch (err) {
    console.error('Attendance status error:', err);
    res.status(500).json({ error: 'Failed to load attendance status' });
  }
});

// GET /api/attendance
router.get('/', async (req, res) => {
  try {
    const { from, to, memberId, status, limit = 100 } = req.query;
    const params = [];
    const clauses = [];

    if (req.user.role === 'customer') {
      params.push(req.user.id);
      clauses.push(`al.member_id = $${params.length}`);
    } else if (memberId) {
      params.push(memberId);
      clauses.push(`al.member_id = $${params.length}`);
    }

    if (from) {
      params.push(from);
      clauses.push(`al.check_in_time::date >= $${params.length}::date`);
    }
    if (to) {
      params.push(to);
      clauses.push(`al.check_in_time::date <= $${params.length}::date`);
    }
    if (status === 'active') {
      clauses.push('al.check_out_time IS NULL');
    } else if (status === 'completed') {
      clauses.push('al.check_out_time IS NOT NULL');
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    params.push(Math.min(500, Number(limit) || 100));

    const { rows } = await query(
      `SELECT al.*, u.full_name, u.email, u.phone, mp.member_code, mp.profile_image
       FROM attendance_logs al
       JOIN users u ON u.id = al.member_id
       LEFT JOIN member_profiles mp ON mp.user_id = u.id
       ${where}
       ORDER BY al.check_in_time DESC
       LIMIT $${params.length}`,
      params
    );

    res.json({ logs: rows });
  } catch (err) {
    console.error('Get attendance logs error:', err);
    res.status(500).json({ error: 'Failed to load attendance logs' });
  }
});

// POST /api/attendance/check-in
router.post('/check-in', async (req, res) => {
  try {
    // A session left open from a previous day must not block today's check-in.
    await autoCheckoutStaleSessions();
    const targetMemberId =
      req.user.role === 'owner' && req.body.memberId ? Number(req.body.memberId) : req.user.id;
    const markedBy = req.user.role === 'owner' ? 'owner' : 'self';
    const notes = req.body.notes ? String(req.body.notes).slice(0, 250) : null;

    // Verify member exists and is active
    const memRes = await query(
      `SELECT u.id, u.full_name, u.is_active, mp.membership_status,
              (mp.plan_end_date IS NOT NULL AND mp.plan_end_date < CURRENT_DATE) AS plan_lapsed
       FROM users u
       LEFT JOIN member_profiles mp ON mp.user_id = u.id
       WHERE u.id = $1 AND u.role = 'customer'`,
      [targetMemberId]
    );
    if (memRes.rowCount === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }
    const member = memRes.rows[0];
    if (!member.is_active) {
      return res.status(400).json({ error: 'Member account is inactive' });
    }

    // Self check-in requires a valid membership. The owner can still check someone in at the
    // front desk (e.g. renewing on the spot), so desk check-ins are allowed but flagged.
    const membershipBlocked =
      member.membership_status === 'frozen' || member.membership_status === 'expired' || member.plan_lapsed;
    if (membershipBlocked && req.user.role === 'customer') {
      const reason = member.membership_status === 'frozen' ? 'is frozen' : 'has expired';
      return res.status(403).json({
        error: `Your membership ${reason}. Please renew at the front desk to check in.`,
      });
    }

    // Check for existing open session
    const openRes = await query(
      'SELECT id, check_in_time FROM attendance_logs WHERE member_id = $1 AND check_out_time IS NULL',
      [targetMemberId]
    );
    if (openRes.rowCount > 0) {
      return res.status(409).json({
        error: `${memRes.rows[0].full_name} is already checked in`,
        activeSession: openRes.rows[0],
      });
    }

    const { rows } = await query(
      `INSERT INTO attendance_logs (member_id, check_in_time, marked_by, notes)
       VALUES ($1, NOW(), $2, $3)
       RETURNING *`,
      [targetMemberId, markedBy, notes]
    );

    res.status(201).json({
      message: membershipBlocked
        ? `Checked in — note: ${member.full_name}'s membership is not active`
        : 'Checked in successfully',
      membershipWarning: membershipBlocked || undefined,
      log: rows[0],
    });
  } catch (err) {
    // uniq_attendance_one_open: a concurrent request (double tap) already opened a session.
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Already checked in' });
    }
    console.error('Check-in error:', err);
    res.status(500).json({ error: 'Failed to record check-in' });
  }
});

// POST /api/attendance/check-out
router.post('/check-out', async (req, res) => {
  try {
    const { attendanceId, memberId, notes } = req.body;

    let openLogRes;
    if (attendanceId) {
      const sql =
        req.user.role === 'owner'
          ? 'SELECT * FROM attendance_logs WHERE id = $1 AND check_out_time IS NULL'
          : 'SELECT * FROM attendance_logs WHERE id = $1 AND member_id = $2 AND check_out_time IS NULL';
      const params = req.user.role === 'owner' ? [attendanceId] : [attendanceId, req.user.id];
      openLogRes = await query(sql, params);
    } else {
      const targetMemberId = req.user.role === 'owner' && memberId ? Number(memberId) : req.user.id;
      openLogRes = await query(
        `SELECT * FROM attendance_logs
         WHERE member_id = $1 AND check_out_time IS NULL
         ORDER BY check_in_time DESC LIMIT 1`,
        [targetMemberId]
      );
    }

    if (openLogRes.rowCount === 0) {
      return res.status(404).json({ error: 'No active check-in session found to check out' });
    }

    const logId = openLogRes.rows[0].id;
    const { rows } = await query(
      `UPDATE attendance_logs
       SET check_out_time = NOW(),
           notes = COALESCE($1, notes)
       WHERE id = $2 AND check_out_time IS NULL
       RETURNING *`,
      [notes ? String(notes).slice(0, 250) : null, logId]
    );
    if (rows.length === 0) {
      // Closed by a concurrent request (double tap) or the midnight auto-checkout in between.
      return res.status(409).json({ error: 'This session was already checked out' });
    }

    res.json({
      message: 'Checked out successfully',
      log: rows[0],
    });
  } catch (err) {
    console.error('Check-out error:', err);
    res.status(500).json({ error: 'Failed to record check-out' });
  }
});

export default router;
