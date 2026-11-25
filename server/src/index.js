import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { query } from './db/pool.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import plansRoutes from './routes/plans.js';
import membersRoutes from './routes/members.js';
import attendanceRoutes from './routes/attendance.js';
import feesRoutes from './routes/fees.js';
import reportsRoutes from './routes/reports.js';
import { startAutoCheckoutScheduler } from './jobs/autoCheckout.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5000);

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

app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.listen(PORT, () => {
  console.log(`Gym Management API running on http://localhost:${PORT}`);
  startAutoCheckoutScheduler().catch((err) =>
    console.error('[auto-checkout] Could not start scheduler:', err.message)
  );
});
