-- Add document fields to quotes table
alter table public.quotes
  add column if not exists quote_no text,
  add column if not exists receipt_no text,
  add column if not exists quote_issued_at timestamptz,
  add column if not exists receipt_issued_at timestamptz,
  add column if not exists total_amount numeric,
  add column if not exists fonts_detail jsonb,
  add column if not exists issued_by uuid references public.users(id) on delete set null;

-- Admin can read/update/delete all quotes
create policy "admin full access quotes"
  on public.quotes for all
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

-- Storage buckets
insert into storage.buckets (id, name, public, file_size_limit) values
  ('covers',     'covers',     true,  5242880),
  ('previews',   'previews',   true,  5242880),
  ('specimens',  'specimens',  true,  10485760),
  ('fonts-demo', 'fonts-demo', true,  52428800),
  ('fonts-free', 'fonts-free', true,  52428800),
  ('fonts-full', 'fonts-full', false, 52428800)
on conflict (id) do nothing;

-- Storage RLS: authenticated users can upload/delete
create policy "auth upload covers"    on storage.objects for insert with check (bucket_id = 'covers'     and auth.role() = 'authenticated');
create policy "auth delete covers"    on storage.objects for delete using  (bucket_id = 'covers'     and auth.role() = 'authenticated');
create policy "auth upload previews"  on storage.objects for insert with check (bucket_id = 'previews'   and auth.role() = 'authenticated');
create policy "auth delete previews"  on storage.objects for delete using  (bucket_id = 'previews'   and auth.role() = 'authenticated');
create policy "auth upload specimens" on storage.objects for insert with check (bucket_id = 'specimens'  and auth.role() = 'authenticated');
create policy "auth delete specimens" on storage.objects for delete using  (bucket_id = 'specimens'  and auth.role() = 'authenticated');
create policy "auth upload demo"      on storage.objects for insert with check (bucket_id = 'fonts-demo' and auth.role() = 'authenticated');
create policy "auth delete demo"      on storage.objects for delete using  (bucket_id = 'fonts-demo' and auth.role() = 'authenticated');
create policy "auth upload free"      on storage.objects for insert with check (bucket_id = 'fonts-free' and auth.role() = 'authenticated');
create policy "auth delete free"      on storage.objects for delete using  (bucket_id = 'fonts-free' and auth.role() = 'authenticated');
create policy "auth upload full"      on storage.objects for insert with check (bucket_id = 'fonts-full' and auth.role() = 'authenticated');
create policy "auth delete full"      on storage.objects for delete using  (bucket_id = 'fonts-full' and auth.role() = 'authenticated');

-- Public read for public buckets
create policy "public read covers"    on storage.objects for select using (bucket_id = 'covers');
create policy "public read previews"  on storage.objects for select using (bucket_id = 'previews');
create policy "public read specimens" on storage.objects for select using (bucket_id = 'specimens');
create policy "public read demo"      on storage.objects for select using (bucket_id = 'fonts-demo');
create policy "public read free"      on storage.objects for select using (bucket_id = 'fonts-free');

-- fonts-full: only authenticated (signed URL enforced in app layer)
create policy "auth read full" on storage.objects for select using (bucket_id = 'fonts-full' and auth.role() = 'authenticated');
