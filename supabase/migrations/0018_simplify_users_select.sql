-- Simplify: allow anyone to read any user row.
-- RLS complexity for users SELECT is not worth it at this stage.
drop policy if exists "public read designer profiles" on public.users;
create policy "public read users" on public.users for select using (true);
