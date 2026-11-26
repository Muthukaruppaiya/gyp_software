import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';
import { query } from '../db/pool.js';

export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }

  try {
    // Re-check the account (and its gym) on every request so deactivation, suspension and
    // role changes take effect immediately, not only when the 7-day token expires.
    // gym_id always comes from the database, never from the token or the request.
    const { rows } = await query(
      `SELECT u.id, u.email, u.role, u.full_name, u.is_active, u.gym_id, g.status AS gym_status
       FROM users u
       LEFT JOIN gym_settings g ON g.id = u.gym_id
       WHERE u.id = $1`,
      [decoded.id]
    );
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Account no longer exists' });
    }
    if (!user.is_active) {
      return res
        .status(403)
        .json({ error: 'Account is deactivated. Please contact the gym owner.', code: 'ACCOUNT_DEACTIVATED' });
    }
    if (user.role !== 'superadmin' && user.gym_status === 'suspended') {
      return res
        .status(403)
        .json({ error: 'This gym account is suspended. Please contact support.', code: 'GYM_SUSPENDED' });
    }
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      gym_id: user.gym_id,
    };
    next();
  } catch (err) {
    console.error('Auth lookup error:', err);
    res.status(500).json({ error: 'Failed to verify session' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission for this action' });
    }
    next();
  };
}

/** Routes that work on one gym's data: only that gym's owner and members. */
export const requireGymUser = requireRole('owner', 'customer');
