-- 0041: กู้สิทธิ์ service_role บน schema public กลับเป็นค่า default ของ Supabase
--
-- ปัญหา: ตารางที่สร้างผ่าน migration ช่วงหลังไม่ได้ grant ให้ service_role
-- (เหลือแค่ settings ที่แก้ไว้ใน 0034) ทำให้ Edge Functions ที่ใช้ service role
-- โดน "permission denied" — กระทบทั้ง download-font และ render-tester
-- หมายเหตุ: service_role ใช้ฝั่ง server เท่านั้น (Edge Functions) ไม่เปิดให้ client

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- ตารางที่สร้างใหม่ในอนาคตให้ได้สิทธิ์อัตโนมัติ
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
