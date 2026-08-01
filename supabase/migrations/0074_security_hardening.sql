-- เก็บงานความปลอดภัยจากผลตรวจ Supabase advisors (1 ส.ค. 2569)
--
-- ทั้งสามข้อในไฟล์นี้ไม่ใช่ช่องโหว่ที่ทำให้ข้อมูลลูกค้าหรือเงินรั่ว — ฐาน RLS ตรวจแล้วแน่นดี
-- แต่เป็นเรื่อง "ไล่ดูข้อมูล (enumeration)" กับ "สแปม" ซึ่งจะกลายเป็นปัญหาจริงตอนเปิดขาย
-- และตอนยกฟอนต์ 35 ตัวขึ้น จึงปิดก่อน go-live

-- ── 1) ปิดการไล่ดูรายชื่อไฟล์ใน public bucket ───────────────────────────────
--
-- เดิม bucket สาธารณะทั้ง 7 มี policy SELECT ที่กว้างแค่ `bucket_id = '<ชื่อ>'`
-- ซึ่งเปิดให้ใครก็ได้เรียก storage list API แล้ว **ไล่ดูรายชื่อไฟล์ทั้ง bucket**
-- ผลจริง: ส่องฟอนต์ที่ยังไม่ publish, ดึงไฟล์ demo ของฟอนต์ที่ยังไม่เปิดขายล่วงหน้า,
-- เห็นไฟล์ที่ตกค้าง (เช่น license PDF orphan จาก path เก่าก่อน 0074)
--
-- ⚠️ ที่ต้องเข้าใจก่อนแตะ: bucket พวกนี้เป็น **public bucket** ซึ่งเส้นทาง
--    /object/public/<bucket>/<path> **ข้าม RLS อยู่แล้วโดยการออกแบบของ Supabase**
--    policy พวกนี้จึงมีผลเฉพาะกับ list API และเส้นทาง /object/<bucket>/ เท่านั้น
--    → ลบทิ้งแล้ว "รูปภาพ/ไฟล์ที่รู้ URL ยังเปิดได้เหมือนเดิมทุกประการ"
--
-- ตรวจก่อนลบแล้วว่าแอปไม่พึ่ง policy พวกนี้: ทั้ง src ใช้ getPublicUrl() อย่างเดียว
-- (lib/storage.ts, TypeTester.tsx, OwnPricing.tsx) ซึ่งเป็นการต่อสตริงฝั่ง client
-- ไม่เรียก API เลย · ไม่มี .list() / .download() / createSignedUrl() บน 7 bucket นี้
--
-- ไม่แตะ: `fonts-full` (ไฟล์ที่ขายจริง เป็น private + policy `owner or admin read full`)
--         และ policy INSERT/UPDATE/DELETE ของ designer/admin ทั้งหมด
--
-- ย้อนกลับ: create policy "public read covers" on storage.objects
--             for select using (bucket_id = 'covers');  (ทำแบบเดียวกันทั้ง 7 อัน)

drop policy if exists "public read covers"       on storage.objects;
drop policy if exists "public read demo"         on storage.objects;
drop policy if exists "public read free"         on storage.objects;
drop policy if exists "public read license pdf"  on storage.objects;
drop policy if exists "public read previews"     on storage.objects;
drop policy if exists "public read specimens"    on storage.objects;
drop policy if exists "tester-cache public read" on storage.objects;

-- ── 2) ตรึง search_path ของ set_updated_at ──────────────────────────────────
--
-- ฟังก์ชัน trigger ที่ไม่ตั้ง search_path เปิดช่องให้ผู้ที่สร้าง object ใน schema
-- ที่มาก่อนใน path หลอกให้เรียกของปลอมได้ · body มีแค่ `new.updated_at = now()`
-- และ now() มาจาก pg_catalog ซึ่งอยู่ใน path เสมอ จึงปลอดภัยกับ search_path = ''

alter function public.set_updated_at() set search_path = '';

-- ── 3) กันสแปมใบเสนอราคา ────────────────────────────────────────────────────
--
-- submit_public_quote เป็น security definer ที่ anon เรียกได้ (ตามการออกแบบ — ฟอร์ม
-- ขอใบเสนอราคาเปิดสาธารณะ) แต่ Turnstile ที่หน้า /quote กันได้เฉพาะ **ขาส่งอีเมล**
-- (ตรวจใน email-service.ts) ส่วนแถวในตาราง quotes เกิดจาก RPC ที่ยิงตรงได้
-- → ใครก็ได้ยิง RPC รัว ๆ ถมตาราง quotes และทำให้กล่องงานของ designer ใช้ไม่ได้
--
-- ⚠️ ข้อจำกัดที่ต้องรู้: การนับต่ออีเมลกันคนที่ "ยิงซ้ำด้วยอีเมลเดิม" ได้เท่านั้น
--    ผู้ไม่หวังดีที่สุ่มอีเมลใหม่ทุกครั้งยังผ่านได้ · ทางแก้ที่ถูกต้องจริงคือย้ายการ insert
--    ไปหลัง Turnstile (ผ่าน Pages Function เหมือน /api/send-email) ซึ่งเป็นการรื้อ
--    เส้นทางที่ใช้งานได้อยู่ — จงใจไม่ทำก่อน go-live เก็บไว้เป็นงานหลังเปิดขาย
--
-- signature เดิมทุกประการ (create or replace) — grant จาก 0056 จึงยังอยู่
-- และ logic เดิมจาก 0072 (invalid_designer / quotes_disabled / missing_required_field)
-- คงไว้ครบทุกข้อ เพิ่มเฉพาะบล็อกนับความถี่

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

  -- อีเมลเดียวกันส่งได้ไม่เกิน 5 คำขอ/ชั่วโมง
  -- (เทียบแบบตัดช่องว่างและไม่สนตัวพิมพ์ ไม่งั้นเลี่ยงได้ด้วยการเติมช่องว่าง/สลับตัวพิมพ์)
  if (
    select count(*) from public.quotes
    where lower(trim(email)) = lower(trim(p_email))
      and created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'rate_limited';
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
