-- ลบ RPC admin_upsert_font ทิ้ง — เลิกใช้แล้ว
--
-- ที่มา: 0053 ลบคอลัมน์ obfuscated_font_files/obfuscated_map ออกจาก fonts แต่ไม่ได้ recreate
-- ฟังก์ชันนี้ ตัวฟังก์ชัน (เวอร์ชัน 0031) จึงยังเขียนลง 2 คอลัมน์ที่ถูกลบ พอ FontForm ฝั่ง admin
-- เรียกจริง (plpgsql late-binding) จึง error: column "obfuscated_font_files" does not exist
--
-- แทนที่จะแพตช์ฟังก์ชัน เรารวม write path ให้ทั้ง admin และ designer เขียนผ่าน RLS ทางเดียวกัน
-- (supabase.from("fonts").insert/update ใน FontForm.tsx) — admin มี policy "admin full access fonts",
-- designer มี "designer insert/update own fonts" อยู่แล้ว ไม่ต้องพึ่ง SECURITY DEFINER ที่ bypass RLS
--
-- ไม่มีใครเรียกฟังก์ชันนี้อีกแล้ว (grep ยืนยัน มีแค่ FontForm ที่เดียว และถูกเปลี่ยนเป็น direct write)

drop function if exists public.admin_upsert_font(uuid, jsonb);
