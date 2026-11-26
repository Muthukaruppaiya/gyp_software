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
    // Re-check the account on every request so deactivation/role changes take effect immediately,
    // not only when the 7-day token expires.
    const { rows } = await query('SELECT id, email, role, full_name, is_active FROM users WHERE id = $1', [
      decoded.id,
    ]);
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Account no longer exists' });
    }
    if (!user.is_active) {
      return res
        .status(403)
        .json({ error: 'Account is deactivated. Please contact the gym owner.', code: 'ACCOUNT_DEACTIVATED' });
    }
    req.user = { id: user.id, email: user.email, role: user.role, full_name: user.full_name };
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
