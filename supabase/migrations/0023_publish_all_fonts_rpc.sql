-- Update publish_fonts to publish ALL unpublished fonts (not filtered by owner)
-- Admin publishes on behalf of all designers
create or replace function publish_fonts()
returns void
language sql
security definer
set row_security = off
as $$
  update public.fonts
  set published_at = now()
  where published_at is null;
$$;

grant execute on function publish_fonts() to authenticated;
