/*
# Create members table

## Overview
Creates the `members` table that extends `auth.users` with café loyalty profile data.

## New Table: members
- `user_id` (uuid, PK, FK to auth.users) — links to Supabase Auth account
- `phone` (text, not null) — normalized Indonesian phone number
- `email` (text, not null) — member email
- `name` (text, not null) — display name
- `name_lower` (text, not null) — lowercased name for search
- `birthdate` (date, nullable) — for birthday bonus detection
- `tier` (text, not null, default 'Classic') — loyalty tier: Classic/Bronze/Silver/Gold
- `discount_rate` (numeric, default 0) — discount percentage as decimal (0.10 = 10%)
- `tax_rate` (numeric, default 0.10) — tax rate (10%)
- `redeemable_points` (integer, default 0) — accumulated cashback points in rupiah
- `spending_since_upgrade` (integer, default 0) — total spending since last tier upgrade
- `monthly_since_upgrade` (integer, default 0) — monthly spending since upgrade
- `yearly_since_upgrade` (integer, default 0) — yearly spending since upgrade
- `upgrade_date` (date, nullable) — date of last tier change
- `created_at` (timestamptz, default now)

## Security
- Members can read and update only their own profile
- Admins can read all member profiles
- No direct inserts from client (registration handled via edge function or auth trigger)
*/

CREATE TABLE IF NOT EXISTS members (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text NOT NULL,
  email text NOT NULL,
  name text NOT NULL,
  name_lower text NOT NULL DEFAULT '',
  birthdate date,
  tier text NOT NULL DEFAULT 'Classic',
  discount_rate numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 0.10,
  redeemable_points integer NOT NULL DEFAULT 0,
  spending_since_upgrade integer NOT NULL DEFAULT 0,
  monthly_since_upgrade integer NOT NULL DEFAULT 0,
  yearly_since_upgrade integer NOT NULL DEFAULT 0,
  upgrade_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- Member can read own profile
DROP POLICY IF EXISTS "member_select_own" ON members;
CREATE POLICY "member_select_own" ON members FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- Admin can read all members
DROP POLICY IF EXISTS "admin_select_members" ON members;
CREATE POLICY "admin_select_members" ON members FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

-- Member can update own profile (name, phone, birthdate — NOT tier/points)
DROP POLICY IF EXISTS "member_update_own" ON members;
CREATE POLICY "member_update_own" ON members FOR UPDATE
  TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin can update member profiles (tier adjustments, point resets)
DROP POLICY IF EXISTS "admin_update_members" ON members;
CREATE POLICY "admin_update_members" ON members FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

-- No direct INSERT policy — members are created via edge function (service role)
-- during registration, which bypasses RLS

CREATE INDEX IF NOT EXISTS idx_members_tier ON members(tier);
CREATE INDEX IF NOT EXISTS idx_members_name_lower ON members(name_lower);
CREATE INDEX IF NOT EXISTS idx_members_phone ON members(phone);
