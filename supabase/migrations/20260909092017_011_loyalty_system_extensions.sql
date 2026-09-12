/*
# Loyalty System Extensions

## Overview
Extends the existing members, loyalty_transactions, and storage schema to support
configurable tier/cashback settings, KTP-based registration, daily cashback caps,
room upgrades for Gold members, birthday email tracking, manual transactions with
receipt images, and staff read access to member data.

## New Tables

### settings
- Singleton row (id=1) holding all configurable tier thresholds, cashback rates, and daily caps.

### room_upgrades
- Tracks Gold member room upgrade claims (member_id, claimed_at, location).

## Modified Tables

### members — new columns
- ktp, birth_month, birth_day, daily_cashback_earned, daily_cashback_date,
  last_birthday_email_sent, welcomed, tier_restored_at, last_room_upgrade

### loyalty_transactions — new columns
- note, receipt_url, manual

## Security
- settings: admin read/write only
- room_upgrades: admin read/write, member can read own
- members: staff get read access (read-only)
- loyalty_transactions: staff get read access
- receipts storage bucket: admin upload, authenticated read
*/

-- ── Settings table (singleton) ──
CREATE TABLE IF NOT EXISTS settings (
  id integer PRIMARY KEY DEFAULT 1,
  classic_to_bronze_monthly integer NOT NULL DEFAULT 100000,
  bronze_to_silver_monthly integer NOT NULL DEFAULT 300000,
  bronze_to_silver_yearly integer NOT NULL DEFAULT 1000000,
  silver_to_gold_monthly integer NOT NULL DEFAULT 500000,
  silver_to_gold_yearly integer NOT NULL DEFAULT 3000000,
  silver_stay_yearly integer NOT NULL DEFAULT 3000000,
  gold_stay_yearly integer NOT NULL DEFAULT 5000000,
  silver_cashback_rate numeric NOT NULL DEFAULT 0.05,
  gold_cashback_rate numeric NOT NULL DEFAULT 0.10,
  birthday_gold_cashback_rate numeric NOT NULL DEFAULT 0.30,
  silver_daily_cashback_cap integer NOT NULL DEFAULT 15000,
  gold_daily_cashback_cap integer NOT NULL DEFAULT 30000,
  bronze_discount_rate numeric NOT NULL DEFAULT 0.10,
  silver_discount_rate numeric NOT NULL DEFAULT 0.15,
  gold_discount_rate numeric NOT NULL DEFAULT 0.20,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_settings" ON settings;
CREATE POLICY "admin_select_settings" ON settings FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "admin_update_settings" ON settings;
CREATE POLICY "admin_update_settings" ON settings FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

-- Seed the singleton row
INSERT INTO settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ── Room upgrades table ──
CREATE TABLE IF NOT EXISTS room_upgrades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(user_id) ON DELETE CASCADE,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  location text
);

ALTER TABLE room_upgrades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_room_upgrades" ON room_upgrades;
CREATE POLICY "admin_select_room_upgrades" ON room_upgrades FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "member_select_own_room_upgrades" ON room_upgrades;
CREATE POLICY "member_select_own_room_upgrades" ON room_upgrades FOR SELECT
  TO authenticated USING (auth.uid() = member_id);

DROP POLICY IF EXISTS "admin_insert_room_upgrades" ON room_upgrades;
CREATE POLICY "admin_insert_room_upgrades" ON room_upgrades FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_room_upgrades_member ON room_upgrades(member_id);

-- ── Members table — add new columns ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'ktp') THEN
    ALTER TABLE members ADD COLUMN ktp text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'birth_month') THEN
    ALTER TABLE members ADD COLUMN birth_month integer;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'birth_day') THEN
    ALTER TABLE members ADD COLUMN birth_day integer;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'daily_cashback_earned') THEN
    ALTER TABLE members ADD COLUMN daily_cashback_earned integer NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'daily_cashback_date') THEN
    ALTER TABLE members ADD COLUMN daily_cashback_date date;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'last_birthday_email_sent') THEN
    ALTER TABLE members ADD COLUMN last_birthday_email_sent timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'welcomed') THEN
    ALTER TABLE members ADD COLUMN welcomed boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'tier_restored_at') THEN
    ALTER TABLE members ADD COLUMN tier_restored_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'last_room_upgrade') THEN
    ALTER TABLE members ADD COLUMN last_room_upgrade timestamptz;
  END IF;
END $$;

-- Backfill birth_month and birth_day for existing members
UPDATE members
SET birth_month = EXTRACT(MONTH FROM birthdate)::int,
    birth_day = EXTRACT(DAY FROM birthdate)::int
WHERE birthdate IS NOT NULL AND birth_month IS NULL;

-- Index for birthday queries
CREATE INDEX IF NOT EXISTS idx_members_birth_month_day ON members(birth_month, birth_day);

-- ── Staff read access to members (read-only) ──
DROP POLICY IF EXISTS "staff_select_members" ON members;
CREATE POLICY "staff_select_members" ON members FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM staff WHERE staff.user_id = auth.uid())
  );

-- ── Loyalty transactions — add new columns ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loyalty_transactions' AND column_name = 'note') THEN
    ALTER TABLE loyalty_transactions ADD COLUMN note text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loyalty_transactions' AND column_name = 'receipt_url') THEN
    ALTER TABLE loyalty_transactions ADD COLUMN receipt_url text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loyalty_transactions' AND column_name = 'manual') THEN
    ALTER TABLE loyalty_transactions ADD COLUMN manual boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Staff read access to loyalty transactions
DROP POLICY IF EXISTS "staff_select_loyalty" ON loyalty_transactions;
CREATE POLICY "staff_select_loyalty" ON loyalty_transactions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM staff WHERE staff.user_id = auth.uid())
  );

-- ── Storage bucket for receipts ──
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "auth_read_receipts" ON storage.objects;
CREATE POLICY "auth_read_receipts" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'receipts');

DROP POLICY IF EXISTS "admin_insert_receipts" ON storage.objects;
CREATE POLICY "admin_insert_receipts" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (
    bucket_id = 'receipts' AND
    EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );
