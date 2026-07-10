-- 1. Admin write policy for settings table
create policy "admin write settings"
  on public.settings
  for all
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

-- 2. license-pdf storage bucket for designer license PDF uploads
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('license-pdf', 'license-pdf', true, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy "auth upload license pdf"
  on storage.objects for insert
  with check (bucket_id = 'license-pdf' and auth.role() = 'authenticated');

create policy "auth update license pdf"
  on storage.objects for update
  using (bucket_id = 'license-pdf' and auth.role() = 'authenticated')
  with check (bucket_id = 'license-pdf' and auth.role() = 'authenticated');

create policy "auth delete license pdf"
  on storage.objects for delete
  using (bucket_id = 'license-pdf' and auth.role() = 'authenticated');

create policy "public read license pdf"
  on storage.objects for select
  using (bucket_id = 'license-pdf');
