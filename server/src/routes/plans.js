import express from 'express';
import { query } from '../db/pool.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { planInvoiceTitle, quotePlanForMember } from '../utils/pricing.js';

const router = express.Router();

router.use(authenticate);

function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Validates plan fields present in `body`. Returns { values } or { error }.
 * When `partial` is false (create), name/duration/price are required.
 */
function readPlanFields(body, { partial }) {
  const values = {};

  if (!partial || 'name' in body) {
    const name = String(body.name ?? '').trim();
    if (!name) return { error: 'Plan name is required' };
    if (name.length > 100) return { error: 'Plan name must be 100 characters or fewer' };
    values.name = name;
  }
  if (!partial || 'duration_days' in body) {
    const days = Number(body.duration_days);
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      return { error: 'Duration must be a whole number of days between 1 and 3650' };
    }
    values.duration_days = days;
  }
  if (!partial || 'price' in body) {
    const price = Number(body.price);
    if (body.price === '' || body.price === null || !Number.isFinite(price) || price < 0) {
      return { error: 'Regular price must be a valid amount (0 or more)' };
    }
    values.price = Math.round(price * 100) / 100;
  }
  if ('first_month_price' in body) {
    // Empty/null → no special first-month price (members pay the regular price from day one).
    const raw = body.first_month_price;
    if (raw === '' || raw === null || raw === undefined) {
      values.first_month_price = null;
    } else {
      const fmp = Number(raw);
      if (!Number.isFinite(fmp) || fmp < 0) return { error: 'First-month price must be a valid amount (0 or more)' };
      values.first_month_price = Math.round(fmp * 100) / 100;
    }
  }
  if ('description' in body) {
    values.description = String(body.description ?? '').trim();
  }
  if ('is_active' in body) {
    values.is_active = body.is_active === true || body.is_active === 'true';
  }
  return { values };
}

// GET /api/plans
router.get('/', async (req, res) => {
  try {
    const includeInactive = req.user.role === 'owner' && req.query.all === 'true';
    const sql = includeInactive
      ? 'SELECT * FROM membership_plans ORDER BY is_active DESC, duration_days ASC, id ASC'
      : 'SELECT * FROM membership_plans WHERE is_active = TRUE ORDER BY duration_days ASC, id ASC';
    const { rows } = await query(sql);
    res.json({ plans: rows });
  } catch (err) {
    console.error('Get plans error:', err);
    res.status(500).json({ error: 'Failed to load membership plans' });
  }
});

// GET /api/plans/:id/quote?memberId= — which price applies to this member right now (owner only)
router.get('/:id/quote', requireRole('owner'), async (req, res) => {
  try {
    const planId = parseId(req.params.id);
    if (!planId) return res.status(400).json({ error: 'Invalid plan id' });
    const memberId = req.query.memberId ? parseId(req.query.memberId) : null;

    const { rows } = await query('SELECT * FROM membership_plans WHERE id = $1', [planId]);
    const plan = rows[0];
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    const quote = await quotePlanForMember({ query }, plan, memberId);
    res.json({ ...quote, title: planInvoiceTitle(plan, quote.tier), plan_id: plan.id });
  } catch (err) {
    console.error('Plan quote error:', err);
    res.status(500).json({ error: 'Failed to calculate plan price' });
  }
});

// POST /api/plans
router.post('/', requireRole('owner'), async (req, res) => {
  try {
    const { values, error } = readPlanFields(req.body || {}, { partial: false });
    if (error) return res.status(400).json({ error });

    const { rows } = await query(
      `INSERT INTO membership_plans (name, duration_days, price, first_month_price, description, is_active)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        values.name,
        values.duration_days,
        values.price,
        values.first_month_price ?? null,
        values.description ?? '',
        values.is_active ?? true,
      ]
    );
    res.status(201).json({ plan: rows[0] });
  } catch (err) {
    console.error('Create plan error:', err);
    res.status(500).json({ error: 'Failed to create plan' });
  }
});

// PUT /api/plans/:id — only fields present in the body change (so a price can be cleared too)
router.put('/:id', requireRole('owner'), async (req, res) => {
  try {
    const planId = parseId(req.params.id);
    if (!planId) return res.status(400).json({ error: 'Invalid plan id' });

    const { values, error } = readPlanFields(req.body || {}, { partial: true });
    if (error) return res.status(400).json({ error });

    const columns = Object.keys(values);
    if (columns.length === 0) return res.status(400).json({ error: 'Nothing to update' });

    const params = columns.map((c) => values[c]);
    params.push(planId);
    const { rows } = await query(
      `UPDATE membership_plans
       SET ${columns.map((c, i) => `${c} = $${i + 1}`).join(', ')}
       WHERE id = $${params.length}
       RETURNING *`,
      params
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Plan not found' });
    res.json({ plan: rows[0] });
  } catch (err) {
    console.error('Update plan error:', err);
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

export default router;
