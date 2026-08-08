import { cn } from "@/lib/cn";

/**
 * Badge — ป้ายเหลี่ยม (docs/design/DESIGN.md §6.2, §4.1)
 *
 * ของเดิมเป็น pill (`rounded-full`) กระจายอยู่หลายที่ด้วยสีดิบ:
 *   FontCard.tsx:79-84  Sale #f0c040/#5a3800 · FREE/NEW ส้ม #FF4D00 (เดิม mint/navy)
 *   Nav.tsx:247         tag  #f0fffe/#0a8a84
 *   FontDetail.tsx:404  หมวดหมู่ bg-bg/border
 *
 * moodboard (font card.png) ไม่ได้วาดป้ายพวกนี้ไว้ แต่ของจริงมี
 * → เก็บไว้ ทำเป็นเหลี่ยม (ตัดออก = เสียฟังก์ชัน)
 *
 * ขนาด = `badge` (Sans Bold 12) — สไตล์ที่เพิ่มนอกเหนือจาก Figma ตามที่เจ้าของอนุมัติ
 * 12px ต่ำกว่าพื้นล่าง 14px ของ "ข้อความที่ต้องอ่าน" ได้ เพราะป้ายเป็นคำสั้น ๆ
 * ที่จำรูปทรงมากกว่าอ่านทีละคำ (DESIGN.md §2.4, §2.6)
 */

type Variant = "sale" | "free" | "new" | "tag" | "solid";
type Size = "md" | "sm";

// คู่สีของแบรนด์คือ black #080808 + page #F0F0F0 (สองสีเดียวที่โลโก้ลงจริง)
// ป้ายพูดด้วยคู่นี้ ส่วนส้มถอยไปเป็นสีของ hover/สิ่งที่ต้องดึงสายตาจริง ๆ
const VARIANT: Record<Variant, string> = {
  sale: "bg-warning text-black", // เดิม #f0c040/#5a3800 · 11.61:1 ✅ — เหลืองไว้แยก "ราคา" ออกจาก NEW

  // free/new/solid ใช้ค่าเดียวกัน (พื้นดำ อักษรเทา) — คงชื่อแยกไว้เพราะคนละบทบาท
  // ถ้าวันหน้าต้องแยกสีจะแก้ได้ทีละตัวโดยไม่กระทบอีกฝั่ง
  //
  // เคยลองให้ free/new เป็น "เทาพื้น ดำตัว" เพื่อกันปกฟอนต์สีดำกลืนป้าย แต่**เจ้าของเคาะ
  // ให้กลับมาเป็นพื้นดำ** (8 ส.ค. 2569): ปกที่พื้นดำมีน้อย และโอกาสที่ปกจะเป็น #080808
  // ตรงกันเป๊ะยิ่งน้อยกว่า ส่วนเทาพื้นบนปกสว่างกลืนจนอ่านยากซึ่งเจอบ่อยกว่า
  // ทั้งคู่ไม่มีทางโผล่พร้อมกัน — ternary ใน FontCard เลือกอันเดียว: sale → free → new
  free: "bg-black text-page",
  new: "bg-black text-page",

  // ป้ายบทบาทผู้ใช้ + ป้ายสถานะบนการ์ด (บัญชี, สมาชิก) — 17.9:1 ✅
  // ตั้งชื่อ `solid` ไม่ใช่ `role` เพราะ 3 ใน 4 จุดที่ใช้เป็นป้ายสถานะ
  // ("ใช้งานอยู่", "เปิดให้ทดสอบ") ไม่ใช่บทบาทผู้ใช้
  solid: "bg-black text-page",

  // พื้น page เพราะป้ายนี้วางบนการ์ด surface เสมอ — หลังรีแบรนด์ surface = #FFFFFF
  // ถ้าใช้ surface ต่อ ป้ายจะเป็นขาวบนขาว = หายสนิท
  tag: "bg-page text-grey-600", // 5.74:1 ✅ — ไม่มีเส้นขอบ (§4.1) ใช้พื้นต่างระดับแทน
};

// md = ค่าเดิม (badge 12px) · sm = เล็กลงสำหรับป้ายบน FontCard ที่เจ้าของสั่งให้ย่อ (2026-07-18)
// 10px ยังอยู่ในช่วงที่เจ้าของอนุมัติสำหรับป้ายคำสั้น (SALE/FREE/NEW เป็นตัวพิมพ์ใหญ่ อ่านออก · §2.4)
const SIZE: Record<Size, string> = {
  md: "text-badge px-2 py-1",
  // font-bold: ขนาดนี้เป็น text-[[10px]] ตรง ๆ ไม่มีน้ำหนักมากับ step อย่าง text-badge
  // → ต้องประกาศ 700 เอง ไม่งั้นตกไปน้ำหนัก 400 ซึ่ง typedee ไม่ได้ส่งขึ้นเว็บ
  sm: "text-[10px] font-bold px-1.5 py-0.5",
};

export default function Badge({
  variant = "tag",
  size = "md",
  className = "",
  children,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-ui leading-none",
        SIZE[size],
        VARIANT[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
