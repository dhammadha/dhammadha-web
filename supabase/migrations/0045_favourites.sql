-- Phase 4.1 — Favourites: รายการโปรดของ user (sync กับ desktop app)
-- กดหัวใจบนเว็บ = รายการโปรดในแอป ใช้ activate ฟอนต์ได้เร็วโดยไม่ต้องค้นหา
-- เขียน/ลบตรงจาก client ใต้ RLS (owner-only) — ไม่ต้องมี RPC toggle

create table public.favourites (
  user_id uuid not null references public.users(id) on delete cascade,
  font_id uuid not null references public.fonts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, font_id)
);

alter table public.favourites enable row level security;

-- เจ้าของเท่านั้น ทุก verb — ไม่มีอะไรให้ admin moderate
create policy "own favourites"
  on public.favourites for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ไม่ grant update (แถวเป็นแค่คู่ key ไม่มีอะไรให้แก้) และไม่ grant ให้ anon
grant select, insert, delete on public.favourites to authenticated;

-- service_role สำหรับ Edge Function sub-font (action list ส่ง favourites ไปให้แอป)
-- default privileges จาก 0041 ครอบอยู่แล้ว แต่ grant ชัด ๆ กันพลาด
grant all on public.favourites to service_role;
