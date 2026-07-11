-- 0042: ให้ผู้ใช้ที่ล็อกอิน (authenticated) ขอ/ลบใบเสนอราคาได้
--
-- ปัญหา:
--  1) ขอใบเสนอราคาไม่ได้เมื่อ login ค้าง — quotes ให้ INSERT เฉพาะ anon (0003)
--     ส่วน authenticated ได้แค่ SELECT (0026) → admin/designer ที่ login อยู่โดน
--     "permission denied for table quotes" ก่อนถึง RLS (RLS insert = with check(true) อยู่แล้ว)
--  2) ลบใบเสนอราคาไม่ได้ — ไม่เคย grant DELETE ให้ authenticated (แม้ admin ก็ติด)
--     และไม่มี DELETE policy สำหรับ designer เจ้าของ quote
--
-- แก้: grant INSERT/DELETE ให้ authenticated + policy ให้ designer ลบ quote ตัวเองได้
-- (admin ลบได้อยู่แล้วผ่าน policy "admin full access quotes" ใน 0007)

grant insert on public.quotes to authenticated;
grant delete on public.quotes to authenticated;

drop policy if exists "designer delete own quotes" on public.quotes;
create policy "designer delete own quotes"
  on public.quotes for delete
  using (designer_id = auth.uid());
