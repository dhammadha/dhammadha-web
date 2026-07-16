-- ลบ publish_fonts() ทั้ง 2 overload — เป็นช่องโหว่ privilege escalation
--
-- ปัญหา: ทั้งคู่เป็น security definer + ไม่มีเช็ค role ข้างใน + publish_fonts()
-- ยัง set row_security = off ด้วย และสิทธิ์ execute ตกถึง PUBLIC (ครอบ anon)
-- → ใครก็ได้ที่หยิบ anon key จาก JS bundle (ซึ่งเป็นของสาธารณะโดยการออกแบบ)
-- ยิง supabase.rpc("publish_fonts") ได้ทันทีโดยไม่ต้อง login แล้วฟอนต์ที่ยัง
-- ไม่ผ่านการตรวจทุกตัวในระบบจะขึ้นเว็บ
--
-- ที่มาของ PUBLIC grant: Postgres grant execute ให้ PUBLIC อัตโนมัติทุกครั้งที่
-- create function — 0022/0023 เขียนแค่ `grant ... to authenticated` เพิ่ม
-- แต่ไม่เคย revoke ตัว default ทิ้ง (บทเรียน: ฟังก์ชัน security definer ใหม่
-- ต้อง `revoke execute ... from public` เสมอ)
--
-- ทำไมลบทิ้งได้เลย: แอปไม่เรียกแล้ว — publish ตอนนี้ทำผ่าน /admin/font-review
-- ที่ update ตาราง fonts ทีละตัวภายใต้ RLS ปกติ (admin ตรวจก่อน publish ทีละตัว)
-- ซึ่งเป็น flow ที่ต้องการอยู่แล้ว ไม่มีใครควร publish รวดเดียวทุกตัวได้อีก

drop function if exists public.publish_fonts();
drop function if exists public.publish_fonts(uuid);
