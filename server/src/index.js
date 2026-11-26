import './config.js'; // loads .env and validates JWT_SECRET / GYM_TIMEZONE first
import express from 'express';
import cors from 'cors';
import { query } from './db/pool.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import plansRoutes from './routes/plans.js';
import membersRoutes from './routes/members.js';
import attendanceRoutes from './routes/attendance.js';
import feesRoutes from './routes/fees.js';
import reportsRoutes from './routes/reports.js';
import adminRoutes from './routes/admin.js';
import { ensureSuperAdmin } from './db/superAdmin.js';
import { ensureAttendanceSchema, startAutoCheckoutScheduler } from './jobs/autoCheckout.js';

const app = express();
const PORT = Number(process.env.PORT || 5000);

// Behind a reverse proxy (nginx, Hostinger, Render...) set TRUST_PROXY=1 so rate limits see the real client IP.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
}
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'no-referrer');
  next();
});

app.use(
  cors({
    origin: process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',') : true,
    credentials: true,
  })
);
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ ok: true, service: 'gym-management-api', db: 'connected' });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Database connection error' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/members', membersRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/fees', feesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/admin', adminRoutes);

app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Malformed JSON bodies and other unhandled errors → JSON response instead of an HTML stack trace.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request is too large' });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  try {
    // Apply schema upgrades before serving traffic so routes never hit a missing column/index.
    await ensureAttendanceSchema();
    await ensureSuperAdmin((sql, params) => query(sql, params));
  } catch (err) {
    console.error('[startup] Schema migration failed:', err.message || err.code || err);
  }

  app.listen(PORT, () => {
    console.log(`Gym Management API running on http://localhost:${PORT}`);
    startAutoCheckoutScheduler().catch((err) =>
      console.error('[auto-checkout] Could not start scheduler:', err.message || err.code || err)
    );
  });
}

start();
