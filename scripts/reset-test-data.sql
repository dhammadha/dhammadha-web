-- ─────────────────────────────────────────────────────────────────────────────
-- ล้างข้อมูลทดสอบก่อนเปิดขายจริง (project.md งานที่เหลือ ข้อ 3b)
--
-- เป้าหมายที่เจ้าของกำหนด: **หลังรันเสร็จเหลือแค่ `users` กับฟอนต์ที่ขายจริง**
-- ข้อมูลธุรกรรมทั้งหมด (คำสั่งซื้อ · ใบเสนอราคา · การจ่ายส่วนแบ่ง · เลขที่เอกสาร)
-- ต้องกลับไปเป็นศูนย์ ใบจริงใบแรกของลูกค้าคนแรกจะได้เป็น `-0001`
--
-- 🔴 ห้ามรันจนกว่าจะ **ทดสอบ Stripe ขั้นที่ 3 (live key) เสร็จ** — การทดสอบทุกครั้ง
--    สร้าง order ทดสอบเพิ่ม ถ้ารันก่อนก็ต้องกลับมารันใหม่อยู่ดี
-- 🔴 backup ก่อนรันเสมอ (Supabase → Database → Backups) — ทุกคำสั่งนี้กู้คืนเองไม่ได้
-- 🔴 รัน **ทีละส่วน** ตามลำดับ 1 → 7 เท่านั้น
--
-- ⚠️ กับดักที่ทำให้ลำดับสลับไม่ได้ (ตรวจจาก FK จริงในฐานข้อมูลแล้ว):
--    1. `order_items.font_id → fonts` เป็น **ON DELETE RESTRICT** (FK ตัวเดียวในระบบ
--       ที่ไม่ใช่ CASCADE) → **ลบฟอนต์ก่อนล้าง order จะ error ทันที**
--    2. `orders.quote_id → quotes` เป็น **ON DELETE SET NULL** ไม่ใช่ RESTRICT →
--       ลบ quotes ก่อนจะ**ไม่ error แต่ไปล้างสายสัมพันธ์ของ order ที่ยังอยู่เงียบ ๆ**
--       จึงต้องลบ order ให้หมดก่อนเสมอ
--    3. `payouts` **ไม่มี FK ผูกกับ orders เลย** — ลบตอนไหนก็ได้ทางเทคนิค
--       แต่ยอดในนั้นคำนวณมาจาก order ที่กำลังจะหาย ถ้าไม่ลบจะเหลือยอด "จ่ายแล้ว"
--       ค้างอยู่ในหน้า /admin/payouts โดยไม่มีคำสั่งซื้อรองรับ
--    ที่เหลือ (entitlements / download_logs / order_items / favourites /
--    font_events / font_files_private / stream_days) เป็น CASCADE ลบตามให้เอง
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- ส่วนที่ 1 — นับก่อนลบ (อ่านอย่างเดียว รันดูได้ปลอดภัย)
-- เก็บผลไว้เทียบกับส่วนที่ 7 ตอนจบ
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

-- เลขที่เอกสารที่เดินไปแล้ว — ควรกลับเป็น 0 ทั้งหมดหลังส่วนที่ 5
select prefix, year, last_no from doc_counters order by prefix;


-- ═════════════════════════════════════════════════════════════════════════════
-- ส่วนที่ 2 — ลบ order ทดสอบ (ต้องทำก่อนทุกอย่าง)
--
-- เกณฑ์สองอันครอบคลุมทั้งสองแบบที่มีอยู่จริง:
--   · `ORTEST-*`      = แถว seed ที่ใส่มือ (provider_session_id เป็น 'seed-test-*')
--   · `cs_test_*`     = ใบที่เกิดจากการจ่ายจริงด้วย Stripe **test key**
-- ⚠️ ชื่อคอลัมน์คือ `provider_session_id` (ไม่ใช่ `stripe_session_id`)
-- ⚠️ ใบของ live key ขึ้นต้น `cs_live_*` → เกณฑ์นี้ **ไม่แตะ** โดยตั้งใจ
--    เป็นตาข่ายกันพลาดเผื่อวันหน้ามีคนรันสคริปต์นี้ซ้ำหลังเปิดขายไปแล้ว
--
-- CASCADE จะลบตามให้: order_items → entitlements → download_logs
-- ═════════════════════════════════════════════════════════════════════════════

delete from orders
where order_no like 'ORTEST%' or provider_session_id like 'cs_test_%';

-- ต้องได้ 0 — ถ้าเหลือ แปลว่ามีใบที่ไม่เข้าเกณฑ์ทั้งสอง ต้องดูด้วยตาก่อนไปต่อ
select count(*) as orders_left from orders;


-- ═════════════════════════════════════════════════════════════════════════════
-- ส่วนที่ 3 — ล้างข้อมูลการเงินที่เหลือ: ใบเสนอราคา + การจ่ายส่วนแบ่ง
--
-- 🔴 สองคำสั่งนี้ลบ **ทั้งตาราง** ไม่มีเกณฑ์คัดกรองแบบ order เพราะ quotes/payouts
--    ไม่มีเครื่องหมายแยก test/live ในตัวเอง → **ห้ามรันหลังเปิดขายจริงเด็ดขาด**
--    ก่อนเปิดขายทุกแถวเป็นของทดสอบทั้งหมดจึงลบยกตารางได้
-- ⚠️ ต้องรันหลังส่วนที่ 2 เสมอ — `orders.quote_id` เป็น SET NULL ถ้าลบ quotes ก่อน
--    order ที่ยังอยู่จะถูกตัดสายสัมพันธ์เงียบ ๆ โดยไม่มี error เตือน
-- ═════════════════════════════════════════════════════════════════════════════

-- ดูก่อนลบ — ยืนยันด้วยตาว่าไม่มีของลูกค้าจริง
select id, quote_no, receipt_no, company_name, email, total_amount, created_at from quotes order by created_at;
select id, designer_id, period_year, period_quarter, doc_no, amount, paid_at from payouts order by paid_at;

delete from quotes;
delete from payouts;

-- ต้องได้ 0 ทั้งคู่
select 'quotes' as label, count(*) from quotes
union all select 'payouts', count(*) from payouts;


-- ═════════════════════════════════════════════════════════════════════════════
-- ส่วนที่ 4 — ลบฟอนต์ทดสอบที่ยังเหลือ
-- (ตัวที่ไม่มี order อ้างถึงลบไปแล้วผ่าน /admin/font-review · ตัวที่ติด RESTRICT
--  เช่น `test-02` ลบได้ตรงนี้เพราะส่วนที่ 2 เคลียร์ order_items ไปแล้ว)
--
-- ⚠️ ไม่ล้างไฟล์ใน Supabase Storage — ไฟล์ฟอนต์/cover จะค้างเป็น orphan
--    (ปุ่มลบใน /admin/font-review ก็ทำแค่ลบแถวเหมือนกัน) ถ้าจะเก็บกวาดต้องลบจาก
--    Storage UI เอง โดย **จดพาธไว้ก่อนรัน delete** เพราะแถวหายแล้วตามไม่ได้อีก
-- ⚠️ ไฟล์ที่ตกค้างอยู่แล้วอีกตัว: `license-pdf/f6586af8-….pdf` (orphan จาก path เก่า
--    ก่อน migration 0074) ไม่มีอะไรอ้างถึงแต่ยังเปิดอ่านได้ — ลบใน Storage UI ได้เลย
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
-- ส่วนที่ 5 — รีเซ็ตเลขที่เอกสาร ให้ใบจริงใบแรกเริ่มที่ 0001
--
-- prefix ที่ใช้อยู่จริง (เช็คจาก doc_counters แล้ว):
--   OR = คำสั่งซื้อ · QT = ใบเสนอราคา · IV = ใบแจ้งหนี้ (0076) · RC = ใบเสร็จรับเงิน
--   PO = ใบสรุปการโอนส่วนแบ่ง (0073) · WT = ใบ 50 ทวิ (0073 — ยังไม่มีแถวจนกว่า
--        `LEGAL_ENTITY_IS_JURISTIC = true` แต่ใส่ไว้ให้ครบกันลืมวันจดบริษัท)
-- ⚠️ เพิ่ม prefix ใหม่ในระบบเมื่อไร ต้องมาเติมในบรรทัดนี้ด้วย
--
-- ⚠️ ทำหลังส่วนที่ 2–4 เท่านั้น ถ้ายังเหลือใบเก่าอยู่เลขจะชนกัน (order_no เป็น unique)
-- ⚠️ `year` เป็น พ.ศ. — ปีถัดไปตัวนับสร้างแถวใหม่เอง ไม่ต้องแตะ
-- ═════════════════════════════════════════════════════════════════════════════

-- ทางเลือก ก: ลบแถวตัวนับทิ้ง — next_doc_no() จะสร้างใหม่เริ่มที่ 1 เอง
-- delete from doc_counters where prefix in ('OR','QT','IV','RC','PO','WT');

-- ทางเลือก ข: เซ็ตกลับเป็น 0 (เก็บแถวไว้ ผลเท่ากัน)
update doc_counters set last_no = 0 where prefix in ('OR','QT','IV','RC','PO','WT');


-- ═════════════════════════════════════════════════════════════════════════════
-- ส่วนที่ 6 — สถิติและรายการที่ **ต้องตัดสินใจเอง**
-- ═════════════════════════════════════════════════════════════════════════════

-- สถิติ view / free download ที่เกิดจากการทดสอบ — ทำให้ตัวเลขใน /admin/analytics
-- และ /designer/analytics เพี้ยนตั้งแต่วันแรก
-- **แนะนำให้ลบ** ถ้าอยากได้ตัวเลขที่สะอาดจริง · ข้ามได้ถ้าอยากเก็บยอดวิวสะสมไว้
-- select count(*) from font_events;
delete from font_events;

-- 🔴 รายชื่อรอ subscription — **ห้ามลบ** ถ้ามีคนสมัครจริงแล้ว (เป็นข้อมูลลูกค้า ไม่ใช่ของทดสอบ)
select count(*) as waitlist_rows from subscription_waitlist;


-- ═════════════════════════════════════════════════════════════════════════════
-- ส่วนที่ 7 — นับหลังลบ เทียบกับส่วนที่ 1
-- ═════════════════════════════════════════════════════════════════════════════

select 'orders' as label, count(*) from orders
union all select 'order_items',    count(*) from order_items
union all select 'entitlements',   count(*) from entitlements
union all select 'download_logs',  count(*) from download_logs
union all select 'quotes',         count(*) from quotes
union all select 'payouts',        count(*) from payouts
union all select 'font_events',    count(*) from font_events
union all select 'fonts (test-*)', count(*) from fonts where slug like 'test-%'
union all select 'fonts (เหลือขายจริง)', count(*) from fonts
union all select 'users (ต้องไม่ถูกแตะ)', count(*) from users;

select prefix, year, last_no from doc_counters order by prefix;

-- คาดหวัง:
--   · orders / order_items / entitlements / download_logs / quotes / payouts
--     / font_events / fonts (test-*)  = 0
--   · doc_counters ทุก prefix last_no = 0
--   · fonts เหลือเฉพาะฟอนต์ที่ขายจริง · users ต้องเท่าเดิมกับก่อนรัน

-- 🔴 หลังรันเสร็จต้อง **deploy เว็บใหม่** (ปุ่ม deploy ในหน้า admin) เพราะหน้า
--    font detail เป็น SSG — ไม่ deploy URL ของฟอนต์ที่ลบไปแล้วยังเข้าได้อยู่
