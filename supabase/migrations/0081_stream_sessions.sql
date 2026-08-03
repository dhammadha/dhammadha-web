-- เก็บ "ช่วงเวลาการใช้งาน" ละเอียดระดับ session (3 ส.ค. 2569)
--
-- ทำไม: `stream_days` เก็บแค่ "วันไหนที่เคยเปิดฟอนต์นี้" ซึ่งหยาบเกินกว่าจะตอบว่า
-- ใช้จริงนานแค่ไหน · เจ้าของต้องการให้ **ทุกการเคลื่อนไหวมีข้อมูลมาคำนวณรายได้**
-- เริ่มนับตอน activate หยุดตอน deactivate/signout/เครื่องดับ/ออฟไลน์ แล้วนับต่อเมื่อกลับมา
--
-- 🔴 **ตารางนี้ยังไม่ถูกใช้คิดเงิน — เป็นการเก็บข้อมูลดิบไว้ก่อน**
-- เจ้าของเลือกไว้ (3 ส.ค. 2569) ว่ายังคิดเงิน 38% ตาม `stream_days` (จำนวนวัน) เหมือนเดิม
-- เพราะ `/designer-agreement` ข้อ 4 เขียนว่า "นับจากจำนวนวันที่สมาชิกเปิดใช้ฟอนต์นั้น"
-- → **`stream_days` กับ RPC `subscription_month_data` ไม่ถูกแตะเลยในรอบนี้**
-- เก็บข้อมูลจริง 2-3 เดือนแล้วค่อยตัดสินใจว่าจะสลับไปคิดตามเวลาไหม ตอนนั้นแก้แค่
-- แหล่งข้อมูลใน RPC กับถ้อยคำสัญญาข้อ 4 — **สูตรถ่วงน้ำหนัก user-centric ไม่ต้องแก้**
-- เพราะ sum(x/total)/N ใช้ได้เหมือนกันไม่ว่า x จะเป็นวันหรือวินาที
--
-- ── สูตรเดียวที่ต้องจำ ──────────────────────────────────────────────────────
--   เวลาที่นับได้ = coalesce(ended_at, last_seen_at) - started_at
--
-- ปิดแอปอย่างถูกต้อง → `ended_at` มีค่า ได้เวลาเป๊ะ
-- เครื่องดับ/crash/เน็ตหลุด → `ended_at` เป็น null ตลอดไป นับได้ถึงแค่ heartbeat
-- ครั้งสุดท้าย · **จึงไม่มีทางนับเกินความจริง และไม่ต้องมีโค้ดพิเศษไล่ปิด session ค้าง**
-- (ไม่ต้องมี cron sweep — ความจริงอยู่ในข้อมูลอยู่แล้ว)

create table public.stream_sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  font_id uuid not null,
  device_id uuid,
  started_at timestamptz not null,
  -- เลื่อนโดย heartbeat · ใช้เป็นจุดสิ้นสุดเมื่อไม่มี ended_at
  last_seen_at timestamptz not null,
  ended_at timestamptz,
  -- deactivate | signout | quit | expired | switched (ถูกเครื่องอื่นแย่งสิทธิ์)
  end_reason text,
  created_at timestamptz not null default now()
);

-- ใช้ตอน heartbeat หา session ที่ยังเปิดอยู่ของเครื่องนั้น
create index stream_sessions_open_idx
  on public.stream_sessions (device_id, font_id)
  where ended_at is null;

-- ใช้ตอนสรุปรายเดือน (ถ้าวันหนึ่งสลับไปคิดตามเวลา)
create index stream_sessions_user_started_idx
  on public.stream_sessions (user_id, started_at);

alter table public.stream_sessions enable row level security;

-- อ่านได้เหมือน stream_days: admin กับ designer (ไปโผล่ในหน้ารายได้/สมาชิก)
-- **ไม่มี insert/update policy ฝั่ง client เลย** — Edge Function (service_role) เท่านั้น
-- จุดยืนเดียวกับ stream_days ใน 0047: ตารางที่กระทบเงินห้ามมีเส้นทางเขียนจาก client
create policy "staff read stream sessions"
  on public.stream_sessions for select
  using (public.get_my_role() in ('admin', 'designer'));

grant select on public.stream_sessions to authenticated;
grant all on public.stream_sessions to service_role;

-- ย้อนกลับ: drop table public.stream_sessions;
