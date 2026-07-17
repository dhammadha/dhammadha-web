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
 * ขนาด = body-sm (14px) ตามพื้นล่างใน §2.4 ไม่ยกเว้น
 * ของเดิมใช้ 9-11px ซึ่งเป็นส่วนหนึ่งของปัญหา "ดูอึดอัด" ที่งานนี้ตั้งใจแก้
 */

type Variant = "sale" | "free" | "new" | "tag";

const VARIANT: Record<Variant, string> = {
  sale: "bg-warning text-black", // 11.61:1 ✅
  free: "bg-mint text-black", // 10.62:1 ✅
  new: "bg-black text-white", // 20.03:1 ✅
  tag: "bg-grey-50 text-grey-600 border border-grey-200", // 5.74:1 ✅
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
        "inline-flex items-center font-heading font-bold text-body-sm leading-none",
        "px-2 py-1 tracking-wide",
        VARIANT[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
