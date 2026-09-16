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