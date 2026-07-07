-- Allow authenticated users to update (overwrite) existing files in all buckets.
-- Without UPDATE policies, upsert: true fails when a file already exists.
create policy "auth update covers"    on storage.objects for update using (bucket_id = 'covers'     and auth.role() = 'authenticated') with check (bucket_id = 'covers'     and auth.role() = 'authenticated');
create policy "auth update previews"  on storage.objects for update using (bucket_id = 'previews'   and auth.role() = 'authenticated') with check (bucket_id = 'previews'   and auth.role() = 'authenticated');
create policy "auth update specimens" on storage.objects for update using (bucket_id = 'specimens'  and auth.role() = 'authenticated') with check (bucket_id = 'specimens'  and auth.role() = 'authenticated');
create policy "auth update demo"      on storage.objects for update using (bucket_id = 'fonts-demo' and auth.role() = 'authenticated') with check (bucket_id = 'fonts-demo' and auth.role() = 'authenticated');
create policy "auth update free"      on storage.objects for update using (bucket_id = 'fonts-free' and auth.role() = 'authenticated') with check (bucket_id = 'fonts-free' and auth.role() = 'authenticated');
create policy "auth update full"      on storage.objects for update using (bucket_id = 'fonts-full' and auth.role() = 'authenticated') with check (bucket_id = 'fonts-full' and auth.role() = 'authenticated');
