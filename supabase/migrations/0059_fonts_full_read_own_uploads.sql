-- แก้ต่อจาก 0058: designer อัปไฟล์ฟอนต์เต็มของฟอนต์ใหม่ไม่ได้
-- "[Full font upload] new row violates row-level security policy"
--
-- อาการแปลก: INSERT ธรรมดาเข้า fonts-full ผ่าน แต่ INSERT ... ON CONFLICT DO UPDATE
-- (= upsert:true ที่ uploadProtectedFile ใช้) ถูกบล็อก — ทั้งที่ยังไม่มีไฟล์ให้ conflict เลย
--
-- สาเหตุ: Postgres ประเมิน SELECT policy กับ "แถวที่กำลังจะ insert" เมื่อคำสั่งมี
-- ON CONFLICT DO UPDATE (ต้องมองเห็นแถวถึงจะรู้ว่าชนหรือไม่) แม้จะไม่มี conflict จริง
--   - admin ผ่านเพราะ get_my_role()='admin' เป็นจริงโดยไม่ขึ้นกับแถว
--   - designer ไม่ผ่านเพราะ owns_font_slug() = false (ฟอนต์ใหม่ยังไม่มีแถวใน fonts)
--   - bucket อื่น (covers/previews/...) ไม่เจอปัญหาเพราะมี policy public read ครอบอยู่
--     fonts-full เป็น private bucket เดียวที่ SELECT ถูกจำกัด เลยโผล่ที่นี่ที่เดียว
--
-- แก้: ให้เห็นไฟล์ที่ "ตัวเองเป็นคนอัป" ด้วย (owner_id = auth.uid())
-- ปลอดภัย: จะอัปไฟล์เข้าโฟลเดอร์ไหนได้ต้องผ่าน can_write_font_slug (INSERT policy) อยู่แล้ว
-- = โฟลเดอร์ว่างหรือของตัวเองเท่านั้น จึงเป็นไปไม่ได้ที่จะมี owner_id ของเราอยู่ใน
-- โฟลเดอร์ฟอนต์ของคนอื่น — และ designer ยังอ่านไฟล์ฟอนต์เต็มของคนอื่นไม่ได้เหมือนเดิม

drop policy if exists "owner or admin read full" on storage.objects;

create policy "owner or admin read full" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'fonts-full'
    and (
      public.get_my_role() = 'admin'::user_role
      or public.owns_font_slug(name)
      or owner_id = auth.uid()::text  -- storage.objects.owner_id เป็น text ต้อง cast
    )
  );
