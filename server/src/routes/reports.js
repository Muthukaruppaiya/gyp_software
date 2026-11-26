import express from 'express';
import { query } from '../db/pool.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { gymToday } from '../config.js';

const router = express.Router();

router.use(authenticate, requireRole('owner'));

// Every query below is scoped to the signed-in owner's gym ($1 = gym_id).

// GET /api/reports/overview
router.get('/overview', async (req, res) => {
  try {
    const g = [req.user.gym_id];
    const [
      membersStats,
      liveInGym,
      todayAttendance,
      monthlyRevenue,
      pendingDues,
      expiringSoon,
      recentCheckins,
      dailyTrend,
    ] = await Promise.all([
      query(
        `SELECT
           COUNT(*) FILTER (WHERE mp.membership_status = 'active')::int AS active_members,
           COUNT(*) FILTER (WHERE mp.membership_status = 'expired')::int AS expired_members,
           COUNT(*)::int AS total_members
         FROM users u
         JOIN member_profiles mp ON mp.user_id = u.id
         WHERE u.role = 'customer' AND u.gym_id = $1`,
        g
      ),
      query('SELECT COUNT(*)::int AS count FROM attendance_logs WHERE gym_id = $1 AND check_out_time IS NULL', g),
      query(
        'SELECT COUNT(*)::int AS count FROM attendance_logs WHERE gym_id = $1 AND check_in_time::date = CURRENT_DATE',
        g
      ),
      query(
        `SELECT COALESCE(SUM(amount), 0)::numeric(10,2) AS total
         FROM payments
         WHERE gym_id = $1 AND DATE_TRUNC('month', payment_date) = DATE_TRUNC('month', CURRENT_DATE)`,
        g
      ),
      query(
        `SELECT COALESCE(SUM(amount_due - amount_paid), 0)::numeric(10,2) AS total,
                COUNT(*)::int AS invoice_count
         FROM fee_invoices
         WHERE gym_id = $1 AND status IN ('pending', 'partial', 'overdue')`,
        g
      ),
      query(
        `SELECT u.id, u.full_name, u.phone, mp.member_code, mp.profile_image, mp.plan_end_date, pl.name AS plan_name
         FROM member_profiles mp
         JOIN users u ON u.id = mp.user_id
         LEFT JOIN membership_plans pl ON pl.id = mp.plan_id
         WHERE u.gym_id = $1
           AND mp.plan_end_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '14 days')
         ORDER BY mp.plan_end_date ASC
         LIMIT 6`,
        g
      ),
      query(
        `SELECT al.*, u.full_name, mp.member_code, mp.profile_image
         FROM attendance_logs al
         JOIN users u ON u.id = al.member_id
         LEFT JOIN member_profiles mp ON mp.user_id = u.id
         WHERE al.gym_id = $1
         ORDER BY al.check_in_time DESC
         LIMIT 8`,
        g
      ),
      query(
        `SELECT d::date AS day,
                COUNT(al.id)::int AS checkins
         FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day') d
         LEFT JOIN attendance_logs al ON al.check_in_time::date = d::date AND al.gym_id = $1
         GROUP BY d::date
         ORDER BY d::date ASC`,
        g
      ),
    ]);

    res.json({
      kpis: {
        activeMembers: membersStats.rows[0].active_members,
        expiredMembers: membersStats.rows[0].expired_members,
        totalMembers: membersStats.rows[0].total_members,
        currentlyInGym: liveInGym.rows[0].count,
        todayCheckins: todayAttendance.rows[0].count,
        monthlyRevenue: Number(monthlyRevenue.rows[0].total),
        pendingDues: Number(pendingDues.rows[0].total),
        pendingInvoicesCount: pendingDues.rows[0].invoice_count,
      },
      expiringSoon: expiringSoon.rows,
      recentCheckins: recentCheckins.rows,
      dailyTrend: dailyTrend.rows,
    });
  } catch (err) {
    console.error('Overview report error:', err);
    res.status(500).json({ error: 'Failed to load dashboard overview' });
  }
});

// GET /api/reports/attendance
router.get('/attendance', async (req, res) => {
  try {
    const from = req.query.from || gymToday(-30);
    const to = req.query.to || gymToday();
    const p = [req.user.gym_id, from, to];

    const [summaryRes, dailyRes, peakHoursRes, topMembersRes] = await Promise.all([
      query(
        `SELECT
           COUNT(*)::int AS total_visits,
           COUNT(DISTINCT member_id)::int AS unique_members,
           COALESCE(ROUND(AVG(duration_minutes)), 0)::int AS avg_duration_minutes
         FROM attendance_logs
         WHERE gym_id = $1 AND check_in_time::date BETWEEN $2::date AND $3::date`,
        p
      ),
      query(
        `SELECT check_in_time::date AS date,
                COUNT(*)::int AS visits,
                COALESCE(ROUND(AVG(duration_minutes)), 0)::int AS avg_minutes
         FROM attendance_logs
         WHERE gym_id = $1 AND check_in_time::date BETWEEN $2::date AND $3::date
         GROUP BY check_in_time::date
         ORDER BY check_in_time::date DESC`,
        p
      ),
      query(
        `SELECT EXTRACT(HOUR FROM check_in_time)::int AS hour,
                COUNT(*)::int AS visits
         FROM attendance_logs
         WHERE gym_id = $1 AND check_in_time::date BETWEEN $2::date AND $3::date
         GROUP BY EXTRACT(HOUR FROM check_in_time)
         ORDER BY hour ASC`,
        p
      ),
      query(
        `SELECT u.id, u.full_name, mp.member_code, mp.profile_image,
                COUNT(al.id)::int AS visits,
                COALESCE(SUM(al.duration_minutes), 0)::int AS total_minutes
         FROM attendance_logs al
         JOIN users u ON u.id = al.member_id
         LEFT JOIN member_profiles mp ON mp.user_id = u.id
         WHERE al.gym_id = $1 AND al.check_in_time::date BETWEEN $2::date AND $3::date
         GROUP BY u.id, u.full_name, mp.member_code, mp.profile_image
         ORDER BY visits DESC, total_minutes DESC
         LIMIT 10`,
        p
      ),
    ]);

    res.json({
      range: { from, to },
      summary: summaryRes.rows[0],
      daily: dailyRes.rows,
      peakHours: peakHoursRes.rows,
      topMembers: topMembersRes.rows,
    });
  } catch (err) {
    console.error('Attendance report error:', err);
    res.status(500).json({ error: 'Failed to generate attendance report' });
  }
});

// GET /api/reports/revenue
router.get('/revenue', async (req, res) => {
  try {
    const from = req.query.from || gymToday(-90);
    const to = req.query.to || gymToday();
    const p = [req.user.gym_id, from, to];

    const [totalsRes, byMethodRes, byMonthRes, outstandingRes] = await Promise.all([
      query(
        `SELECT
           COALESCE(SUM(amount), 0)::numeric(10,2) AS total_collected,
           COUNT(*)::int AS payment_count
         FROM payments
         WHERE gym_id = $1 AND payment_date::date BETWEEN $2::date AND $3::date`,
        p
      ),
      query(
        `SELECT payment_method,
                COALESCE(SUM(amount), 0)::numeric(10,2) AS total,
                COUNT(*)::int AS count
         FROM payments
         WHERE gym_id = $1 AND payment_date::date BETWEEN $2::date AND $3::date
         GROUP BY payment_method
         ORDER BY total DESC`,
        p
      ),
      query(
        `SELECT TO_CHAR(DATE_TRUNC('month', payment_date), 'YYYY-MM') AS month,
                COALESCE(SUM(amount), 0)::numeric(10,2) AS total,
                COUNT(*)::int AS count
         FROM payments
         WHERE gym_id = $1 AND payment_date::date BETWEEN $2::date AND $3::date
         GROUP BY DATE_TRUNC('month', payment_date)
         ORDER BY DATE_TRUNC('month', payment_date) DESC`,
        p
      ),
      query(
        `SELECT fi.id, fi.title, fi.amount_due, fi.amount_paid,
                (fi.amount_due - fi.amount_paid)::numeric(10,2) AS balance_due,
                fi.due_date, fi.status,
                u.full_name, u.phone, mp.member_code, mp.profile_image
         FROM fee_invoices fi
         JOIN users u ON u.id = fi.member_id
         LEFT JOIN member_profiles mp ON mp.user_id = u.id
         WHERE fi.gym_id = $1 AND fi.status IN ('pending', 'partial', 'overdue')
         ORDER BY fi.due_date ASC`,
        [req.user.gym_id]
      ),
    ]);

    res.json({
      range: { from, to },
      totals: totalsRes.rows[0],
      byMethod: byMethodRes.rows,
      byMonth: byMonthRes.rows,
      outstanding: outstandingRes.rows,
    });
  } catch (err) {
    console.error('Revenue report error:', err);
    res.status(500).json({ error: 'Failed to generate revenue report' });
  }
});

// GET /api/reports/export?type=attendance|revenue|members
router.get('/export', async (req, res) => {
  try {
    const type = req.query.type || 'attendance';
    const g = [req.user.gym_id];
    let headers = [];
    let rows = [];

    if (type === 'attendance') {
      const result = await query(
        `SELECT mp.member_code, u.full_name, al.check_in_time, al.check_out_time, al.duration_minutes, al.marked_by, al.notes
         FROM attendance_logs al
         JOIN users u ON u.id = al.member_id
         LEFT JOIN member_profiles mp ON mp.user_id = u.id
         WHERE al.gym_id = $1
         ORDER BY al.check_in_time DESC LIMIT 1000`,
        g
      );
      headers = ['Member Code', 'Member Name', 'Check In Time', 'Check Out Time', 'Duration (mins)', 'Marked By', 'Notes'];
      rows = result.rows.map((r) => [
        r.member_code || '',
        r.full_name,
        new Date(r.check_in_time).toISOString(),
        r.check_out_time ? new Date(r.check_out_time).toISOString() : 'Still In Gym',
        r.duration_minutes ?? '',
        r.marked_by,
        r.notes || '',
      ]);
    } else if (type === 'revenue') {
      const result = await query(
        `SELECT p.receipt_number, p.payment_date, mp.member_code, u.full_name, fi.title, p.amount, p.payment_method, p.reference_note
         FROM payments p
         JOIN users u ON u.id = p.member_id
         LEFT JOIN member_profiles mp ON mp.user_id = u.id
         LEFT JOIN fee_invoices fi ON fi.id = p.invoice_id
         WHERE p.gym_id = $1
         ORDER BY p.payment_date DESC LIMIT 1000`,
        g
      );
      headers = ['Receipt #', 'Date', 'Member Code', 'Member Name', 'Fee Title', 'Amount', 'Method', 'Notes'];
      rows = result.rows.map((r) => [
        r.receipt_number,
        new Date(r.payment_date).toISOString(),
        r.member_code || '',
        r.full_name,
        r.title || 'Gym Fee',
        r.amount,
        r.payment_method,
        r.reference_note || '',
      ]);
    } else {
      const result = await query(
        `SELECT mp.member_code, u.full_name, u.email, u.phone, pl.name AS plan_name, mp.membership_status, mp.plan_start_date, mp.plan_end_date, mp.fitness_goal
         FROM users u
         JOIN member_profiles mp ON mp.user_id = u.id
         LEFT JOIN membership_plans pl ON pl.id = mp.plan_id
         WHERE u.role = 'customer' AND u.gym_id = $1
         ORDER BY u.full_name ASC`,
        g
      );
      headers = ['Member Code', 'Name', 'Email', 'Phone', 'Plan', 'Status', 'Start Date', 'End Date', 'Fitness Goal'];
      rows = result.rows.map((r) => [
        r.member_code,
        r.full_name,
        r.email,
        r.phone || '',
        r.plan_name || '',
        r.membership_status,
        r.plan_start_date || '',
        r.plan_end_date || '',
        r.fitness_goal || '',
      ]);
    }

    const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csvContent = [headers.map(csvEscape).join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="gym-${type}-report.csv"`);
    res.send(csvContent);
  } catch (err) {
    console.error('Export CSV error:', err);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

export default router;
