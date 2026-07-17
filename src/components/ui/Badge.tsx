import { cn } from "@/lib/cn";

/**
 * Badge — ป้ายเหลี่ยม (docs/design/DESIGN.md §6.2, §4.1)
 *
 * ของเดิมเป็น pill (`rounded-full`) กระจายอยู่หลายที่ด้วยสีดิบ:
 *   FontCard.tsx:79-84  Sale #f0c040/#5a3800 · FREE #5ECEC8 · NEW mint/navy
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

type Variant = "sale" | "free" | "new" | "tag" | "plan";

// สีตามของเดิม แค่เปลี่ยนทรงเป็นเหลี่ยม + ยกคอนทราสต์ตัวหนังสือ
// (รอบแรกไปกุ new = พื้นดำขึ้นมาเอง ทั้งที่ของเดิมเป็น mint — เจ้าของจับได้)
// free กับ new ใช้ mint เหมือนกันตามของเดิม และไม่มีทางโผล่พร้อมกัน
// เพราะ ternary ใน FontCard เลือกอันเดียว: sale → free → new
const VARIANT: Record<Variant, string> = {
  sale: "bg-warning text-black", // เดิม #f0c040/#5a3800 · 11.61:1 ✅
  free: "bg-mint text-black", // เดิม #5ECEC8/white (1.89:1 ตก) → text-black 10.62:1 ✅
  new: "bg-mint text-black", // เดิม mint/navy (8.4:1) → text-black 10.62:1 ✅
  tag: "bg-surface text-grey-600", // 5.74:1 ✅ — ไม่มีเส้นขอบ (§4.1) ใช้พื้น surface แทน
  // ป้ายชื่อแผนในหมวดราคา (ซื้อครั้งเดียว / เร็ว ๆ นี้) — เจ้าของสั่งให้เป็น mint (2026-07-18)
  // พื้น mint เด่นบนการ์ด surface (tag ที่เป็น surface กลืนกับการ์ด) · 10.62:1 ✅
  plan: "bg-mint text-black",
};

export default function Badge({
  variant = "tag",
  className = "",
  children,
}: {
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-heading text-badge leading-none",
        "px-2 py-1",
        VARIANT[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
