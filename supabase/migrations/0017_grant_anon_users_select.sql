-- Grant SELECT on users to anon so the fonts→users JOIN works for public pages.
-- RLS policy "public read designer profiles" (migration 0016) still limits
-- which rows are visible (only users with designer_slug set).
grant select on public.users to anon;
