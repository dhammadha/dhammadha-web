-- Add designer_id FK to fonts table (links font to its designer/owner)
alter table public.fonts
  add column if not exists owner_id uuid references public.users(id) on delete set null;

drop policy if exists "admin full access fonts" on public.fonts;
create policy "admin full access fonts"
  on public.fonts for all
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

drop policy if exists "designer insert own fonts" on public.fonts;
create policy "designer insert own fonts"
  on public.fonts for insert
  with check (
    public.get_my_role() = 'designer'
    and owner_id = auth.uid()
  );

drop policy if exists "designer update own fonts" on public.fonts;
create policy "designer update own fonts"
  on public.fonts for update
  using (
    public.get_my_role() = 'designer'
    and owner_id = auth.uid()
  )
  with check (owner_id = auth.uid());

drop policy if exists "designer delete own fonts" on public.fonts;
create policy "designer delete own fonts"
  on public.fonts for delete
  using (
    public.get_my_role() = 'designer'
    and owner_id = auth.uid()
  );
