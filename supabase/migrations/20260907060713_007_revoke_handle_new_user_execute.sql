/*
# Revoke EXECUTE on handle_new_user from anon and authenticated

## Overview
The handle_new_user() trigger function is SECURITY DEFINER and was callable by anon/authenticated
roles via the REST API. This is a trigger function that should only fire internally on auth.users
INSERT. Revoke EXECUTE to prevent direct invocation.

## Security
- REVOKE EXECUTE on public.handle_new_user FROM anon, authenticated
- The trigger still works because triggers run with the function's privileges, not the caller's
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
