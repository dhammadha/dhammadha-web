// ค่าคงที่ + wrapper ช่องกรอกฟอร์มสาธารณะ — แหล่งเดียวของสไตล์ FIELD/LABEL (Phase 10)
//
// เดิมค่าคู่นี้ประกาศซ้ำใน contact/page.tsx กับ verify/page.tsx — พอ Phase 10
// ต้องใช้อีก 8 หน้า (auth ×4, account ×2, quote, subscribe) จึงยกมารวมที่นี่
// (contact/verify ยังใช้สำเนาท้องถิ่นของตัวเอง — ตั้งใจไม่ retrofit หน้า Phase 9
//  ที่ทำงานอยู่แล้วในรอบนี้ ค่อยตามเก็บทีหลัง)

// ตัวอักษรในช่องกรอกต้องเท่ากับช่องค้นหาใน Nav และ ui/Input.tsx เสมอ:
// `font-body text-body-sm` (Looped Light 14) — มาตรฐานเดียวของทั้งโปรเจกต์
// เป็นสตริงเปล่า ๆ ไม่ใช่ component เพราะ cn() เป็นการต่อสตริง ไม่ใช่ tailwind-merge
// → override px/py ผ่าน className ไม่ชัวร์ (บทเรียนเดียวกับ contact/page.tsx)
export const FIELD =
  "w-full bg-surface px-4 py-3 font-body text-body-sm text-black placeholder:text-grey-400 border-none " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black";

// หัวข้อช่องกรอกใช้ UI Text (Sans Bold 16) — ตัวหนา อ่านนำสายตาก่อนช่องกรอก
export const LABEL = "block font-ui text-ui text-black mb-2";

/**
 * Field — label + ช่องกรอก wrapper โง่ ๆ (ไม่มี state ไม่มี logic)
 * กติกา §16.5.2: ไม่มี `*` หลัง label — ช่อง optional เขียน "(ไม่บังคับ)" ต่อท้ายชื่อแทน
 */
export function Field({
  label,
  htmlFor,
  className = "",
  children,
}: {
  label: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className={LABEL}>
        {label}
      </label>
      {children}
    </div>
  );
}
