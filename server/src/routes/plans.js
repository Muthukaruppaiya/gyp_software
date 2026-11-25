import express from 'express';
import { query } from '../db/pool.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// GET /api/plans
router.get('/', authenticate, async (req, res) => {
  try {
    const includeInactive = req.user.role === 'owner' && req.query.all === 'true';
    const sql = includeInactive
      ? 'SELECT * FROM membership_plans ORDER BY duration_days ASC'
      : 'SELECT * FROM membership_plans WHERE is_active = TRUE ORDER BY duration_days ASC';
    const { rows } = await query(sql);
    res.json({ plans: rows });
  } catch (err) {
    console.error('Get plans error:', err);
    res.status(500).json({ error: 'Failed to load membership plans' });
  }
});

// POST /api/plans
router.post('/', authenticate, requireRole('owner'), async (req, res) => {
  try {
    const { name, duration_days, price, description } = req.body;
    if (!name || !duration_days || price === undefined) {
      return res.status(400).json({ error: 'Name, duration_days, and price are required' });
    }
    const { rows } = await query(
      `INSERT INTO membership_plans (name, duration_days, price, description)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name.trim(), Number(duration_days), Number(price), description || '']
    );
    res.status(201).json({ plan: rows[0] });
  } catch (err) {
    console.error('Create plan error:', err);
    res.status(500).json({ error: 'Failed to create plan' });
  }
});

// PUT /api/plans/:id
router.put('/:id', authenticate, requireRole('owner'), async (req, res) => {
  try {
    const { name, duration_days, price, description, is_active } = req.body;
    const { rows } = await query(
      `UPDATE membership_plans
       SET name = COALESCE($1, name),
           duration_days = COALESCE($2, duration_days),
           price = COALESCE($3, price),
           description = COALESCE($4, description),
           is_active = COALESCE($5, is_active)
       WHERE id = $6 RETURNING *`,
      [
        name ? name.trim() : null,
        duration_days ? Number(duration_days) : null,
        price !== undefined ? Number(price) : null,
        description !== undefined ? description : null,
        is_active !== undefined ? Boolean(is_active) : null,
        req.params.id,
      ]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Plan not found' });
    res.json({ plan: rows[0] });
  } catch (err) {
    console.error('Update plan error:', err);
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

export default router;
