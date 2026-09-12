/*
# Create handle_new_user trigger function

## Overview
When a user signs up via Supabase Auth, automatically create a row in the `members` table
with default loyalty values. This ensures every registered user has a loyalty profile.

## New Function: handle_new_user()
- Trigger function that fires AFTER INSERT on auth.users
- Inserts a row into `members` with user_id, email, and default tier 'Classic'
- Uses name and phone from raw_user_meta_data if provided during signup
- SECURITY DEFINER so it can write to the members table (which has no INSERT policy for clients)

## Trigger: on_auth_user_created
- AFTER INSERT on auth.users
- FOR EACH ROW
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.members (user_id, email, name, name_lower, phone, birthdate, tier, discount_rate, tax_rate)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'New Member'),
    LOWER(COALESCE(NEW.raw_user_meta_data->>'name', 'new member')),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    NULLIF(NEW.raw_user_meta_data->>'birthdate', '')::date,
    'Classic',
    0,
    0.10
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
