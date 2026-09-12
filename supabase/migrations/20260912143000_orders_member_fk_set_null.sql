-- Allow member deletion while preserving order history.
-- Past orders are kept with member_id set to NULL (they appear as guest orders).
ALTER TABLE public.orders DROP CONSTRAINT orders_member_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_member_id_fkey
  FOREIGN KEY (member_id) REFERENCES public.members(user_id) ON DELETE SET NULL;
