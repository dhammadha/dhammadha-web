-- 🔴 ปิดรูรั่ว PII: anon อ่านตาราง users ได้ทั้งตาราง รวมบัญชีธนาคาร/เลขผู้เสียภาษี/ที่อยู่/เบอร์โทร
--
-- ยืนยันบน DB จริงด้วย `set local role anon; select ... from users;` → คืน 4 แถว
-- เห็น email 4, phone 2, address 2, tax_id 2, bank 2 (รวมของ admin เอง)
--
-- ต้นเหตุ: 0018_simplify_users_select.sql ตั้ง policy เป็น `using (true)` โดยคอมเมนต์ว่า
-- "PostgREST คืนเฉพาะคอลัมน์ที่ขอ เลยไม่เปิดเผย email/role" — ผิด เพราะ RLS คุมได้แค่ "แถว"
-- ไม่ได้คุม "คอลัมน์" ใครยิง ?select=bank,tax_id ก็ได้หมด (0017 grant select ทั้งตารางให้ anon)
--
-- Supabase advisor ไม่เตือน เพราะกฎ rls_policy_always_true ข้าม SELECT policy ที่เป็น USING(true)
-- โดยถือว่าตั้งใจเปิด public — อย่าเชื่อ advisor อย่างเดียว
--
-- แก้ 2 ชั้น:
--   1. ชั้นแถว — เห็นเฉพาะแถว designer (มี designer_slug) ลูกค้าหายไปจากสายตา anon เลย
--      (users read own / admin read all users ยังอยู่ → เจ้าตัวและ admin อ่านได้เหมือนเดิม)
--   2. ชั้นคอลัมน์ — anon ได้เฉพาะคอลัมน์ที่หน้า storefront ต้องใช้จริง
--      ตรวจแล้วหน้าสาธารณะใช้แค่: DesignerDetail (id, business_name, name),
--      designer/[designer]/page + fonts/[designer]/[slug]/page (designer_slug ตอน build),
--      quote/page (id, business_name ?? name — ส่วน email/phone ที่ select มาไม่เคยถูกใช้เลย)
--
-- ⚠️ ยังเหลือ: authenticated ยัง select ได้ทุกคอลัมน์ + เห็นแถว designer → ลูกค้าที่ login
-- อ่าน bank ของ designer ได้อยู่ ต้องแก้ด้วย view designer_profiles + แก้โค้ด 4 จุด (งานถัดไป)
-- column grant กับ row policy รวมกันไม่ได้ เพราะ grant ไม่รู้จัก "แถว"

drop policy if exists "public read users" on public.users;

create policy "public read designer profiles" on public.users
  for select using (designer_slug is not null);

revoke select on public.users from anon;
grant select (id, name, business_name, designer_slug) on public.users to anon;
