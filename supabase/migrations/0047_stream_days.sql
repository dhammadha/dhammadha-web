-- Phase 4.1 — Stream days + sub download logs (ข้อมูลระดับเงิน — server เขียนเท่านั้น)
--
-- stream_days: "font-days" ฐานการแบ่ง stream pool 35% ของ subscription
--   1 แถว = subscriber คนนี้ activate ฟอนต์นี้อยู่ ณ วันนี้ (วันตามเวลาไทย)
--   เขียนได้จาก Edge Function sub-font (service role, ตรวจ JWT + สิทธิ์ก่อน) เท่านั้น
--   ต่างจาก font_events (0038) ที่เป็นสถิติ client เขียนตรงได้ — อันนี้กระทบเงิน
--   จึงห้ามมี insert path จาก client โดยสิ้นเชิง
--
-- sub_download_logs: log การโหลดไฟล์ฟอนต์ผ่าน subscription (rate limit + audit)
--   แยกจาก download_logs เดิมซึ่งผูกกับ entitlement_id ของการซื้อรายฟอนต์

create table public.stream_days (
  user_id uuid not null references public.users(id) on delete cascade,
  font_id uuid not null references public.fonts(id) on delete cascade,
  day date not null,  -- วันตามเวลาไทย (Asia/Bangkok) — Edge Function เป็นคนกำหนด
  created_at timestamptz not null default now(),
  primary key (user_id, font_id, day)
);

create index stream_days_day_idx on public.stream_days (day);

alter table public.stream_days enable row level security;

-- admin อ่านได้ (ตรวจสอบข้อมูลดิบ) — designer ดูผ่าน RPC subscription_month_data (0048)
create policy "admin read stream days"
  on public.stream_days for select
  using (public.get_my_role() = 'admin');

grant select on public.stream_days to authenticated;  -- policy จำกัดเหลือ admin
-- ไม่มี insert/update/delete policy หรือ grant ให้ client — service role bypass RLS
grant all on public.stream_days to service_role;

create table public.sub_download_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  font_id uuid not null,
  file_path text not null,
  ip text,
  created_at timestamptz not null default now()
);

create index sub_download_logs_user_created_idx
  on public.sub_download_logs (user_id, created_at);

alter table public.sub_download_logs enable row level security;

create policy "admin read sub download logs"
  on public.sub_download_logs for select
  using (public.get_my_role() = 'admin');

grant select on public.sub_download_logs to authenticated;  -- policy จำกัดเหลือ admin
grant all on public.sub_download_logs to service_role;
