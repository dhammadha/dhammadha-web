-- แก้ข้อบกพร่องใน 0052: designer ล็อกตัวเองออกจากฟอนต์ที่ยังทำไม่เสร็จ
--
-- อาการ: designer อัป cover ของฟอนต์ใหม่ → "new row violates row-level security
-- policy (USING expression) for table objects" (postgres log ยืนยันว่าเป็น USING
-- ไม่ใช่ WITH CHECK = เข้า path UPDATE ไม่ใช่ INSERT)
--
-- กลไก: uploadFile ใช้ upsert:true → Postgres ทำ INSERT ... ON CONFLICT DO UPDATE
-- ถ้าไฟล์ path นั้นมีอยู่แล้วจะเข้า path UPDATE ซึ่ง 0052 ตั้งเงื่อนไขเป็น
-- owns_font_slug() = "ต้องมีแถวใน fonts ที่ slug นี้และเป็นของเรา"
-- แต่ FontForm อัปไฟล์ "ก่อน" insert แถว fonts (FontForm.tsx:272 → :374)
-- → ฟอนต์ใหม่ยังไม่มีแถว → owns_font_slug = false → บล็อก
--
-- 0052 คิดเรื่องนี้ไว้แล้วตอน INSERT (can_write_font_slug = "โฟลเดอร์ว่างหรือของเรา")
-- แต่ลืมว่า UPDATE เจอสถานการณ์เดียวกัน — และเกิดซ้ำได้เรื่อย ๆ ทุกครั้งที่มีไฟล์ค้าง
-- จากการอัปที่ไม่จบ (กดยกเลิก/เน็ตหลุด/ปิดแท็บ) หรือแค่เลือกรูปผิดแล้วเลือกใหม่
-- ชื่อไฟล์เดิมในรอบเดียวกัน → designer ล็อกตัวเองออกจาก slug นั้นถาวร
--
-- แก้: UPDATE ใช้กติกาเดียวกับ INSERT (can_write_font_slug)
-- ยังกันคนอื่นมาทับฟอนต์ที่มีเจ้าของแล้วเหมือนเดิม ซึ่งเป็นแก่นของช่องโหว่ที่ 0052 ปิด
-- (ทดสอบแล้ว: pompuai เขียนทับโฟลเดอร์ test-01 ของ dhammadha ไม่ได้)
-- ส่วน DELETE ยังใช้ owns_font_slug เหมือนเดิม — การลบต้องเป็นเจ้าของจริงเท่านั้น
-- ไฟล์ซากของ slug ที่ไม่มีเจ้าของให้ admin เป็นคนล้าง

drop policy if exists "designer update own font assets" on storage.objects;

create policy "designer update own font assets" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('covers','previews','specimens','fonts-demo','fonts-free','fonts-full')
    and public.can_write_font_slug(name)
  )
  with check (
    bucket_id in ('covers','previews','specimens','fonts-demo','fonts-free','fonts-full')
    and public.can_write_font_slug(name)
  );
