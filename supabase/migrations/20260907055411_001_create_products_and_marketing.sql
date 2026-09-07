/*
# Create products and marketing_programs tables

## Overview
Creates the product catalog and marketing (buy-X-get-Y promo) tables for the 13e Café ordering system.

## New Tables

### products
- `id` (uuid, PK, auto-generated)
- `name` (text, not null) — product display name
- `category` (text, not null) — menu category (Special Today, Snacks, Western, etc.)
- `variant_label` (text, default 'Variant') — label shown above variants (e.g. "Size", "Level")
- `variant_names` (text[], default '{}') — array of variant option names
- `pos_sell_price` (integer, default 0) — base selling price in rupiah
- `pos_hidden` (boolean, default false) — hide from customer menu when true
- `photo_1` through `photo_10` (text, nullable) — product photo URLs
- `olsera_id` (text, nullable) — links to Olsera POS product ID for sync
- `created_at` (timestamptz, default now)
- `updated_at` (timestamptz, default now)

### marketing_programs
- `id` (uuid, PK, auto-generated)
- `type` (text, default 'buy_x_get_y') — promo type
- `active` (boolean, default true) — whether the promo is currently running
- `buy_product_ids` (uuid[], default '{}') — products that trigger the promo when purchased
- `free_product_id` (uuid, FK to products) — the free product given
- `free_qty` (integer, default 1) — quantity of free product
- `free_variant` (text, nullable) — specific variant to give free, or null for any

## Security
- products: public read for non-hidden items (anon + authenticated), admin write only
- marketing_programs: public read for active promos (anon + authenticated), admin write only
- Admin access is determined by membership in the `admins` table (checked via RLS subquery)
*/

-- Helper: admins table (needed for RLS checks on all admin-managed tables)
CREATE TABLE IF NOT EXISTS admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_read_own" ON admins;
CREATE POLICY "admins_read_own" ON admins FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  variant_label text NOT NULL DEFAULT 'Variant',
  variant_names text[] NOT NULL DEFAULT '{}',
  pos_sell_price integer NOT NULL DEFAULT 0,
  pos_hidden boolean NOT NULL DEFAULT false,
  photo_1 text,
  photo_2 text,
  photo_3 text,
  photo_4 text,
  photo_5 text,
  photo_6 text,
  photo_7 text,
  photo_8 text,
  photo_9 text,
  photo_10 text,
  olsera_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Public can read non-hidden products; admin can read/write all
DROP POLICY IF EXISTS "public_select_products" ON products;
CREATE POLICY "public_select_products" ON products FOR SELECT
  TO anon, authenticated USING (pos_hidden = false);

DROP POLICY IF EXISTS "admin_select_products" ON products;
CREATE POLICY "admin_select_products" ON products FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "admin_insert_products" ON products;
CREATE POLICY "admin_insert_products" ON products FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "admin_update_products" ON products;
CREATE POLICY "admin_update_products" ON products FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "admin_delete_products" ON products;
CREATE POLICY "admin_delete_products" ON products FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

-- Marketing programs table
CREATE TABLE IF NOT EXISTS marketing_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'buy_x_get_y',
  active boolean NOT NULL DEFAULT true,
  buy_product_ids uuid[] NOT NULL DEFAULT '{}',
  free_product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  free_qty integer NOT NULL DEFAULT 1,
  free_variant text
);

ALTER TABLE marketing_programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_marketing" ON marketing_programs;
CREATE POLICY "public_select_marketing" ON marketing_programs FOR SELECT
  TO anon, authenticated USING (active = true);

DROP POLICY IF EXISTS "admin_select_marketing" ON marketing_programs;
CREATE POLICY "admin_select_marketing" ON marketing_programs FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "admin_insert_marketing" ON marketing_programs;
CREATE POLICY "admin_insert_marketing" ON marketing_programs FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "admin_update_marketing" ON marketing_programs;
CREATE POLICY "admin_update_marketing" ON marketing_programs FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "admin_delete_marketing" ON marketing_programs;
CREATE POLICY "admin_delete_marketing" ON marketing_programs FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_hidden ON products(pos_hidden);
CREATE INDEX IF NOT EXISTS idx_marketing_active ON marketing_programs(active);
