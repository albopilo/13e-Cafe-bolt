/*
# Create room_tables table for QR code management

## Purpose
Stores room/table definitions (e.g. "Mille 1", "Mille 2", "Mille 3") so admins can
manage rooms from the admin panel and generate QR codes for each room. Each room
has a delivery fee and a QRIS-only flag that the frontend reads to configure the
ordering experience when a guest scans that room's QR code.

## New Tables
- `room_tables`
  - `id` (uuid, primary key)
  - `name` (text, unique, not null) — the room name shown in QR codes and used as the `?table=` URL parameter
  - `display_name` (text, not null) — optional pretty label for printouts (defaults to name)
  - `delivery_fee` (integer, default 0) — delivery fee in Rupiah for orders from this room
  - `qris_only` (boolean, default false) — if true, only QRIS payment is accepted for this room
  - `sort_order` (integer, default 0) — controls display ordering in the admin panel
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

## Security
- RLS enabled on `room_tables`.
- SELECT: anyone (anon + authenticated) can read room definitions — guests need this to see delivery fees and payment options when they land on the menu.
- INSERT/UPDATE/DELETE: admin-only (must exist in the `admins` table).

## Seed Data
- Mille 1 (delivery_fee=10000, qris_only=true)
- Mille 2 (delivery_fee=0, qris_only=true)
- Mille 3 (delivery_fee=12000, qris_only=true)

## Notes
- The existing hardcoded values in `src/lib/categories.ts` (QRIS_ONLY_LOCATIONS and DELIVERY_FEES) will continue to work as fallbacks; the frontend will prefer database values when available.
*/

CREATE TABLE IF NOT EXISTS room_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  display_name text NOT NULL,
  delivery_fee integer NOT NULL DEFAULT 0,
  qris_only boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE room_tables ENABLE ROW LEVEL SECURITY;

-- Anyone can read room definitions (guests need delivery fees + QRIS-only flags)
DROP POLICY IF EXISTS "anon_read_room_tables" ON room_tables;
CREATE POLICY "anon_read_room_tables"
  ON room_tables FOR SELECT
  TO anon, authenticated USING (true);

-- Only admins can insert
DROP POLICY IF EXISTS "admin_insert_room_tables" ON room_tables;
CREATE POLICY "admin_insert_room_tables"
  ON room_tables FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

-- Only admins can update
DROP POLICY IF EXISTS "admin_update_room_tables" ON room_tables;
CREATE POLICY "admin_update_room_tables"
  ON room_tables FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

-- Only admins can delete
DROP POLICY IF EXISTS "admin_delete_room_tables" ON room_tables;
CREATE POLICY "admin_delete_room_tables"
  ON room_tables FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

-- Seed existing rooms
INSERT INTO room_tables (name, display_name, delivery_fee, qris_only, sort_order)
VALUES
  ('Mille 1', 'Mille 1', 10000, true, 1),
  ('Mille 2', 'Mille 2', 0, true, 2),
  ('Mille 3', 'Mille 3', 12000, true, 3)
ON CONFLICT (name) DO NOTHING;
