-- Grant read access to anon role (public visitors)
grant select on public.fonts to anon;
grant select on public.settings to anon;

-- Grant insert for quote requests (no auth needed)
grant insert on public.quotes to anon;
