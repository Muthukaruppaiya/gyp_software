import pg from 'pg';
import { GYM_TIMEZONE } from '../config.js';

const { Pool, types } = pg;

// Return DATE columns as plain 'YYYY-MM-DD' strings. By default pg turns them into JS Date
// objects at *server-local* midnight, which serialise to the previous day in UTC
// (e.g. a date of birth saved in IST would slip back one day on every save).
types.setTypeParser(1082, (value) => value);

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'gym_management',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  // CURRENT_DATE, ::date casts and DATE_TRUNC all follow the gym's local day.
  options: `-c TimeZone=${GYM_TIMEZONE}`,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

export async function query(text, params) {
  return pool.query(text, params);
}
