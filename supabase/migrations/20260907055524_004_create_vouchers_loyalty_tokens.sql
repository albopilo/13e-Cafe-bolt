/*
# Create vouchers, voucher_redemptions, loyalty_transactions, and staff_push_tokens tables

## Overview
Creates the remaining tables: voucher management, voucher redemption tracking, loyalty transaction ledger, and staff push notification tokens.

## New Tables

### vouchers
- `id` (uuid, PK)
- `code` (text, unique, not null) — voucher code entered at checkout
- `type` (text, not null) — 'percent' or 'fixed'
- `value` (numeric, not null) — percentage (e.g. 10 for 10%) or fixed rupiah amount
- `limit_per_day` (integer, default 0) — max redemptions per day (0 = unlimited)
- `active` (boolean, default true)

### voucher_redemptions
- `id` (uuid, PK)
- `voucher_id` (uuid, FK to vouchers, ON DELETE CASCADE)
- `order_id` (uuid, FK to orders, ON DELETE SET NULL)
- `table_name` (text, not null)
- `redeemed_at` (timestamptz, default now)

### loyalty_transactions
- `id` (uuid, PK)
- `member_id` (uuid, FK to members, ON DELETE CASCADE)
- `order_id` (uuid, FK to orders, ON DELETE SET NULL)
- `amount` (integer, not null) — order amount in rupiah
- `cashback` (integer, not null) — cashback earned in rupiah
- `points_earned` (integer, not null) — points earned
- `source` (text, not null) — 'order_served', 'order_cancelled', 'manual_adjustment'
- `table_name` (text, not null)
- `created_at` (timestamptz, default now)

### staff_push_tokens
- `id` (uuid, PK)
- `user_id` (uuid, FK to auth.users, ON DELETE CASCADE)
- `token` (text, not null) — push notification device token
- `role` (text, not null, default 'staff') — 'staff' or 'admin'
- `created_at` (timestamptz, default now)

## Security
- vouchers: public read (code + active only), admin full CRUD
- voucher_redemptions: no direct client access (edge function only)
- loyalty_transactions: member reads own, admin reads all, no client writes
- staff_push_tokens: user reads/inserts own tokens, no client deletes
*/

-- Vouchers
CREATE TABLE IF NOT EXISTS vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  type text NOT NULL,
  value numeric NOT NULL,
  limit_per_day integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);

ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_vouchers" ON vouchers;
CREATE POLICY "public_select_vouchers" ON vouchers FOR SELECT
  TO anon, authenticated USING (active = true);

DROP POLICY IF EXISTS "admin_select_vouchers" ON vouchers;
CREATE POLICY "admin_select_vouchers" ON vouchers FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "admin_insert_vouchers" ON vouchers;
CREATE POLICY "admin_insert_vouchers" ON vouchers FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "admin_update_vouchers" ON vouchers;
CREATE POLICY "admin_update_vouchers" ON vouchers FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "admin_delete_vouchers" ON vouchers;
CREATE POLICY "admin_delete_vouchers" ON vouchers FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

-- Voucher redemptions
CREATE TABLE IF NOT EXISTS voucher_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  table_name text NOT NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE voucher_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_redemptions" ON voucher_redemptions;
CREATE POLICY "admin_select_redemptions" ON voucher_redemptions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_redemptions_voucher ON voucher_redemptions(voucher_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_date ON voucher_redemptions(redeemed_at);

-- Loyalty transactions
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(user_id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  amount integer NOT NULL DEFAULT 0,
  cashback integer NOT NULL DEFAULT 0,
  points_earned integer NOT NULL DEFAULT 0,
  source text NOT NULL,
  table_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "member_select_own_loyalty" ON loyalty_transactions;
CREATE POLICY "member_select_own_loyalty" ON loyalty_transactions FOR SELECT
  TO authenticated USING (auth.uid() = member_id);

DROP POLICY IF EXISTS "admin_select_loyalty" ON loyalty_transactions;
CREATE POLICY "admin_select_loyalty" ON loyalty_transactions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_loyalty_member ON loyalty_transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_order ON loyalty_transactions(order_id);

-- Staff push tokens
CREATE TABLE IF NOT EXISTS staff_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  role text NOT NULL DEFAULT 'staff',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE staff_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_select_own_tokens" ON staff_push_tokens;
CREATE POLICY "user_select_own_tokens" ON staff_push_tokens FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_insert_own_tokens" ON staff_push_tokens;
CREATE POLICY "user_insert_own_tokens" ON staff_push_tokens FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_delete_own_tokens" ON staff_push_tokens;
CREATE POLICY "user_delete_own_tokens" ON staff_push_tokens FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_tokens_user ON staff_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_tokens_role ON staff_push_tokens(role);
