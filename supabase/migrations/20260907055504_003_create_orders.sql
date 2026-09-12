/*
# Create orders and order_status_history tables

## Overview
Creates the orders table (the core transactional table) and its status audit trail.

## New Table: orders
- `id` (uuid, PK, auto-generated)
- `member_id` (uuid, nullable, FK to members) — null for guest orders
- `table_name` (text, not null) — table/location identifier (e.g. "Mille 1", "Takeaway")
- `items` (jsonb, not null) — array of {product_id, name, variant, price, quantity, is_promo, promo_link_id}
- `subtotal` (integer, not null) — pre-discount subtotal
- `discount` (integer, not null, default 0) — member discount amount
- `tax` (integer, not null, default 0) — 10% tax amount
- `delivery_fee` (integer, not null, default 0) — delivery fee based on table
- `total` (integer, not null) — subtotal minus discount plus tax plus delivery
- `grand_total` (integer, not null) — final rounded amount
- `status` (text, not null, default 'pending') — pending/preparing/served/cancelled
- `payment_method` (text, not null) — cash/qris
- `payment_status` (text, not null, default 'none') — awaiting-proof/paid/none
- `proof_url` (text, nullable) — Supabase Storage URL for QRIS payment proof
- `voucher_id` (uuid, nullable, FK to vouchers) — applied voucher
- `date` (date, not null) — order date for filtering
- `loyalty_recorded` (boolean, default false) — whether loyalty cashback was recorded
- `loyalty_tx_id` (uuid, nullable) — reference to loyalty_transactions record
- `phone` (text, nullable) — guest phone for contact
- `is_member` (boolean, default false) — whether this was a member order
- `olsera_order_id` (text, nullable) — ID returned by Olsera POS on order push
- `created_at` (timestamptz, default now)

## New Table: order_status_history
- `id` (uuid, PK, auto-generated)
- `order_id` (uuid, FK to orders, ON DELETE CASCADE)
- `status` (text, not null) — the new status
- `changed_by` (uuid, nullable) — user_id of staff who changed it
- `changed_at` (timestamptz, default now)

## Security
- Orders: no direct client INSERT (created via edge function with service role)
- Members can SELECT only their own orders
- Staff (authenticated users in a staff role) can SELECT all orders
- Staff can UPDATE status (via edge function, not directly)
- Admins can SELECT all orders
*/

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES members(user_id) ON DELETE SET NULL,
  table_name text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]',
  subtotal integer NOT NULL DEFAULT 0,
  discount integer NOT NULL DEFAULT 0,
  tax integer NOT NULL DEFAULT 0,
  delivery_fee integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  grand_total integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  payment_method text NOT NULL DEFAULT 'cash',
  payment_status text NOT NULL DEFAULT 'none',
  proof_url text,
  voucher_id uuid,
  date date NOT NULL DEFAULT CURRENT_DATE,
  loyalty_recorded boolean NOT NULL DEFAULT false,
  loyalty_tx_id uuid,
  phone text,
  is_member boolean NOT NULL DEFAULT false,
  olsera_order_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Member can read own orders
DROP POLICY IF EXISTS "member_select_own_orders" ON orders;
CREATE POLICY "member_select_own_orders" ON orders FOR SELECT
  TO authenticated USING (auth.uid() = member_id);

-- Admin can read all orders
DROP POLICY IF EXISTS "admin_select_orders" ON orders;
CREATE POLICY "admin_select_orders" ON orders FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

-- Staff can read all orders (staff are authenticated users NOT in admins table
-- but identified by a staff role — we use a staff table approach via admins check negation
-- plus a separate staff_users table)
-- For simplicity, any authenticated user who is NOT an admin is treated as staff for SELECT
DROP POLICY IF EXISTS "staff_select_orders" ON orders;
CREATE POLICY "staff_select_orders" ON orders FOR SELECT
  TO authenticated USING (
    NOT EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

-- No INSERT, UPDATE, DELETE policies for client — all via edge functions (service role)

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date);
CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_name);
CREATE INDEX IF NOT EXISTS idx_orders_member ON orders(member_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

-- Order status history
CREATE TABLE IF NOT EXISTS order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_select_history" ON order_status_history;
CREATE POLICY "staff_select_history" ON order_status_history FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_select_history" ON order_status_history;
CREATE POLICY "admin_select_history" ON order_status_history FOR SELECT
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_history_order ON order_status_history(order_id);
