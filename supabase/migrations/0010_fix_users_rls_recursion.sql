-- Fix infinite recursion in users RLS policies.
-- The old admin policies did: SELECT 1 FROM public.users WHERE role='admin'
-- which re-enters the same RLS check → infinite loop.
-- Use get_my_role() (SECURITY DEFINER, bypasses RLS) instead.

drop policy if exists "admin read all users" on public.users;
create policy "admin read all users"
  on public.users for select
  using (public.get_my_role() = 'admin');

drop policy if exists "admin update all users" on public.users;
create policy "admin update all users"
  on public.users for update
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');
