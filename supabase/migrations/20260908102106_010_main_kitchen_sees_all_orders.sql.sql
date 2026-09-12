/*
# Main Kitchen staff can see all orders

1. Security Changes
   - Drop the existing `staff_select_orders` SELECT policy on `orders`.
   - Recreate it so that staff assigned to `Main Kitchen` can read ALL orders,
     while staff assigned to other locations (Mille 1, Mille 2, Mille 3)
     continue to only see orders whose `table_name` starts with their assigned location.
   - This ensures Main Kitchen receives every order regardless of which table placed it.
*/

DROP POLICY IF EXISTS "staff_select_orders" ON orders;

CREATE POLICY "staff_select_orders"
ON orders FOR SELECT
TO authenticated
USING (
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
