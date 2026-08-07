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

type Variant = "sale" | "free" | "new" | "tag";
type Size = "md" | "sm";

// สีตามของเดิม แค่เปลี่ยนทรงเป็นเหลี่ยม + ยกคอนทราสต์ตัวหนังสือ
// (รอบแรกไปกุ new = พื้นดำขึ้นมาเอง ทั้งที่ของเดิมเป็น mint — เจ้าของจับได้)
// free กับ new ใช้ส้มเหมือนกัน และไม่มีทางโผล่พร้อมกัน
// เพราะ ternary ใน FontCard เลือกอันเดียว: sale → free → new
const VARIANT: Record<Variant, string> = {
  sale: "bg-warning text-black", // เดิม #f0c040/#5a3800 · 11.61:1 ✅
  // free เคยเป็น "ตัวขาวบนพื้น mint" (1.89:1) ตามที่เจ้าของสั่งเองเมื่อ 4 ส.ค. 2569
  // → รีแบรนด์เฟส 1 พื้นเป็น orange ซึ่ง **ตัวขาวได้แค่ 3.33:1** ยังตก AA อยู่ดี
  // ส่วนตัวดำบนส้มได้ 6.02:1 ✅ จึงพลิกเป็นตัวดำ ทำให้ free กับ new เหมือนกันอีกครั้ง
  // (ทั้งคู่ไม่มีทางโผล่พร้อมกัน — ternary ใน FontCard เลือกอันเดียว)
  free: "bg-orange text-black",
  new: "bg-orange text-black",
  // พื้น page (ไม่ใช่ surface) เพราะป้ายนี้ถูกวางบนการ์ด surface เสมอ —
  // account/page.tsx:80, SubscriptionCard.tsx:60 · หลังรีแบรนด์ surface = #FFFFFF
  // ถ้าใช้ surface ต่อ ป้ายจะเป็นขาวบนขาว = หายสนิท
  tag: "bg-page text-grey-600", // 5.74:1 ✅ — ไม่มีเส้นขอบ (§4.1) ใช้พื้นต่างระดับแทน
};

// md = ค่าเดิม (badge 12px) · sm = เล็กลงสำหรับป้ายบน FontCard ที่เจ้าของสั่งให้ย่อ (2026-07-18)
// 10px ยังอยู่ในช่วงที่เจ้าของอนุมัติสำหรับป้ายคำสั้น (SALE/FREE/NEW เป็นตัวพิมพ์ใหญ่ อ่านออก · §2.4)
const SIZE: Record<Size, string> = {
  md: "text-badge px-2 py-1",
  sm: "text-[10px] px-1.5 py-0.5",
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
        "inline-flex items-center font-heading leading-none",
        SIZE[size],
        VARIANT[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
