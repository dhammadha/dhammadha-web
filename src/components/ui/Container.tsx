import { cn } from "@/lib/cn";

/**
 * Container — จัดการความกว้างสูงสุด + padding ตามจอ ที่เดียว (docs/design/DESIGN.md §5.3)
 *
 * ของเดิมเขียน `max-w-site mx-auto px-8` ซ้ำทุกหน้า — px-8 ตายตัวทุกจอ
 * ทำให้มือถือ 375px เหลือพื้นที่จริงแค่ 311px
 *
 *   375  → px-4 (16px) → เหลือ 343px
 *   768  → px-6 (24px)
 *   1280 → px-8 (32px)
 */
export default function Container({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("max-w-site mx-auto px-4 md:px-6 lg:px-8", className)}>{children}</div>;
}
