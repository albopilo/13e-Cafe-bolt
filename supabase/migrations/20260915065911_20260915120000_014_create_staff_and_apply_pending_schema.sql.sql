/*
# Create staff table and apply pending schema from migrations 010-013

## Problem
Migrations 010-013 were written as files but never applied to the database.
The `staff` table was referenced by code but never created in any migration.
Without these, Main Kitchen staff cannot access manual transactions because:
  - The `staff` table doesn't exist (edge function can't verify assigned_location)
  - The `settings` table doesn't exist (edge function can't get tier thresholds)
  - The `receipts` storage bucket doesn't exist (can't upload receipt images)
  - Missing columns on members/loyalty_transactions (daily_cashback_earned, note, receipt_url, manual)
  - Missing RLS policies for staff read access

## What this migration does
1. Creates the `staff` table with RLS
2. Creates the `settings` table (singleton) with RLS
3. Creates the `room_upgrades` table with RLS
4. Adds missing columns to `members` and `loyalty_transactions`
5. Creates the `receipts` storage bucket with policies (admin + Main Kitchen staff can upload)
6. Adds staff read access RLS policies on `members` and `loyalty_transactions`
7. Updates `staff_select_orders` policy to use the staff table
8. Updates the `handle_new_user` trigger for birth_month/birth_day/ktp
9. Creates the `admin_delete_loyalty_transaction` function
*/

-- ── 1. Staff table ──
CREATE TABLE IF NOT EXISTS staff (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_location text NOT NULL DEFAULT 'Mille 1',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_staff" ON staff;
CREATE POLICY "admin_select_staff" ON staff FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "staff_select_own" ON staff;
CREATE POLICY "staff_select_own" ON staff FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_staff_location ON staff(assigned_location);

-- ── 2. Settings table (singleton) ──
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

INSERT INTO settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ── 3. Room upgrades table ──
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

-- ── 4. Members table — add missing columns ──
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

CREATE INDEX IF NOT EXISTS idx_members_birth_month_day ON members(birth_month, birth_day);

-- ── 5. Loyalty transactions — add missing columns ──
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

-- ── 6. Staff read access RLS policies ──
DROP POLICY IF EXISTS "staff_select_members" ON members;
CREATE POLICY "staff_select_members" ON members FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM staff WHERE staff.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "staff_select_loyalty" ON loyalty_transactions;
CREATE POLICY "staff_select_loyalty" ON loyalty_transactions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM staff WHERE staff.user_id = auth.uid())
  );

-- ── 7. Update staff_select_orders policy ──
DROP POLICY IF EXISTS "staff_select_orders" ON orders;
CREATE POLICY "staff_select_orders" ON orders FOR SELECT
  TO authenticated USING (
    NOT EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM staff
      WHERE staff.user_id = auth.uid()
      AND (
        staff.assigned_location = 'Main Kitchen'
        OR orders.table_name LIKE (staff.assigned_location || '%')
      )
    )
  );

-- ── 8. Receipts storage bucket ──
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "auth_read_receipts" ON storage.objects;
CREATE POLICY "auth_read_receipts" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'receipts');

DROP POLICY IF EXISTS "admin_insert_receipts" ON storage.objects;
CREATE POLICY "admin_insert_receipts" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (
    bucket_id = 'receipts' AND (
      EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM staff
        WHERE staff.user_id = auth.uid()
        AND staff.assigned_location = 'Main Kitchen'
      )
    )
  );

-- ── 9. Update handle_new_user trigger ──
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_birthdate date;
  v_ktp text;
BEGIN
  v_birthdate := NULLIF(NEW.raw_user_meta_data->>'birthdate', '')::date;
  v_ktp := NEW.raw_user_meta_data->>'ktp';

  INSERT INTO public.members (
    user_id, email, name, name_lower, phone, birthdate, birth_month, birth_day, ktp,
    tier, discount_rate, tax_rate
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'New Member'),
    LOWER(COALESCE(NEW.raw_user_meta_data->>'name', 'new member')),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    v_birthdate,
    CASE WHEN v_birthdate IS NOT NULL THEN EXTRACT(MONTH FROM v_birthdate)::int ELSE NULL END,
    CASE WHEN v_birthdate IS NOT NULL THEN EXTRACT(DAY FROM v_birthdate)::int ELSE NULL END,
    v_ktp,
    'Classic',
    0,
    0.10
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- ── 10. admin_delete_loyalty_transaction function ──
CREATE OR REPLACE FUNCTION public.admin_delete_loyalty_transaction(p_transaction_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx RECORD;
  v_member RECORD;
  v_new_spending integer;
  v_new_monthly integer;
  v_new_yearly integer;
  v_new_points integer;
  v_new_tier text;
  v_tier_changed boolean;
  v_discount_rate numeric;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  SELECT * INTO v_tx FROM loyalty_transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Transaction not found');
  END IF;

  SELECT * INTO v_member FROM members WHERE user_id = v_tx.member_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Member not found');
  END IF;

  v_new_spending := GREATEST(0, v_member.spending_since_upgrade - COALESCE(v_tx.amount, 0));
  v_new_monthly := GREATEST(0, v_member.monthly_since_upgrade - COALESCE(v_tx.amount, 0));
  v_new_yearly := GREATEST(0, v_member.yearly_since_upgrade - COALESCE(v_tx.amount, 0));
  v_new_points := GREATEST(0, v_member.redeemable_points - COALESCE(v_tx.points_earned, 0));

  v_new_tier := v_member.tier;
  IF v_new_yearly >= 5000000 THEN
    v_new_tier := 'Gold';
  ELSIF v_new_yearly >= 3000000 THEN
    v_new_tier := 'Silver';
  ELSIF v_new_yearly >= 1000000 THEN
    v_new_tier := 'Bronze';
  ELSIF v_new_monthly >= 100000 THEN
    v_new_tier := 'Bronze';
  ELSE
    v_new_tier := 'Classic';
  END IF;

  v_tier_changed := (v_new_tier <> v_member.tier);
  v_discount_rate := CASE v_new_tier
    WHEN 'Bronze' THEN 0.10
    WHEN 'Silver' THEN 0.15
    WHEN 'Gold' THEN 0.20
    ELSE 0
  END;

  IF v_tier_changed THEN
    UPDATE members SET
      spending_since_upgrade = 0,
      monthly_since_upgrade = 0,
      yearly_since_upgrade = 0,
      redeemable_points = v_new_points,
      tier = v_new_tier,
      discount_rate = v_discount_rate,
      upgrade_date = CURRENT_DATE
    WHERE user_id = v_tx.member_id;
  ELSE
    UPDATE members SET
      spending_since_upgrade = v_new_spending,
      monthly_since_upgrade = v_new_monthly,
      yearly_since_upgrade = v_new_yearly,
      redeemable_points = v_new_points
    WHERE user_id = v_tx.member_id;
  END IF;

  DELETE FROM loyalty_transactions WHERE id = p_transaction_id;

  IF v_tx.order_id IS NOT NULL THEN
    DELETE FROM orders WHERE id = v_tx.order_id;
  END IF;

  RETURN json_build_object('success', true, 'tier_changed', v_tier_changed, 'new_tier', v_new_tier);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_loyalty_transaction(uuid) TO authenticated;