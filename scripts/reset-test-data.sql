-- ─────────────────────────────────────────────────────────────────────────────
-- ล้างข้อมูลทดสอบก่อนเปิดขายจริง (project.md งานที่เหลือ ข้อ 3b)
--
-- 🔴 ห้ามรันจนกว่าจะ **ทดสอบ Stripe ขั้นที่ 3 (live key) เสร็จ** — การทดสอบทุกครั้ง
--    สร้าง order ทดสอบเพิ่ม ถ้ารันก่อนก็ต้องกลับมารันใหม่อยู่ดี
-- 🔴 backup ก่อนรันเสมอ (Supabase → Database → Backups) — ทุกคำสั่งนี้กู้คืนเองไม่ได้
-- 🔴 รัน **ทีละส่วน** ตามลำดับ 1 → 2 → 3 → 4 → 5 เท่านั้น
--
-- ⚠️ กับดักที่ทำให้ลำดับสลับไม่ได้:
--    `order_items.font_id → fonts` เป็น **ON DELETE RESTRICT** (FK ตัวเดียวในระบบ
--    ที่ไม่ใช่ CASCADE) → ลบฟอนต์ทดสอบก่อนล้าง order จะ error ทันที
--    ที่เหลือ (entitlements / download_logs / order_items / favourites /
--    font_events / font_files_private / stream_days) เป็น CASCADE ลบตามให้เอง
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- ส่วนที่ 1 — นับก่อนลบ (อ่านอย่างเดียว รันดูได้ปลอดภัย)
-- เก็บผลไว้เทียบกับส่วนที่ 5 ตอนจบ
-- ═════════════════════════════════════════════════════════════════════════════

select 'orders (ทั้งหมด)'        as label, count(*) from orders
union all select 'orders (ที่จะลบ)',  count(*) from orders
  where order_no like 'ORTEST%' or provider_session_id like 'cs_test_%'
union all select 'order_items',        count(*) from order_items
union all select 'entitlements',       count(*) from entitlements
union all select 'download_logs',      count(*) from download_logs
union all select 'fonts (ทั้งหมด)',    count(*) from fonts
union all select 'fonts (test-*)',     count(*) from fonts where slug like 'test-%'
union all select 'quotes',             count(*) from quotes
union all select 'payouts',            count(*) from payouts
union all select 'font_events',        count(*) from font_events;

-- ดูรายตัวว่าจะลบ order ไหนบ้าง — ตรวจด้วยตาก่อนว่าไม่มีใบของลูกค้าจริงหลุดเข้ามา
select order_no, customer_email, total_amount, status, provider_session_id, created_at
from orders
where order_no like 'ORTEST%' or provider_session_id like 'cs_test_%'
order by created_at;


-- ═════════════════════════════════════════════════════════════════════════════
-- ส่วนที่ 2 — ลบ order ทดสอบ (ต้องทำก่อนลบฟอนต์ เพราะ RESTRICT)
--
-- เกณฑ์สองอันครอบคลุมทั้งสองแบบที่มีอยู่จริง:
--   · `ORTEST-*`      = แถว seed ที่ใส่มือ (provider_session_id เป็น 'seed-test-*')
--   · `cs_test_*`     = ใบที่เกิดจากการจ่ายจริงด้วย Stripe **test key**
-- ⚠️ ชื่อคอลัมน์คือ `provider_session_id` (ไม่ใช่ `stripe_session_id`)
-- ⚠️ ใบของ live key ขึ้นต้น `cs_live_*` → เกณฑ์นี้ **ไม่แตะ** โดยตั้งใจ
--
-- CASCADE จะลบตามให้: order_items → entitlements → download_logs
-- ═════════════════════════════════════════════════════════════════════════════

delete from orders
where order_no like 'ORTEST%' or provider_session_id like 'cs_test_%';


-- ═════════════════════════════════════════════════════════════════════════════
-- ส่วนที่ 3 — ลบฟอนต์ทดสอบที่ยังเหลือ
-- (ตัวที่ไม่มี order อ้างถึงลบไปแล้วผ่าน /admin/font-review · ตัวที่ติด RESTRICT
--  เช่น `test-02` ลบได้ตรงนี้เพราะส่วนที่ 2 เคลียร์ order_items ไปแล้ว)
--
-- ⚠️ ไม่ล้างไฟล์ใน Supabase Storage — ไฟล์ฟอนต์/cover จะค้างเป็น orphan
--    (ปุ่มลบใน /admin/font-review ก็ทำแค่ลบแถวเหมือนกัน) ถ้าจะเก็บกวาดต้องลบจาก
--    Storage UI เอง โดย **จดพาธไว้ก่อนรัน delete** เพราะแถวหายแล้วตามไม่ได้อีก
-- ═════════════════════════════════════════════════════════════════════════════

-- จดพาธไฟล์ไว้ก่อน เผื่ออยากไปลบใน Storage ตามทีหลัง
--   · ไฟล์ฟอนต์เต็ม อยู่ที่ font_files_private.full_font_files (array)
--   · cover / preview / demo / free / obfuscated / specimen อยู่บนแถว fonts เอง
select f.slug, ffp.full_font_files
from fonts f
join font_files_private ffp on ffp.font_id = f.id
where f.slug like 'test-%';

select * from fonts where slug like 'test-%';

delete from fonts where slug like 'test-%';


-- ═════════════════════════════════════════════════════════════════════════════
-- ส่วนที่ 4 — รีเซ็ตเลขที่เอกสาร ให้ใบจริงใบแรกเริ่มที่ 0001
--
-- prefix ที่ใช้อยู่: OR = คำสั่งซื้อ · QT = ใบเสนอราคา · RC = ใบเสร็จ
-- (ถ้าเพิ่ม prefix ใหม่ทีหลัง เช่น IV/PO ต้องมาเติมในนี้ด้วย)
--
-- ⚠️ ทำหลังส่วนที่ 2 เท่านั้น และเฉพาะเมื่อ**ลบ order/quote ทดสอบหมดแล้วจริง ๆ**
--    ถ้ายังเหลือใบเก่าอยู่ เลขจะชนกัน (order_no เป็น unique)
-- ⚠️ `year` เป็น พ.ศ. — ปีถัดไปตัวนับสร้างแถวใหม่เอง ไม่ต้องแตะ
-- ═════════════════════════════════════════════════════════════════════════════

-- ทางเลือก ก: ลบแถวตัวนับทิ้ง — next_doc_no() จะสร้างใหม่เริ่มที่ 1 เอง
-- delete from doc_counters where prefix in ('OR','QT','RC');

-- ทางเลือก ข: เซ็ตกลับเป็น 0 (เก็บแถวไว้ ผลเท่ากัน)
update doc_counters set last_no = 0 where prefix in ('OR','QT','RC');


-- ═════════════════════════════════════════════════════════════════════════════
-- ส่วนที่ 5 — ข้อมูลทดสอบอื่นที่ **ไม่ได้อยู่ในขอบเขตข้อ 3b**
-- เลือกรันเองตามต้องการ (คอมเมนต์ไว้ทั้งหมด — ไม่ทำงานถ้าไม่เปิด)
-- ═════════════════════════════════════════════════════════════════════════════

-- ใบเสนอราคาทดสอบ (ตรวจก่อนว่าไม่ใช่ของลูกค้าจริง)
-- select * from quotes;
-- delete from quotes;

-- รายการจ่ายส่วนแบ่งทดสอบ — ลบแล้วยอด "จ่ายแล้ว" ในหน้า /admin/payouts จะกลับเป็น 0
-- select * from payouts;
-- delete from payouts;

-- สถิติ view/download ที่เกิดจากการทดสอบ (ทำให้ตัวเลข analytics เพี้ยน)
-- select count(*) from font_events;
-- delete from font_events;

-- รายชื่อรอ subscription — ปกติ **ไม่ควรลบ** ถ้าเป็นคนสมัครจริง
-- select * from subscription_waitlist;


-- ═════════════════════════════════════════════════════════════════════════════
-- ส่วนที่ 6 — นับหลังลบ เทียบกับส่วนที่ 1
-- ═════════════════════════════════════════════════════════════════════════════

select 'orders' as label, count(*) from orders
union all select 'order_items',   count(*) from order_items
union all select 'entitlements',  count(*) from entitlements
union all select 'download_logs', count(*) from download_logs
union all select 'fonts',         count(*) from fonts
union all select 'fonts (test-*)',count(*) from fonts where slug like 'test-%';

-- คาดหวัง: orders / order_items / entitlements / download_logs / fonts (test-*) = 0
-- และ fonts เหลือเฉพาะฟอนต์ที่ขายจริง

-- 🔴 หลังรันเสร็จต้อง **deploy เว็บใหม่** (ปุ่ม deploy ในหน้า admin) เพราะหน้า
--    font detail เป็น SSG — ไม่ deploy URL ของฟอนต์ที่ลบไปแล้วยังเข้าได้อยู่
