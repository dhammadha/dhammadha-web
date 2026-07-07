-- Fix get_my_role() to bypass RLS when reading the users table.
-- Without row_security = off, the "admin read all users" policy calls get_my_role()
-- which queries users, which re-evaluates that same policy → infinite recursion.
create or replace function public.get_my_role()
returns public.user_role language sql security definer stable
set search_path = public
set row_security = off
as $$
  select role from public.users where id = auth.uid();
$$;

grant execute on function public.get_my_role() to authenticated;
