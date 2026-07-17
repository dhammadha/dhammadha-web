-- แก้ข้อมูล weights / styles / Font Format ที่แสดงผิดในหน้า font detail
--
-- ปัญหา 1 — FontForm.tsx:322 เก็บ weight_count เป็น "จำนวนไฟล์" ไม่ใช่จำนวน weight
--   อัป 5 weights × 2 format (OTF+TTF) = 10 ไฟล์ → เก็บ 10 → หน้า detail โชว์
--   "10 weights / 10 styles" ทั้งที่จริงคือ 5 weights / 5 styles / 2 formats
--
-- ปัญหา 2 — Font Format ดึงจากไฟล์ demo (FontDetail.tsx:237-238) ไม่ใช่ Full Family
--   demo ที่ระบบ gen ให้มีไฟล์เดียว (.otf) → โชว์ "OTF" ทั้งที่ลูกค้าซื้อแล้วได้ทั้ง OTF+TTF
--
-- ทำไมหน้า detail คำนวณเองไม่ได้: ตั้งแต่ 0028 ไฟล์ Full Family ย้ายไป
-- font_files_private ซึ่ง anon อ่านไม่ได้ (ตั้งใจ) → ต้องคำนวณตอนบันทึกแล้วเก็บ
-- ลงคอลัมน์สาธารณะแทน
--
-- กติกา:
--   weight = ชื่อ style ที่ตัดคำว่า italic/oblique ออก  → Light, Regular, Medium, Bold, Black = 5
--   style  = ชื่อ style เต็ม (weight + italic)
--   format = นามสกุลไฟล์ที่ไม่ซ้ำ (ไม่นับ .zip)          → OTF, TTF
--
-- ⚠️ SQL ที่นี่เดาจาก "ชื่อไฟล์" ซึ่งเป็นวิธีที่เราเลิกใช้ไปแล้ว — เก็บไว้เพราะมันรันไป
-- แล้วและให้ผลถูกกับข้อมูล ณ ตอนนั้น (test-01/02/03 ตั้งชื่อแบบ KRONN-Black.otf)
-- **อย่าเอา SQL นี้ไปใช้ backfill ชุดใหม่** — การเดาจากชื่อไฟล์พังกับชื่อจริงหลายแบบ เช่น
--   bangkok_bold-italic_v1-0.ttf / bangkok-decor_bold_v1-0.ttf  ("-" มี 3 ความหมายในชุดเดียว)
-- → parser แบบนี้อ่านได้ "0" ทุกไฟล์ = 1 weight / 1 style
-- ของจริงตอนนี้อ่าน metadata จากในไฟล์ (name table + OS/2) ผ่าน fontkit ตอนบันทึก
-- ดู src/lib/font-meta.ts — ถ้าต้อง backfill อีกให้เปิดฟอนต์แล้วกดบันทึกใหม่แทน

alter table public.fonts add column if not exists style_count integer;
alter table public.fonts add column if not exists formats text[];

comment on column public.fonts.weight_count is 'จำนวน weight ที่ไม่ซ้ำ (ตัด italic ออกแล้ว) — คำนวณตอนบันทึกใน FontForm';
comment on column public.fonts.style_count is 'จำนวน style ที่ไม่ซ้ำ (weight + italic) — ไฟล์ต่าง format ของ weight เดียวกันนับเป็น style เดียว';
comment on column public.fonts.formats is 'นามสกุลไฟล์ Full Family ที่ไม่ซ้ำ เช่น {OTF,TTF} — ลูกค้าซื้อแล้วได้อะไรบ้าง';

-- ── backfill จากไฟล์จริง ────────────────────────────────────────────────────
-- ใช้ full_font_files เป็นหลัก (ฟอนต์ขาย) ถ้าไม่มีใช้ free_font_files (ฟอนต์ฟรี)
-- ตรรกะต้องตรงกับ src/lib/font-meta.ts ฝั่ง client เป๊ะ ๆ
with src as (
  select f.id as font_id,
         case
           when coalesce(array_length(p.full_font_files, 1), 0) > 0 then p.full_font_files
           else coalesce(f.free_font_files, '{}')
         end as paths
  from public.fonts f
  left join public.font_files_private p on p.font_id = f.id
),
parsed as (
  select s.font_id,
         -- ชื่อไฟล์ = ส่วนสุดท้ายของ path (ตัด query string ออกก่อน)
         regexp_replace(split_part(path, '?', 1), '^.*/', '') as filename
  from src s, unnest(s.paths) as path
),
bits as (
  select font_id,
         upper(regexp_replace(filename, '^.*\.', '')) as ext,
         -- ชื่อ style = ส่วนหลัง "-" ตัวสุดท้าย (ไม่มี "-" ถือว่า Regular)
         case
           when regexp_replace(filename, '\.[^.]+$', '') like '%-%'
             then regexp_replace(regexp_replace(filename, '\.[^.]+$', ''), '^.*-', '')
           else 'Regular'
         end as style_name
  from parsed
  where upper(regexp_replace(filename, '^.*\.', '')) <> 'ZIP'
),
agg as (
  select font_id,
         count(distinct lower(coalesce(
           nullif(regexp_replace(style_name, '(italic|oblique)', '', 'gi'), ''),
           'Regular'
         )))                              as weights,
         count(distinct lower(style_name)) as styles,
         array_agg(distinct ext order by ext) as fmts
  from bits
  group by font_id
)
update public.fonts f
set weight_count = a.weights,
    style_count  = a.styles,
    formats      = a.fmts
from agg a
where a.font_id = f.id;
