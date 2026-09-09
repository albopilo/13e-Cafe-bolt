/*
# Update handle_new_user trigger for birth_month, birth_day, and ktp

## Overview
Updates the existing handle_new_user() trigger function to also populate
birth_month, birth_day, and ktp from the user metadata provided during signup.

## Changes
- handle_new_user() now extracts birth_month and birth_day from the birthdate
  in raw_user_meta_data, and stores ktp if provided.
- Trigger is dropped and recreated (function is replaced in place).
*/

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

-- Re-revoke since replacing the function may re-grant to PUBLIC
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
