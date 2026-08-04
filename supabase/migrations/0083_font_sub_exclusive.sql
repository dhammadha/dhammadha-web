-- สถานะฟอนต์ใหม่ "Subscription Exclusive" (4 ส.ค. 2569)
--
-- ต่างจาก `is_subscription` ที่มีอยู่เดิมอย่างไร — จุดที่คนอ่านทีหลังสับสนแน่ ๆ:
--   is_subscription   = "เข้าร่วม pool รายเดือน"  → **ยังขายรายชุดได้ตามปกติ**
--   is_sub_exclusive  = "ขายรายชุดไม่ได้แล้ว"     → ให้บริการเฉพาะสมาชิกเท่านั้น
-- ฟอนต์ exclusive จึงเป็น subset ของ is_subscription ไม่ใช่ค่าที่มาแทนกัน
--
-- ใบเสนอราคา (สิทธิ์องค์กร) **ยังขอได้ตามปกติ** — ราคาใบเสนอราคามาจาก license tier
-- ของนักออกแบบ ไม่ได้อ่าน fonts.price จึงไม่กระทบกับการปิดช่องทางขายรายชุด
--
-- น้ำหนักส่วนแบ่ง +25% ของฟอนต์ประเภทนี้อยู่ใน 0085 (เฉพาะ pool 38% ตามเวลาใช้งาน)

alter table public.fonts
  add column if not exists is_sub_exclusive boolean not null default false;

-- exclusive ต้องอยู่ใน subscription เสมอ ไม่งั้นฟอนต์จะไม่มีช่องทางเข้าถึงเหลือเลย
-- (ขายรายชุดก็ปิด อยู่ในไลบรารีสมาชิกก็ไม่ได้) และต้องไม่ใช่ฟอนต์ฟรี เพราะฟอนต์ฟรี
-- โหลดได้โดยไม่ต้องเป็นสมาชิก ซึ่งขัดกับคำว่า exclusive เอง
alter table public.fonts
  add constraint fonts_sub_exclusive_requires_subscription
  check (not is_sub_exclusive or (is_subscription and not is_free));

comment on column public.fonts.is_sub_exclusive is
  'ไม่จำหน่ายรายชุด ให้บริการเฉพาะสมาชิก subscription (ยังขอใบเสนอราคาได้) · น้ำหนัก 1.25 เท่าใน pool 38%';
