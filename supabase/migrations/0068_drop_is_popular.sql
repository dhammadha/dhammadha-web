-- 0068: ลบคอลัมน์ is_popular ออกจาก fonts
-- เป็น dead column — ไม่มีโค้ด/ฟีเจอร์ใดใช้จริง (เกณฑ์ฟอนต์แนะนำใหม่ใช้ tag/category + สุ่ม
-- ฝั่ง client ไม่พึ่ง is_popular) เจ้าของยืนยันเลิกใช้ 24 ก.ค. 2026

alter table public.fonts drop column if exists is_popular;
