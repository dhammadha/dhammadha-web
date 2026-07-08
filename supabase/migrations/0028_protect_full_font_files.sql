-- ปิดช่องโหว่ไฟล์ฟอนต์เต็ม:
-- เดิม full_font_files (public URL) อยู่ในตาราง fonts ซึ่ง anon SELECT ได้ทั้ง row
-- และ bucket fonts-full เป็น public → ใครก็ดาวน์โหลดไฟล์เต็มได้โดยไม่ซื้อ
--
-- แก้โดย: ย้ายไปตาราง font_files_private (อ่านได้เฉพาะเจ้าของฟอนต์/แอดมิน),
-- เก็บเป็น storage path แทน URL (รองรับ signed URL ใน Phase 2),
-- และปิด bucket fonts-full เป็น private

create table public.font_files_private (
  font_id uuid primary key references public.fonts(id) on delete cascade,
  full_font_files text[],
  updated_at timestamptz not null default now()
);

create trigger font_files_private_updated_at
  before update on public.font_files_private
  for each row execute function public.set_updated_at();

alter table public.font_files_private enable row level security;

create policy "owner manage own font files"
  on public.font_files_private
  using (exists (select 1 from public.fonts f where f.id = font_id and f.owner_id = auth.uid()))
  with check (exists (select 1 from public.fonts f where f.id = font_id and f.owner_id = auth.uid()));

create policy "admin manage all font files"
  on public.font_files_private
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

-- ไม่ grant ให้ anon — เฉพาะผู้ login เท่านั้น (RLS จำกัด row อีกชั้น)
grant select, insert, update, delete on public.font_files_private to authenticated;

-- ย้ายข้อมูลเดิม: แปลง public URL → storage path ภายใน bucket
insert into public.font_files_private (font_id, full_font_files)
select id,
       (select array_agg(regexp_replace(u, '^.*/fonts-full/', '')) from unnest(full_font_files) u)
from public.fonts
where full_font_files is not null and array_length(full_font_files, 1) > 0;

-- ล้าง column เดิมในตาราง fonts (คง column ไว้ไม่ให้ RPC เก่าพัง แต่ไม่มีข้อมูลอีก)
update public.fonts
set full_font_files = null,
    obfuscated_font_files = null,
    obfuscated_map = null;

-- ปิด bucket ไฟล์ฟอนต์เต็มเป็น private — public URL เดิมใช้ไม่ได้อีกต่อไป
update storage.buckets set public = false where id = 'fonts-full';
