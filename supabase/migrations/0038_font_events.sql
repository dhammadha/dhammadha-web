-- Phase 4.3 — Analytics: font_events
-- เก็บ event ระดับฟอนต์ (view / free_download) เพื่อทำสถิติให้ designer/admin ดู
-- ไม่ใช่ระบบเงิน — ไม่ต้องเป๊ะ 100% แลกกับ implementation ที่เบาและ insert ได้จาก
-- client ตรง ๆ (ไม่ต้องผ่าน Edge Function เหมือน download_logs ที่ผูกกับ entitlement จริง)

create table public.font_events (
  id bigint generated always as identity primary key,
  font_id uuid not null references public.fonts(id) on delete cascade,
  kind text not null check (kind in ('view', 'free_download')),
  -- nullable: 'view' เกิดก่อน login ได้ (anonymous), 'free_download' จะมี user_id เสมอ
  -- เพราะปุ่มโหลดฟรีโชว์เฉพาะคน login (ดู src/lib/track.ts)
  user_id uuid,
  -- dedupe key จาก client (localStorage) — กันนับ view ซ้ำ 1 ครั้ง/ฟอนต์/วัน/เบราว์เซอร์
  -- การกันซ้ำทำฝั่ง client ล้วน ๆ ไม่ได้ enforce ใน DB เพราะเป็นสถิติ ไม่ใช่ตัวเงิน
  session_key text,
  created_at timestamptz not null default now()
);

create index font_events_font_kind_created_idx
  on public.font_events (font_id, kind, created_at);

alter table public.font_events enable row level security;

-- insert เปิดกว้างให้ anon + authenticated (view นับได้แม้ยังไม่ login)
-- with check กัน spoof user_id ของคนอื่น: ใส่ user_id ได้แค่ null หรือ auth.uid() ของตัวเอง
-- ยอมรับว่า anon insert แบบนี้ปลอมยอด view ได้ในทางทฤษฎี แต่เป็นแค่สถิติ ไม่กระทบเงิน/สิทธิ์
create policy "anyone insert font events"
  on public.font_events for insert
  with check (
    kind in ('view', 'free_download')
    and (user_id is null or user_id = auth.uid())
  );

grant insert on public.font_events to anon, authenticated;

-- select: admin เห็นทุกแถว, designer เห็นเฉพาะ event ของฟอนต์ตัวเอง (หน้า revenue/stats)
create policy "admin read font events"
  on public.font_events for select
  using (public.get_my_role() = 'admin');

create policy "designer read own fonts events"
  on public.font_events for select
  using (exists (
    select 1 from public.fonts f
    where f.id = font_id and f.owner_id = auth.uid()
  ));

-- select เฉพาะ authenticated (designer/admin) — anon insert ได้อย่างเดียว อ่านไม่ได้
grant select on public.font_events to authenticated;

-- ไม่ grant update/delete ให้ใคร — event log แก้ไข/ลบไม่ได้ (append-only)

-- หมายเหตุ: kind ขยายได้ในอนาคต (เช่น subscription usage metrics — Phase 4.1)
-- ด้วยการ alter check constraint เพิ่มค่าใหม่ เช่น
--   alter table public.font_events drop constraint font_events_kind_check;
--   alter table public.font_events add constraint font_events_kind_check
--     check (kind in ('view', 'free_download', 'subscription_download'));
