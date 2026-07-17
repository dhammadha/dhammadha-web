import { cn } from "@/lib/cn";

/**
 * Card — กล่องเหลี่ยม (docs/design/DESIGN.md §6.2, §4.1)
 *
 * ฐานของ FontCard และ pricing card
 * ของเดิม hand-roll กันเองทุกที่ด้วย radius คนละค่า (rounded-lg, rounded-[10px], rounded-xl…)
 *
 * moodboard แทบไม่ใช้เงา ใช้เส้นคั่นกับพื้นต่างระดับแทน (§4.3)
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
        "bg-white border border-grey-200 overflow-hidden",
        interactive && "transition-shadow duration-150 ease-base hover:shadow-md hover:border-grey-400",
        className
      )}
    >
      {children}
    </div>
  );
}
