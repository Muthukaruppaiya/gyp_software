import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { applyTestAvatars } from './testAvatars.js';
import { runMigrations } from './migrations.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Client } = pg;

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
};

const targetDbName = process.env.DB_NAME || 'gym_management';

async function ensureDatabaseExists() {
  const adminClient = new Client({ ...dbConfig, database: 'postgres' });
  await adminClient.connect();
  try {
    const res = await adminClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [targetDbName]);
    if (res.rowCount === 0) {
      await adminClient.query(`CREATE DATABASE "${targetDbName}"`);
      console.log(`Created database "${targetDbName}"`);
    } else {
      console.log(`Database "${targetDbName}" already exists`);
    }
  } finally {
    await adminClient.end();
  }
}

async function seedDatabase(client) {
  const { rows: existingUsers } = await client.query('SELECT COUNT(*)::int AS count FROM users');
  if (existingUsers[0].count > 0) {
    console.log('Database already has seed data; skipping seed insertion.');
    return;
  }

  const ownerHash = await bcrypt.hash('owner123', 10);
  const memberHash = await bcrypt.hash('member123', 10);

  // 0. Platform super admin (sees every gym)
  await client.query(
    `INSERT INTO users (email, password_hash, role, full_name, gym_id)
     VALUES ('admin@ironpulse.fit', $1, 'superadmin', 'Platform Admin', NULL)`,
    [await bcrypt.hash('admin123', 10)]
  );

  // 1. Gym (tenant) row
  const gymRes = await client.query(
    `INSERT INTO gym_settings (gym_name, tagline, phone, email, address, opening_hours, currency_symbol,
                               latitude, longitude, geofence_radius_m, owner_onboarded, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 12.971900, 77.641200, 100, TRUE, 'active')
     RETURNING id`,
    [
      'IronPulse Fitness Studio',
      'Strength • Conditioning • Community',
      '+91 98450 11223',
      'contact@ironpulse.fit',
      '2nd Floor, Aura Plaza, Indiranagar 100ft Road, Bengaluru 560038',
      '05:30 AM – 10:30 PM (Mon–Sat) | 07:00 AM – 01:00 PM (Sun)',
      '₹',
    ]
  );
  const gymId = gymRes.rows[0].id;

  // 2. Owner of that gym
  const ownerRes = await client.query(
    `INSERT INTO users (email, password_hash, role, full_name, phone, gym_id)
     VALUES ($1, $2, 'owner', $3, $4, $5) RETURNING id`,
    ['owner@ironpulse.fit', ownerHash, 'Rajesh Nair', '+91 98450 11223', gymId]
  );
  const ownerId = ownerRes.rows[0].id;
  await client.query('UPDATE gym_settings SET owner_user_id = $1 WHERE id = $2', [ownerId, gymId]);

  // 3. Membership Plans
  const plansData = [
    // [name, days, regular price, description, first-month (joining) price or null]
    ['Monthly Standard', 30, 1500, 'Full gym floor & cardio access for 30 days', 2000],
    ['Quarterly Pro', 90, 4000, 'Full gym access + 2 trainer check-ins per month', null],
    ['Half-Yearly Elite', 180, 7500, 'All access + body composition tracking & locker', null],
    ['Annual Transformation', 365, 13500, 'Unlimited access + personalized workout & diet plan', null],
  ];

  const planIds = [];
  for (const [name, days, price, desc, firstMonthPrice] of plansData) {
    const res = await client.query(
      `INSERT INTO membership_plans (name, duration_days, price, description, first_month_price, gym_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, duration_days, price, name`,
      [name, days, price, desc, firstMonthPrice, gymId]
    );
    planIds.push(res.rows[0]);
  }

  // 4. Demo Members
  const membersSeed = [
    {
      email: 'arjun@ironpulse.fit',
      name: 'Arjun Mehta',
      phone: '+91 98765 43210',
      code: 'IPF-1001',
      planIdx: 1,
      startOffsetDays: -35,
      status: 'active',
      dob: '1996-04-12',
      gender: 'Male',
      address: '14th Main, HAL 2nd Stage, Bengaluru',
      ecName: 'Kavita Mehta',
      ecPhone: '+91 98765 43211',
      height: 176.5,
      weight: 74.2,
      goal: 'Lean Muscle Gain',
      feeStatus: 'paid',
    },
    {
      email: 'priya@ironpulse.fit',
      name: 'Priya Sharma',
      phone: '+91 98111 22334',
      code: 'IPF-1002',
      planIdx: 0,
      startOffsetDays: -24,
      status: 'active',
      dob: '1998-09-21',
      gender: 'Female',
      address: 'Domlur Layout, Bengaluru',
      ecName: 'Rohit Sharma',
      ecPhone: '+91 98111 22335',
      height: 164.0,
      weight: 59.5,
      goal: 'Fat Loss & Core Strength',
      feeStatus: 'pending',
    },
    {
      email: 'karthik@ironpulse.fit',
      name: 'Karthik Reddy',
      phone: '+91 99001 55667',
      code: 'IPF-1003',
      planIdx: 3,
      startOffsetDays: -120,
      status: 'active',
      dob: '1993-01-18',
      gender: 'Male',
      address: 'Koramangala 4th Block, Bengaluru',
      ecName: 'Suresh Reddy',
      ecPhone: '+91 99001 55668',
      height: 181.0,
      weight: 82.0,
      goal: 'Strength & Powerlifting',
      feeStatus: 'paid',
    },
    {
      email: 'sneha@ironpulse.fit',
      name: 'Sneha Iyer',
      phone: '+91 97400 88990',
      code: 'IPF-1004',
      planIdx: 2,
      startOffsetDays: -75,
      status: 'active',
      dob: '1999-07-03',
      gender: 'Female',
      address: 'Ulsoor Lake Road, Bengaluru',
      ecName: 'Meera Iyer',
      ecPhone: '+91 97400 88991',
      height: 160.5,
      weight: 55.8,
      goal: 'Athletic Conditioning',
      feeStatus: 'paid',
    },
    {
      email: 'vikram@ironpulse.fit',
      name: 'Vikram Verma',
      phone: '+91 96320 77889',
      code: 'IPF-1005',
      planIdx: 0,
      startOffsetDays: -40,
      status: 'expired',
      dob: '1991-11-30',
      gender: 'Male',
      address: 'CV Raman Nagar, Bengaluru',
      ecName: 'Ananya Verma',
      ecPhone: '+91 96320 77880',
      height: 174.0,
      weight: 86.4,
      goal: 'Weight Management',
      feeStatus: 'overdue',
    },
    {
      email: 'divya@ironpulse.fit',
      name: 'Divya Krishnan',
      phone: '+91 98802 33445',
      code: 'IPF-1006',
      planIdx: 1,
      startOffsetDays: -12,
      status: 'active',
      dob: '1995-03-14',
      gender: 'Female',
      address: 'Indiranagar Stage 1, Bengaluru',
      ecName: 'Ramesh Krishnan',
      ecPhone: '+91 98802 33446',
      height: 167.0,
      weight: 61.0,
      goal: 'Mobility & Endurance',
      feeStatus: 'partial',
    },
    {
      email: 'rohan@ironpulse.fit',
      name: 'Rohan Kulkarni',
      phone: '+91 97312 66778',
      code: 'IPF-1007',
      planIdx: 0,
      startOffsetDays: -10,
      status: 'active',
      dob: '2000-06-25',
      gender: 'Male',
      address: 'Jeevan Bima Nagar, Bengaluru',
      ecName: 'Prakash Kulkarni',
      ecPhone: '+91 97312 66779',
      height: 178.0,
      weight: 71.5,
      goal: 'Hypertrophy',
      feeStatus: 'paid',
    },
    {
      email: 'ananya@ironpulse.fit',
      name: 'Ananya Menon',
      phone: '+91 98451 99001',
      code: 'IPF-1008',
      planIdx: 2,
      startOffsetDays: -50,
      status: 'active',
      dob: '1997-12-08',
      gender: 'Female',
      address: 'Frazer Town, Bengaluru',
      ecName: 'Lakshmi Menon',
      ecPhone: '+91 98451 99002',
      height: 162.5,
      weight: 57.2,
      goal: 'General Fitness',
      feeStatus: 'paid',
    },
  ];

  const memberIds = [];
  let receiptSeq = 1001;

  for (const m of membersSeed) {
    const plan = planIds[m.planIdx];
    const uRes = await client.query(
      `INSERT INTO users (email, password_hash, role, full_name, phone, gym_id)
       VALUES ($1, $2, 'customer', $3, $4, $5) RETURNING id`,
      [m.email, memberHash, m.name, m.phone, gymId]
    );
    const userId = uRes.rows[0].id;
    memberIds.push({ userId, ...m });

    const startDate = new Date();
    startDate.setDate(startDate.getDate() + m.startOffsetDays);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + plan.duration_days);

    await client.query(
      `INSERT INTO member_profiles (
         user_id, member_code, plan_id, plan_start_date, plan_end_date, membership_status,
         date_of_birth, gender, address, emergency_contact_name, emergency_contact_phone,
         height_cm, weight_kg, fitness_goal
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        userId,
        m.code,
        plan.id,
        startDate.toISOString().slice(0, 10),
        endDate.toISOString().slice(0, 10),
        m.status,
        m.dob,
        m.gender,
        m.address,
        m.ecName,
        m.ecPhone,
        m.height,
        m.weight,
        m.goal,
      ]
    );

    const amountDue = Number(plan.price);
    let amountPaid = amountDue;
    let dueDate = new Date(startDate);
    if (m.feeStatus === 'pending') {
      amountPaid = 0;
      dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 4);
    } else if (m.feeStatus === 'overdue') {
      amountPaid = 0;
      dueDate = new Date();
      dueDate.setDate(dueDate.getDate() - 10);
    } else if (m.feeStatus === 'partial') {
      amountPaid = Math.round(amountDue * 0.5);
      dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);
    }

    const invRes = await client.query(
      `INSERT INTO fee_invoices (
         member_id, plan_id, title, amount_due, amount_paid, due_date, status, period_start, period_end, gym_id
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [
        userId,
        plan.id,
        `${plan.name} Membership`,
        amountDue,
        amountPaid,
        dueDate.toISOString().slice(0, 10),
        m.feeStatus,
        startDate.toISOString().slice(0, 10),
        endDate.toISOString().slice(0, 10),
        gymId,
      ]
    );

    if (amountPaid > 0) {
      const methods = ['UPI', 'Card', 'Cash', 'Bank Transfer'];
      const payDate = new Date(startDate);
      payDate.setHours(10, 30, 0, 0);
      await client.query(
        `INSERT INTO payments (
           invoice_id, member_id, amount, payment_method, payment_date, receipt_number, reference_note, recorded_by, gym_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          invRes.rows[0].id,
          userId,
          amountPaid,
          methods[receiptSeq % methods.length],
          payDate.toISOString(),
          `RCP-${receiptSeq++}`,
          m.feeStatus === 'partial' ? 'Initial 50% installment' : 'Full plan settlement',
          ownerId,
          gymId,
        ]
      );
    }
  }

  // 5. Attendance logs over the past 10 days + 2 currently checked-in today
  const now = new Date();
  for (let dayOffset = 10; dayOffset >= 1; dayOffset--) {
    for (let idx = 0; idx < memberIds.length; idx++) {
      // Deterministic realistic attendance pattern
      if ((dayOffset + idx) % 3 === 0) continue;
      const m = memberIds[idx];
      if (m.status === 'expired' && dayOffset < 5) continue;

      const checkIn = new Date(now);
      checkIn.setDate(now.getDate() - dayOffset);
      const startHour = idx % 2 === 0 ? 6 + (idx % 3) : 17 + (idx % 3);
      checkIn.setHours(startHour, (idx * 11) % 45, 0, 0);

      const durationMins = 45 + ((dayOffset * 7 + idx * 13) % 50);
      const checkOut = new Date(checkIn.getTime() + durationMins * 60000);

      await client.query(
        `INSERT INTO attendance_logs (member_id, check_in_time, check_out_time, marked_by, notes, gym_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          m.userId,
          checkIn.toISOString(),
          checkOut.toISOString(),
          idx % 4 === 0 ? 'owner' : 'self',
          idx % 2 === 0 ? 'Morning strength session' : 'Evening conditioning',
          gymId,
        ]
      );
    }
  }

  // Add completed sessions earlier today + 2 currently active check-ins right now
  const todayMorning = new Date(now);
  todayMorning.setHours(6, 30, 0, 0);
  if (todayMorning < now) {
    const out1 = new Date(todayMorning.getTime() + 68 * 60000);
    await client.query(
      `INSERT INTO attendance_logs (member_id, check_in_time, check_out_time, marked_by, notes, gym_id)
       VALUES ($1, $2, $3, 'self', 'Morning workout', $4)`,
      [memberIds[0].userId, todayMorning.toISOString(), out1.toISOString(), gymId]
    );
  }

  // Two active members currently inside the gym
  const active1 = new Date(now.getTime() - 42 * 60000);
  const active2 = new Date(now.getTime() - 18 * 60000);
  await client.query(
    `INSERT INTO attendance_logs (member_id, check_in_time, marked_by, notes, gym_id)
     VALUES ($1, $2, 'self', 'Evening session', $5), ($3, $4, 'owner', 'Front-desk check-in', $5)`,
    [memberIds[1].userId, active1.toISOString(), memberIds[2].userId, active2.toISOString(), gymId]
  );

  // 6. A second, fully separate demo gym to show data isolation
  const gym2 = (
    await client.query(
      `INSERT INTO gym_settings (gym_name, tagline, phone, email, address, currency_symbol,
                                 latitude, longitude, geofence_radius_m, owner_onboarded, status)
       VALUES ('FlexZone Gym', 'Train • Recover • Repeat', '+91 90031 44556', 'hello@flexzone.fit',
               'Anna Nagar 2nd Avenue, Chennai 600040', '₹', 13.085000, 80.210100, 100, TRUE, 'active')
       RETURNING id`
    )
  ).rows[0].id;
  const owner2 = (
    await client.query(
      `INSERT INTO users (email, password_hash, role, full_name, phone, gym_id)
       VALUES ('owner@flexzone.fit', $1, 'owner', 'Meena Subramanian', '+91 90031 44556', $2) RETURNING id`,
      [ownerHash, gym2]
    )
  ).rows[0].id;
  await client.query('UPDATE gym_settings SET owner_user_id = $1 WHERE id = $2', [owner2, gym2]);
  const plan2 = (
    await client.query(
      `INSERT INTO membership_plans (name, duration_days, price, first_month_price, description, gym_id)
       VALUES ('Monthly Flex', 30, 1200, 1700, 'Gym floor + group classes', $1) RETURNING id`,
      [gym2]
    )
  ).rows[0].id;
  const flexMember = (
    await client.query(
      `INSERT INTO users (email, password_hash, role, full_name, phone, gym_id)
       VALUES ('lakshmi@flexzone.fit', $1, 'customer', 'Lakshmi Rao', '+91 90031 77889', $2) RETURNING id`,
      [memberHash, gym2]
    )
  ).rows[0].id;
  await client.query(
    `INSERT INTO member_profiles (user_id, member_code, plan_id, plan_start_date, plan_end_date, membership_status)
     VALUES ($1, 'FLX-2001', $2, CURRENT_DATE - 5, CURRENT_DATE + 25, 'active')`,
    [flexMember, plan2]
  );
  await client.query(
    `INSERT INTO fee_invoices (member_id, plan_id, title, amount_due, amount_paid, due_date, status, pricing_tier, gym_id)
     VALUES ($1, $2, 'Monthly Flex — Joining (First Month)', 1700, 1700, CURRENT_DATE - 5, 'paid', 'first', $3)`,
    [flexMember, plan2, gym2]
  );

  console.log('Seed data inserted successfully.');
  console.log('Super Admin Login:   admin@ironpulse.fit / admin123');
  console.log('Demo Owner Login:    owner@ironpulse.fit / owner123   (2nd gym: owner@flexzone.fit / owner123)');
  console.log('Demo Customer Login: arjun@ironpulse.fit / member123');
}

async function applyMigrations(client) {
  await runMigrations((sql, params) => client.query(sql, params));
}

async function runSetup() {
  await ensureDatabaseExists();
  const client = new Client({ ...dbConfig, database: targetDbName });
  await client.connect();
  try {
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    await client.query(schemaSql);
    await applyMigrations(client);
    console.log('Schema & migrations applied successfully.');
    await seedDatabase(client);
    const withPhotos = await applyTestAvatars(client);
    if (withPhotos > 0) console.log(`Test profile images applied to ${withPhotos} member(s).`);
  } finally {
    await client.end();
  }
}

runSetup()
  .then(() => {
    console.log('Database setup complete.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Database setup failed:', err.message);
    process.exit(1);
  });
