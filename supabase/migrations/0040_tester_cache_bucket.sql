-- 0040: bucket "tester-cache" — เก็บรูป PNG ที่ render จาก type tester
-- (Edge Function render-tester เขียนด้วย service role, ทุกคนอ่านได้ผ่าน CDN)

insert into storage.buckets (id, name, public, file_size_limit)
values ('tester-cache', 'tester-cache', true, 2097152) -- 2 MB ต่อรูป
on conflict (id) do nothing;

-- อ่านได้สาธารณะ; ไม่มี policy insert/update → เขียนได้เฉพาะ service role (ข้าม RLS)
drop policy if exists "tester-cache public read" on storage.objects;
create policy "tester-cache public read" on storage.objects
  for select using (bucket_id = 'tester-cache');
