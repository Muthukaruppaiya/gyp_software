// Usage: npm run db:test-images
// Adds the test profile photos to the demo members in an existing database.
import pg from 'pg';
import dotenv from 'dotenv';
import { applyTestAvatars } from './testAvatars.js';

dotenv.config();

const client = new pg.Client({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'gym_management',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

try {
  await client.connect();
  const n = await applyTestAvatars(client);
  console.log(`Test profile images applied to ${n} member(s).`);
} catch (err) {
  console.error('Failed to apply test images:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
