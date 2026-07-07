-- Allow public (anon + authenticated) to read designer profile info
-- from users who have a designer_slug set. Without this, the FK join
-- fonts → users fails for unauthenticated visitors, making font queries return empty.
-- PostgREST only returns requested columns (designer_slug, business_name),
-- so email/role are not exposed in normal app queries.
create policy "public read designer profiles" on public.users for select
  using (designer_slug is not null and designer_slug != '');
