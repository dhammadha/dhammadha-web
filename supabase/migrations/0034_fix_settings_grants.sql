-- แก้ grant ของตาราง settings ที่ขาดไป
--
-- 0003 grant select ให้แค่ anon / 0030 เพิ่ม RLS policy "admin write settings"
-- แต่ไม่เคย grant ระดับ role → ผลจริงตอนนี้:
--   - user ที่ login (authenticated) SELECT ไม่ได้ → FontDetail ไม่เห็นราคา
--     โปรโมชัน/licensing ทั้งที่ anon เห็น (ราคาโชว์ไม่ตรงกับที่ checkout คิด)
--   - admin บันทึกหน้า /admin/pricing ไม่ได้ (upsert โดน permission denied)
--
-- RLS ยังคุมสิทธิ์เขียนไว้ที่ admin เท่านั้น (policy จาก 0030) — grant นี้แค่
-- เปิดประตูชั้นนอกให้ RLS ได้ทำงาน

grant select on public.settings to authenticated, service_role;
grant insert, update, delete on public.settings to authenticated;
