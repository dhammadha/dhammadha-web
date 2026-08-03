-- ใช้งานได้ทีละเครื่อง (3 ส.ค. 2569) — รูปแบบเดียวกับ Adobe CC
--
-- เจ้าของเลือกโมเดล: **ลงทะเบียนได้ 2 เครื่อง แต่ activate ได้ทีละเครื่อง**
-- เปิดแอปที่เครื่อง B แล้วฟอนต์บนเครื่อง A ดับ แต่ vault ยังอยู่ครบทั้งสองเครื่อง
-- สลับกลับไปใช้ A จึงไม่ต้องโหลดใหม่ (คือเหตุผลหลักที่ไม่เลือก "1 เครื่องแล้วเตะ")
--
-- **ไม่มีคอลัมน์ "ใครคือเครื่อง active" แยกต่างหากโดยตั้งใจ** — เครื่องที่ `activated_at`
-- ใหม่ที่สุดในบรรดาที่ยังไม่ถูกถอน คือเครื่องที่ถือสิทธิ์ · ธงตัวที่สองมีโอกาสค่าเพี้ยน
-- กันเองเมื่อมีเส้นทางเขียนหลายทาง (บทเรียนเดียวกับที่ `quotes.invoice_no` ถูกออกแบบ
-- ให้เป็นตัวชี้ขาดเดียว ไม่มีธงคู่)
--
-- null = ยังไม่เคยกดใช้งานบนเครื่องนั้น · เครื่องแรกที่เรียก claim_activation ได้สิทธิ์ไป

alter table public.sub_devices add column activated_at timestamptz;

-- ใช้ตอนหาว่าใครถือสิทธิ์อยู่ (order by activated_at desc limit 1 ต่อ user)
create index sub_devices_active_idx
  on public.sub_devices (user_id, activated_at desc)
  where revoked_at is null;

-- ย้อนกลับ:
--   drop index public.sub_devices_active_idx;
--   alter table public.sub_devices drop column activated_at;
