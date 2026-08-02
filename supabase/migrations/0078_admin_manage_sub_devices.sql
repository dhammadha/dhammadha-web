-- admin ถอนการลงทะเบียนอุปกรณ์ได้จากหน้าเว็บ (3 ส.ค. 2569)
--
-- `0077` ให้ admin ไว้แค่ `for select` ซึ่งพอสำหรับ "ดู" แต่ไม่พอสำหรับ
-- **การตอบสนองต่อการใช้ผิดเงื่อนไข** ซึ่งเป็นเหตุผลหลักที่ทำทะเบียนอุปกรณ์ตั้งแต่แรก —
-- ระบบกันการคัดลอกแบบสมบูรณ์ไม่ได้ (เจ้าของเครื่องงัด key จาก keychain ได้เสมอ)
-- สิ่งที่ต้องมีจริงจึงเป็น "เห็น + ตัดสิทธิ์เป็นรายเครื่องได้"
--
-- ทำเป็น policy `for all` แบบเดียวกับ `admin all subscriptions` (0046)
-- เพื่อให้หน้า admin เขียนตรงใต้ RLS ได้ ไม่ต้องมี RPC เพิ่ม
--
-- ⚠️ **ไม่แตะ `sub_device_keys`** — ตารางนั้นยังไม่มี policy ใด ๆ ต่อไป
-- คือ service_role (Edge Function) เท่านั้นที่แตะได้ · admin ไม่ควรอ่าน key ได้
-- เพราะถ้าอ่านได้ผ่านหน้าเว็บ key จะไปโผล่ในเบราว์เซอร์ทันที
--
-- ย้อนกลับ: drop policy "admin manage sub devices" on public.sub_devices;

create policy "admin manage sub devices"
  on public.sub_devices for all
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');
