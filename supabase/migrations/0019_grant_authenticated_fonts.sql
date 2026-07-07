-- authenticated role had no table-level privileges on fonts; RLS policies
-- were never evaluated because the GRANT check failed first.
grant select, insert, update, delete on public.fonts to authenticated;
