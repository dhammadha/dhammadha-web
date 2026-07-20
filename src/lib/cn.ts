/**
 * ต่อ class name เข้าด้วยกัน ตัดค่าที่เป็น falsy ทิ้ง
 *
 *   cn("px-4", isActive && "bg-mint", className)
 *
 * ตั้งใจไม่ลง clsx/cva — cls() ใน components/Button.tsx พิสูจน์มาแล้วว่า
 * การต่อ string เปล่า ๆ พอสำหรับโปรเจกต์นี้ (docs/design/DESIGN.md §1)
 *
 * หมายเหตุ: ไม่ได้ merge class ที่ชนกันแบบ tailwind-merge — class ที่มาทีหลัง
 * ไม่ได้ชนะเสมอไป ลำดับใน CSS ต่างหากที่ตัดสิน เขียน component ให้ไม่ต้องพึ่ง
 * การ override เป็นหลัก
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
