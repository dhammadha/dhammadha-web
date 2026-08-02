-- Phase 4.1 C1b — ทะเบียนอุปกรณ์ของสมาชิก subscription (3 ส.ค. 2569)
--
-- ทำไมต้องมี: `sub-font` (0 migration, C1) ตรวจสิทธิ์จาก JWT + subscription ที่ active
-- อย่างเดียว ซึ่ง **ไม่พอ** เพราะ `src/lib/supabase.ts` สร้าง client ด้วยค่า default =
-- persistSession ลง localStorage → สมาชิกเปิดเว็บ ก๊อป access token จาก devtools
-- แล้วยิง endpoint ตรงได้ทันที ได้ไฟล์ฟอนต์จริงโดยไม่ต้องแตะแอปเลย
-- ซึ่งขัดกับโมเดลที่เขียนไว้ใน /agreement ข้อ 7 ว่า "สมาชิกไม่ได้รับไฟล์ฟอนต์"
--
-- หลังจากนี้ action ที่แตะไฟล์ (list/download/heartbeat) ต้องมีลายเซ็น HMAC จาก
-- device key ที่อยู่ใน OS keychain ของเครื่องที่ลงทะเบียนไว้ → JWT อย่างเดียวไร้ค่า
--
-- ⚠️ สิ่งที่ตารางชุดนี้ **ไม่ได้** ทำ: มันไม่ได้ทำให้การคัดลอกเป็นไปไม่ได้
-- อะไรที่แอปถอดรหัสได้ เจ้าของเครื่องก็ถอดได้ · ที่ได้จริงคือยกระดับจาก
-- "ใครก็ได้ที่มีบัญชี ใช้เวลา 5 นาที" เป็น "ต้องงัด key ออกจาก keychain"
-- และที่สำคัญกว่าคือ **ระบุตัวได้ + ตัดสิทธิ์เป็นรายเครื่องได้**

-- ── 1) sub_devices — metadata ของเครื่อง ────────────────────────────────────
--
-- แยกสองตารางตามแบบ fonts / font_files_private ที่โปรเจกต์ใช้อยู่แล้ว:
-- ของที่อ่านได้อยู่ตารางหนึ่ง ของลับอยู่อีกตารางหนึ่ง
-- `revoked_at` จงใจใช้ชื่อเดียวกับ entitlements.revoked_at ซึ่งเป็น primitive
-- การเพิกถอนตัวเดียวที่มีอยู่แล้วในสคีมานี้

create table public.sub_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text,                                -- ชื่อเครื่องที่แอปส่งมา (เช่น "MacBook Pro ของมณฑล")
  platform text,                            -- 'macos' | 'windows'
  last_seen_at timestamptz,                 -- อัปเดตทุกครั้งที่ลายเซ็นผ่าน
  revoked_at timestamptz,                   -- ถอนแล้ว = ใช้ต่อไม่ได้ทันที (ไม่ลบแถว เก็บไว้สอบย้อนหลัง)
  created_at timestamptz not null default now()
);

-- ใช้ค้นตอนตรวจลายเซ็น + ตอนนับจำนวนเครื่องที่ยังใช้ได้
create index sub_devices_user_idx on public.sub_devices (user_id) where revoked_at is null;

alter table public.sub_devices enable row level security;

create policy "admin read sub devices"
  on public.sub_devices for select
  using (public.get_my_role() = 'admin');

-- **ไม่ grant ให้ authenticated เลย** — แอปดูรายการเครื่องของตัวเองผ่าน Edge Function
-- (action `devices`) เท่านั้น จุดยืนเดียวกับ stream_days ใน 0047:
-- ตารางที่กระทบสิทธิ์/เงิน ห้ามมีเส้นทางเขียนหรืออ่านตรงจาก client
grant select on public.sub_devices to authenticated;  -- policy จำกัดเหลือ admin
grant all on public.sub_devices to service_role;

-- ── 2) sub_device_keys — ของลับ ─────────────────────────────────────────────
--
-- 🔴 แยกตารางเพราะ **key ต้องไม่หลุดออกไปทาง PostgREST ไม่ว่าจะ role ไหน**
-- ถ้าเก็บรวมใน sub_devices แล้ว admin เผลอ select * ผ่าน dashboard/หน้าเว็บ
-- key ก็หลุดไปอยู่ในเบราว์เซอร์ทันที · ตารางนี้จึงไม่มี policy และไม่มี grant
-- ให้ role ไหนเลยนอกจาก service_role (Edge Function เท่านั้นที่แตะได้)
--
-- เลือก HMAC (symmetric) ไม่ใช่ Ed25519 เพราะใช้รูปแบบเดียวกับ verifyStripeSignature
-- ใน src/lib/checkout-service.ts ที่พิสูจน์แล้วในระบบนี้ — แลกกับการที่ server
-- ต้องเก็บ key ไว้จริง ซึ่งรับได้ เพราะคนที่เข้าถึง service_role ได้ก็เข้าถึง
-- bucket fonts-full ได้อยู่แล้ว การมี key เพิ่มไม่ได้เปิด exposure ใหม่

create table public.sub_device_keys (
  device_id uuid primary key references public.sub_devices(id) on delete cascade,
  device_key bytea not null,                -- 32 bytes จาก crypto.getRandomValues()
  created_at timestamptz not null default now()
);

alter table public.sub_device_keys enable row level security;
-- ไม่มี policy = ไม่มีใครอ่านได้ผ่าน PostgREST แม้แต่ admin (service_role bypass RLS)
grant all on public.sub_device_keys to service_role;

-- ── 3) sub_download_logs: ผูกกับเครื่อง ─────────────────────────────────────
--
-- ใช้สองอย่าง: (ก) rate limit รายเครื่องแทนรายบัญชี (ข) สอบย้อนว่าเครื่องไหนดูดคลัง
-- คงสไตล์เดิมของตารางนี้คือ **ไม่ผูก FK** (user_id/font_id ก็เป็น bare uuid)
-- เพราะเป็น log ที่ต้องอยู่รอดแม้แถวต้นทางถูกลบ

alter table public.sub_download_logs add column device_id uuid;

create index sub_download_logs_device_created_idx
  on public.sub_download_logs (device_id, created_at);

-- ── ที่จงใจไม่แตะ ───────────────────────────────────────────────────────────
--
-- **stream_days คง PK เป็น (user_id, font_id, day) ห้ามเติม device_id เข้า PK**
-- สูตรแบ่งรายได้ subscription เป็น user-centric โดยเจตนา (สมาชิก 1 คน = น้ำหนัก 1
-- หารตาม font-days ของตัวเอง — กัน activate-all ปั๊มยอด) ถ้านับเป็นรายเครื่อง
-- คนมี 2 เครื่องจะได้น้ำหนักสองเท่าทันที = ทำลายกติกาที่เพิ่งเขียนลง
-- /designer-agreement ข้อ 4 ไปเมื่อวาน
--
-- ย้อนกลับ:
--   alter table public.sub_download_logs drop column device_id;
--   drop table public.sub_device_keys;
--   drop table public.sub_devices;
