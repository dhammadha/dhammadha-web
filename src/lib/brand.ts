// จุดเดียวที่นิยามชื่อและโดเมนของ "แพลตฟอร์ม" — เปลี่ยนชื่อแบรนด์ = แก้ไฟล์นี้ไฟล์เดียว
//
// ทำไมต้องมีไฟล์นี้: เดิมชื่อ/โดเมน/อีเมลกระจายอยู่ ~33 ไฟล์ (metadata ทุกหน้า, Nav, Footer,
// email-service, sitemap, checkout) การเปลี่ยนชื่อแพลตฟอร์มจึงต้องไล่แก้ทีละจุดและพลาดง่าย
//
// ⚠️ ต้องไม่ import อะไรเลย — `email-service.ts` ที่ใช้ไฟล์นี้ถูกเรียกจากทั้ง
// Cloudflare Pages Function และ Next.js route handler จึงต้อง framework-free
// (ดูหัวไฟล์ `email-service.ts`) ห้ามเพิ่ม import จาก next/* หรือ node:*
//
// ⚠️ ไฟล์นี้ครอบเฉพาะ "แพลตฟอร์ม" ไม่ครอบสองอย่างนี้:
//   1. Dhammadha Studio ในฐานะ foundry เจ้าหนึ่งที่ขายบนแพลตฟอร์ม (ชื่อร้าน/slug/โซเชียลของสตูดิโอ)
//   2. นิติบุคคลผู้เป็นคู่สัญญาในหน้าเอกสารกฎหมาย → ใช้ `LEGAL_ENTITY` ซึ่ง**ไม่เปลี่ยนตาม
//      ชื่อทางการค้า** เพราะสัญญา/ใบเสร็จยังออกในนามนิติบุคคลเดิม
//
// ⚠️ Edge Function `supabase/functions/download-font/` เป็น Deno รันคนละ runtime
// import ไฟล์นี้ไม่ได้ → มีค่าคงที่ของตัวเองที่ต้องแก้คู่กันเสมอ (ดูคอมเมนต์ในไฟล์นั้น)

/** ชื่อแพลตฟอร์มแบบเต็ม ใช้ใน <title>, หัวอีเมล, ชื่อผู้ส่ง */
export const NAME = "DHAMMADHA STUDIO";

/** ชื่อสั้นสำหรับ wordmark ใน Nav / admin sidebar */
export const SHORT_NAME = "DHAMMADHA";

/**
 * บรรทัดที่สองของ wordmark ใน Nav (ตัวเล็กสีเทาใต้ SHORT_NAME ตาม moodboard)
 * ถ้าชื่อแบรนด์ใหม่เป็นคำเดียวไม่มีสร้อย ให้ตั้งเป็น "" แล้ว Nav จะไม่ render บรรทัดนี้เลย
 */
export const WORDMARK_SUB = "STUDIO";

/** โดเมนเปล่า ไม่มี protocol — ใช้ในเนื้อความ ("ซื้อผ่าน dhammadha.com") และ mailto */
export const DOMAIN = "dhammadha.com";

/**
 * URL หลักของเว็บ (canonical) — ใช้ทั้ง sitemap และลิงก์ในอีเมล
 *
 * หมายเหตุ: ก่อนรวมไฟล์นี้ sitemap ใช้ `https://www.` แต่ลิงก์ในอีเมลใช้แบบไม่มี www
 * ปนกันอยู่ ตอนนี้ยึด www ตาม sitemap (ตัวที่ถือ canonical จริง) ลิงก์อีเมลจึงเปลี่ยน
 * จาก non-www → www ซึ่ง redirect ได้อยู่แล้ว ไม่กระทบผู้ใช้
 */
export const URL = `https://www.${DOMAIN}`;

/** อีเมลติดต่อที่แสดงต่อสาธารณะ */
export const CONTACT_EMAIL = `info@${DOMAIN}`;

/** ผู้ส่งอีเมลระบบ (Resend) — โดเมนนี้ต้องผ่าน DNS verification ใน Resend ก่อนใช้ */
export const FROM_EMAIL = `${NAME} <noreply@${DOMAIN}>`;

/** โลโก้ใน /public — ใช้เป็น favicon, Nav, Footer */
export const LOGO_SRC = "/logo_DHAMMADHA_192px.png";

/**
 * นิติบุคคลผู้ให้บริการ — ปรากฏในหน้าเอกสารกฎหมายว่า "ดำเนินการโดย ..."
 * **ไม่ใช่ชื่อทางการค้า** ถ้าเปลี่ยนชื่อแพลตฟอร์ม ค่านี้ยังคงเดิมจนกว่าจะจดนิติบุคคลใหม่
 */
export const LEGAL_ENTITY = "ธรรมดาสตูดิโอ";

/** ปีที่เริ่มดำเนินการ — ใช้ในบรรทัดลิขสิทธิ์ท้ายเว็บ */
export const FOUNDED_YEAR = 2012;

/**
 * โซเชียลของ **Dhammadha Studio (สตูดิโอ)** ไม่ใช่ของแพลตฟอร์ม
 * ตอนแยกแบรนด์ต้องตัดสินใจว่าจะเปิดบัญชีใหม่ให้แพลตฟอร์มหรือใช้ของเดิมต่อ
 */
export const SOCIAL = {
  facebook: "https://www.facebook.com/dhammadha",
  instagram: "https://www.instagram.com/dhammadha",
  tiktok: "https://www.tiktok.com/@dhammadha",
  line: "@dhammadha",
} as const;

/**
 * ประกอบ <title> ของหน้าย่อยให้เป็นรูปแบบเดียวกันทั้งเว็บ
 * `pageTitle("ตะกร้า")` → "ตะกร้า — DHAMMADHA STUDIO"
 */
export function pageTitle(page: string): string {
  return `${page} — ${NAME}`;
}
