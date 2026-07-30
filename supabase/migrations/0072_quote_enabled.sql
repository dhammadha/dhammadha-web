-- สวิตช์ "ระบบใบเสนอราคา" ต่อ designer
--
-- เดิมทุก designer มีระบบใบเสนอราคาเปิดอยู่เสมอ ทำให้คนที่ขายเฉพาะรายชุด (retail)
-- ก็มีปุ่ม "ขอใบเสนอราคา" บนหน้าฟอนต์ และมีหน้า /designer/quotes ที่ไม่ได้ใช้
-- ตอนนี้ให้เลือกเปิดเองจากหน้า "ราคาและโปรโมชั่น"
--
-- ⚠️ ต้องบังคับฝั่งฐานข้อมูลด้วย ไม่ใช่แค่ซ่อนปุ่ม — submit_public_quote เป็น
-- security definer ที่ anon เรียกได้ ถ้าเช็คแค่ใน UI ลูกค้าที่รู้ URL ก็ยังยิงเข้ามาได้

alter table public.designer_license_config
  add column if not exists quote_enabled boolean not null default false;

comment on column public.designer_license_config.quote_enabled is
  'designer เปิดใช้ระบบใบเสนอราคาหรือไม่ — false = ซ่อนปุ่มขอใบเสนอราคาและปฏิเสธ submit_public_quote';

-- ── backfill: designer ที่มีอยู่ก่อน migration นี้ต้องไม่สะดุด ────────────────
-- (ค่า default false ใช้กับ designer ที่สมัครใหม่หลังจากนี้เท่านั้น)
update public.designer_license_config set quote_enabled = true;

-- designer ที่ยังไม่เคยเข้าหน้าราคาจะยังไม่มีแถวในตารางนี้เลย ต้องสร้างให้ด้วย
-- ไม่งั้นจะกลายเป็น "ปิด" ทั้งที่เป็น designer เดิมของระบบ
insert into public.designer_license_config (designer_id, use_default, quote_enabled)
select u.id, true, true
from public.users u
where u.designer_slug is not null
on conflict (designer_id) do nothing;

-- ── ปิดช่องทางฝั่งหลังบ้าน ──────────────────────────────────────────────────
-- signature เดิมทุกประการ (create or replace) — grant ที่ให้ไว้ใน 0056 จึงยังอยู่
create or replace function public.submit_public_quote(
  p_contact_name text,
  p_company_name text,
  p_address text,
  p_tax_id text,
  p_email text,
  p_license_type text,
  p_fonts text[],
  p_note text,
  p_designer_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  -- designer_id ต้องอ้างถึง designer จริง (มี designer_slug) ห้ามยัด id มั่ว/สวมรอย
  if p_designer_id is not null and not exists (
    select 1 from public.users where id = p_designer_id and designer_slug is not null
  ) then
    raise exception 'invalid_designer';
  end if;

  -- designer ที่ปิดระบบใบเสนอราคาไว้ ต้องรับคำขอใหม่ไม่ได้
  -- ไม่มีแถว config = ยังไม่เคยเปิด = ปิด (ตรงกับค่า default ของคอลัมน์)
  if p_designer_id is not null and not exists (
    select 1 from public.designer_license_config
    where designer_id = p_designer_id and quote_enabled
  ) then
    raise exception 'quotes_disabled';
  end if;

  if p_contact_name is null or length(trim(p_contact_name)) = 0
     or p_company_name is null or length(trim(p_company_name)) = 0
     or p_address is null or length(trim(p_address)) = 0
     or p_tax_id is null or length(trim(p_tax_id)) = 0
     or p_email is null or length(trim(p_email)) = 0
     or p_license_type is null or length(trim(p_license_type)) = 0
     or p_fonts is null or cardinality(p_fonts) = 0 then
    raise exception 'missing_required_field';
  end if;

  insert into public.quotes (
    contact_name, company_name, address, tax_id, email, license_type, fonts, note, designer_id
  ) values (
    p_contact_name, p_company_name, p_address, p_tax_id, p_email, p_license_type, p_fonts, p_note, p_designer_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.submit_public_quote(text, text, text, text, text, text, text[], text, uuid) from public;
grant execute on function public.submit_public_quote(text, text, text, text, text, text, text[], text, uuid) to anon, authenticated;
