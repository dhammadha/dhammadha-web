-- 🔴 "public insert quotes" (with check (true)) ไม่จำกัดคอลัมน์เลย — anon POST ตรงไป
-- /rest/v1/quotes ตั้งค่าคอลัมน์บัญชี/เอกสารเองได้หมด: quote_no, receipt_no,
-- quote_issued_at, receipt_issued_at, issued_by, total_amount, fonts_detail, discount,
-- designer_id → ปลอมสถานะเอกสาร/สวมรอย designer หรือ admin และชนเลขเอกสารจริงได้
--
-- เลือกทางเลือก (a) RPC security definer แทนการเปิด insert ตรง (ไม่ใช่ (b) with check
-- จำกัดคอลัมน์) เพราะ:
--   1. เข้าแพทเทิร์นเดียวกับ issue_quote_doc/issue_quotation_priced ที่มีอยู่แล้วในระบบนี้
--   2. ปิด insert ตรงทั้งหมด → ถ้าวันหลังเพิ่มคอลัมน์บัญชีใหม่ในตาราง quotes จะ "ปลอดภัยโดย
--      default" (ต้องแก้ RPC ถึงจะเปิดให้ตั้งค่าได้) ต่างจาก (b) ที่ต้องตามเขียน with check
--      เพิ่มทุกครั้งที่เพิ่มคอลัมน์ ลืมครั้งเดียวก็รั่วอีก

drop policy if exists "public insert quotes" on public.quotes;

-- รับเฉพาะฟิลด์ที่ฟอร์มสาธารณะ (/quote) กรอกจริง ที่เหลือ (quote_no, receipt_no, ...,
-- total_amount, fonts_detail, issued_by, discount) ปล่อยเป็นค่า default ของตาราง (null/0)
-- เสมอ — client ตั้งเองไม่ได้อีกต่อไป
create function public.submit_public_quote(
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
