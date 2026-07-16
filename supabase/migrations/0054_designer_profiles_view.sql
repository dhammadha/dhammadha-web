-- 🔴 ต่อจาก 0051: authenticated (ลูกค้าที่ login แล้ว) ยัง select ได้ทุกคอลัมน์ของ
-- public.users และ policy "public read designer profiles" (using (designer_slug is not null))
-- ใช้กับทุก role ไม่ใช่แค่ anon — ลูกค้าที่ login ยิง ?select=bank,tax_id,address,phone
-- เจาะจงแถว designer คนไหนก็ได้ตราบใดที่มี designer_slug ไม่ null
-- column grant (0051) แก้ไม่ได้เพราะ grant ไม่รู้จัก "แถว" (RLS คุมแถว ไม่คุมคอลัมน์)
--
-- แก้ด้วย view designer_profiles ที่มีแค่คอลัมน์สาธารณะจริง ๆ แทนการเปิด users ทั้งแถว
-- ให้ authenticated/anon อ่านผ่าน view นี้แทน แล้วปิด policy เดิมทิ้ง

-- ── 1. view สาธารณะ — เฉพาะคอลัมน์ที่หน้า storefront ต้องใช้ ──────────────────
-- security_invoker = false (ค่า default ของ view แต่ระบุไว้ชัดเจนกันงงในอนาคต):
-- permission/RLS ของ view จะเช็คจากสิทธิ์ "เจ้าของ view" ไม่ใช่ผู้ query
-- เจ้าของ view คือ role ที่รัน migration (postgres — ยืนยันด้วย pg_get_userbyid
-- บน object อื่นที่มีอยู่แล้วเช่น issue_quote_doc/orders/quotes ก็เป็น postgres เหมือนกัน)
-- postgres เป็นเจ้าของตาราง users ด้วย เลย bypass RLS ของ users ได้ตามปกติ (table owner
-- ไม่ติด RLS เว้นแต่ตั้ง FORCE ROW LEVEL SECURITY ซึ่งเราไม่ได้ตั้ง)
-- ⚠️ ถ้าวันหลังมีคนสร้าง view นี้ใหม่ด้วย role อื่นที่ไม่ใช่ table owner ต้องเช็กพฤติกรรมนี้ใหม่

create view public.designer_profiles
with (security_invoker = false) as
select id, name, business_name, designer_slug, portfolio_url
from public.users
where designer_slug is not null;

alter view public.designer_profiles owner to postgres;

revoke all on public.designer_profiles from public;
grant select on public.designer_profiles to anon, authenticated;

-- ── 2. ปิดรูรั่วที่ users เอง — เอา policy ที่เปิดให้ทุก role อ่านแถว designer ออก ──────
-- เหลือแค่ "users read own" (auth.uid() = id) กับ "admin read all users"
-- แปลว่า authenticated ที่ไม่ใช่เจ้าของแถว/ไม่ใช่ admin จะอ่าน users ไม่ได้อีกต่อไป
-- (ต้องผ่าน designer_profiles แทนสำหรับข้อมูลสาธารณะของ designer)

drop policy if exists "public read designer profiles" on public.users;

-- ── 3. ปิด grant ของ anon บน users ทั้งหมด — ตอนนี้ไม่มี policy ไหนให้ anon อ่านแถวไหนได้
-- อยู่แล้ว (row 0 เสมอ) column grant จาก 0051 เลยไม่มีความหมาย ปิดให้ชัดเจนไปเลย
-- (authenticated ไม่แตะ เพราะยังต้องใช้อ่านแถวตัวเอง/admin อ่านทุกแถวผ่าน RLS ปกติ)

revoke select on public.users from anon;

comment on view public.designer_profiles is
  'ข้อมูล designer สาธารณะ (ไม่มี bank/tax_id/address/phone) — ใช้แทนการ select ตรงจาก users '
  'สำหรับหน้า storefront/quote/build-time static params ทั้งหมด';
