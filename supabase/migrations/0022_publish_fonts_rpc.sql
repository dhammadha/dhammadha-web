-- RPC to publish fonts using server-side NOW() so published_at >= updated_at
create or replace function publish_fonts(p_owner_id uuid)
returns void
language sql
security definer
as $$
  update public.fonts
  set published_at = now()
  where owner_id = p_owner_id;
$$;
