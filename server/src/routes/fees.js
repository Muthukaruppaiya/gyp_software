import express from 'express';
import { pool, query } from '../db/pool.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// GET /api/fees/invoices
router.get('/invoices', async (req, res) => {
  try {
    const { status, memberId } = req.query;
    const params = [];
    const clauses = [];

    if (req.user.role === 'customer') {
      params.push(req.user.id);
      clauses.push(`fi.member_id = $${params.length}`);
    } else if (memberId) {
      params.push(memberId);
      clauses.push(`fi.member_id = $${params.length}`);
    }

    if (status && status !== 'all') {
      params.push(status);
      clauses.push(`fi.status = $${params.length}`);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT fi.*,
              u.full_name, u.email, u.phone,
              mp.member_code, mp.profile_image,
              pl.name AS plan_name,
              (fi.amount_due - fi.amount_paid)::numeric(10,2) AS balance_due
       FROM fee_invoices fi
       JOIN users u ON u.id = fi.member_id
       LEFT JOIN member_profiles mp ON mp.user_id = u.id
       LEFT JOIN membership_plans pl ON pl.id = fi.plan_id
       ${where}
       ORDER BY
         CASE fi.status WHEN 'overdue' THEN 1 WHEN 'pending' THEN 2 WHEN 'partial' THEN 3 ELSE 4 END,
         fi.due_date DESC`,
      params
    );

    res.json({ invoices: rows });
  } catch (err) {
    console.error('Get invoices error:', err);
    res.status(500).json({ error: 'Failed to load fee invoices' });
  }
});

// POST /api/fees/invoices (Owner creates a new fee/invoice)
router.post('/invoices', requireRole('owner'), async (req, res) => {
  try {
    const { member_id, plan_id, title, amount_due, due_date, period_start, period_end } = req.body;
    if (!member_id || !title || amount_due === undefined || !due_date) {
      return res.status(400).json({ error: 'Member, title, amount_due, and due_date are required' });
    }

    const { rows } = await query(
      `INSERT INTO fee_invoices (member_id, plan_id, title, amount_due, amount_paid, due_date, status, period_start, period_end)
       VALUES ($1, $2, $3, $4, 0, $5, CASE WHEN $5::date < CURRENT_DATE THEN 'overdue' ELSE 'pending' END, $6, $7)
       RETURNING *`,
      [
        Number(member_id),
        plan_id ? Number(plan_id) : null,
        title.trim(),
        Number(amount_due),
        due_date,
        period_start || null,
        period_end || null,
      ]
    );

    res.status(201).json({ invoice: rows[0] });
  } catch (err) {
    console.error('Create invoice error:', err);
    res.status(500).json({ error: 'Failed to create fee invoice' });
  }
});

// GET /api/fees/payments
router.get('/payments', async (req, res) => {
  try {
    const { memberId, method } = req.query;
    const params = [];
    const clauses = [];

    if (req.user.role === 'customer') {
      params.push(req.user.id);
      clauses.push(`p.member_id = $${params.length}`);
    } else if (memberId) {
      params.push(memberId);
      clauses.push(`p.member_id = $${params.length}`);
    }

    if (method && method !== 'all') {
      params.push(method);
      clauses.push(`p.payment_method = $${params.length}`);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT p.*,
              u.full_name, u.email, u.phone,
              mp.member_code, mp.profile_image,
              fi.title AS invoice_title
       FROM payments p
       JOIN users u ON u.id = p.member_id
       LEFT JOIN member_profiles mp ON mp.user_id = u.id
       LEFT JOIN fee_invoices fi ON fi.id = p.invoice_id
       ${where}
       ORDER BY p.payment_date DESC`,
      params
    );

    res.json({ payments: rows });
  } catch (err) {
    console.error('Get payments error:', err);
    res.status(500).json({ error: 'Failed to load payments' });
  }
});

// POST /api/fees/payments (Owner records payment)
router.post('/payments', requireRole('owner'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { invoice_id, member_id, amount, payment_method, reference_note, extend_membership } = req.body;
    const payAmount = Number(amount);

    if (!member_id || !payAmount || payAmount <= 0 || !payment_method) {
      return res.status(400).json({ error: 'Member, valid positive amount, and payment method are required' });
    }

    await client.query('BEGIN');

    let targetInvoiceId = invoice_id ? Number(invoice_id) : null;
    if (targetInvoiceId) {
      const invRes = await client.query('SELECT * FROM fee_invoices WHERE id = $1 FOR UPDATE', [targetInvoiceId]);
      if (invRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Invoice not found' });
      }
      const inv = invRes.rows[0];
      const newPaid = Number(inv.amount_paid) + payAmount;
      const newStatus = newPaid >= Number(inv.amount_due) ? 'paid' : 'partial';

      await client.query(
        `UPDATE fee_invoices
         SET amount_paid = $1, status = $2, updated_at = NOW()
         WHERE id = $3`,
        [newPaid, newStatus, targetInvoiceId]
      );

      if (extend_membership && newStatus === 'paid' && inv.plan_id) {
        const planRes = await client.query('SELECT duration_days FROM membership_plans WHERE id = $1', [inv.plan_id]);
        if (planRes.rowCount > 0) {
          const days = planRes.rows[0].duration_days;
          await client.query(
            `UPDATE member_profiles
             SET membership_status = 'active',
                 plan_id = $1,
                 plan_start_date = COALESCE(period_start, CURRENT_DATE),
                 plan_end_date = COALESCE(period_end, CURRENT_DATE + $2::int),
                 updated_at = NOW()
             FROM (SELECT $3::date AS period_start, $4::date AS period_end) p
             WHERE user_id = $5`,
            [inv.plan_id, days, inv.period_start, inv.period_end, member_id]
          );
        }
      }
    }

    const receiptNumber = `RCP-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 89)}`;
    const payRes = await client.query(
      `INSERT INTO payments (
         invoice_id, member_id, amount, payment_method, receipt_number, reference_note, recorded_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [targetInvoiceId, Number(member_id), payAmount, payment_method, receiptNumber, reference_note || null, req.user.id]
    );

    await client.query('COMMIT');
    res.status(201).json({ message: 'Payment recorded successfully', payment: payRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Record payment error:', err);
    res.status(500).json({ error: 'Failed to record payment' });
  } finally {
    client.release();
  }
});

export default router;
