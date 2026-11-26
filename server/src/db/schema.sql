-- Gym Management Software PostgreSQL Schema

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'customer')),
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(30),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gym_settings (
  id SERIAL PRIMARY KEY,
  owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  gym_name VARCHAR(150) NOT NULL DEFAULT 'IronPulse Fitness Studio',
  tagline VARCHAR(255) DEFAULT 'Strength • Conditioning • Community',
  phone VARCHAR(30),
  email VARCHAR(255),
  address TEXT,
  opening_hours VARCHAR(120) DEFAULT '05:30 AM - 10:30 PM',
  currency_symbol VARCHAR(10) DEFAULT '₹',
  logo_image TEXT,
  whatsapp VARCHAR(30),
  website VARCHAR(255),
  instagram VARCHAR(120),
  upi_id VARCHAR(100),
  gstin VARCHAR(20),
  latitude NUMERIC(9, 6),
  longitude NUMERIC(9, 6),
  geofence_radius_m INTEGER NOT NULL DEFAULT 100,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS membership_plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  duration_days INTEGER NOT NULL CHECK (duration_days > 0),
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  -- Optional price for a member's FIRST bill on this plan (joining month). Renewals use `price`.
  first_month_price NUMERIC(10, 2) CHECK (first_month_price >= 0),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS member_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_code VARCHAR(30) UNIQUE NOT NULL,
  onboarding_code VARCHAR(20) UNIQUE,
  onboarding_completed BOOLEAN NOT NULL DEFAULT TRUE,
  profile_image TEXT,
  plan_id INTEGER REFERENCES membership_plans(id) ON DELETE SET NULL,
  plan_start_date DATE,
  plan_end_date DATE,
  membership_status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (membership_status IN ('active', 'expired', 'frozen')),
  date_of_birth DATE,
  gender VARCHAR(20),
  address TEXT,
  emergency_contact_name VARCHAR(120),
  emergency_contact_phone VARCHAR(30),
  height_cm NUMERIC(5, 1),
  weight_kg NUMERIC(5, 1),
  fitness_goal VARCHAR(150),
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance_logs (
  id SERIAL PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  check_in_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_out_time TIMESTAMPTZ,
  duration_minutes INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN check_out_time IS NOT NULL THEN GREATEST(1, ROUND(EXTRACT(EPOCH FROM (check_out_time - check_in_time)) / 60.0)::INTEGER)
      ELSE NULL
    END
  ) STORED,
  marked_by VARCHAR(20) NOT NULL DEFAULT 'self' CHECK (marked_by IN ('self', 'owner')),
  auto_checked_out BOOLEAN NOT NULL DEFAULT FALSE,
  notes VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_member_time ON attendance_logs (member_id, check_in_time DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_open ON attendance_logs (member_id) WHERE check_out_time IS NULL;
-- The UNIQUE one-open-session-per-member index is created in migrations.js (it first cleans up old duplicates).

CREATE TABLE IF NOT EXISTS fee_invoices (
  id SERIAL PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES membership_plans(id) ON DELETE SET NULL,
  title VARCHAR(150) NOT NULL,
  amount_due NUMERIC(10, 2) NOT NULL CHECK (amount_due >= 0),
  amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  due_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('paid', 'partial', 'pending', 'overdue')),
  period_start DATE,
  period_end DATE,
  pricing_tier VARCHAR(10) CHECK (pricing_tier IN ('first', 'regular')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_member ON fee_invoices (member_id, due_date DESC);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER REFERENCES fee_invoices(id) ON DELETE SET NULL,
  member_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('Cash', 'UPI', 'Card', 'Bank Transfer')),
  payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  receipt_number VARCHAR(50) UNIQUE NOT NULL,
  reference_note TEXT,
  recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_date ON payments (payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_member ON payments (member_id, payment_date DESC);
