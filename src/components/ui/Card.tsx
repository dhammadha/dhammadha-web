import { cn } from "@/lib/cn";

/**
 * Card — กล่องเหลี่ยม (docs/design/DESIGN.md §6.2, §4.1)
 *
 * ฐานของ FontCard และ pricing card
 * ของเดิม hand-roll กันเองทุกที่ด้วย radius คนละค่า (rounded-lg, rounded-[10px], rounded-xl…)
 *
 * **ไม่มีเส้นขอบ** (§4.1) — ดีไซน์นี้ไม่ใช้เส้นกรอบเลยทุกส่วน
 * แยกตัวจากพื้นหน้าด้วย "พื้นสี" แทน: surface #F8F8F8 ลอยบน body ที่เป็น #FFFFFF
 * → `interactive` ใส่เงาเฉพาะตอน hover ด้วยค่าเดิมของ FontCard (shadow-md)
 */
export default function Card({
  interactive,
  className = "",
  children,
}: {
  /** ใส่ hover state — ใช้กับการ์ดที่กดได้ */
  interactive?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "bg-surface overflow-hidden",
        interactive && "transition-shadow duration-150 ease-base hover:shadow-md",
        className
      )}
    >
      {children}
    </div>
  );
}
