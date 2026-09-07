/*
# Revoke EXECUTE on handle_new_user from PUBLIC

## Overview
PostgreSQL grants EXECUTE on functions to PUBLIC by default. The previous migration
only revoked from anon and authenticated roles, but PUBLIC still grants access.
This revokes from PUBLIC and only grants EXECUTE to the postgres (superuser) role,
which is the role that fires triggers internally.

## Security
- REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC
- The trigger still works because trigger execution uses the function owner's privileges
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
