-- ลบคอลัมน์ obfuscated tester pipeline ทิ้ง — เป็นช่องโหว่ความปลอดภัย
-- make_tester() (เดิมใน src/lib/font-pipeline.ts) สลับเฉพาะ cmap table ไม่ได้ subset glyph จริง
-- ทำให้ไฟล์ tester .woff2 ที่อัปโหลดขึ้น public bucket fonts-demo เป็นฟอนต์เต็ม 100%
-- และ fonts.obfuscated_map (คีย์ถอดรหัส) ที่ anon อ่านได้ ทำให้ใครก็แกะกลับด้วย fontTools
-- ได้ฟอนต์เต็มฟรีโดยไม่ต้องซื้อ — ข้าม payment/entitlement/watermark ทั้งหมด
-- ปัจจุบัน type tester ใช้ render-tester Edge Function เรนเดอร์ PNG ฝั่ง server แทนแล้ว
-- โค้ดฝั่ง client ที่ใช้สองคอลัมน์นี้ถูกลบออกแล้ว (FontForm, font-review, FontCard)

alter table public.fonts
  drop column if exists obfuscated_map,
  drop column if exists obfuscated_font_files;
