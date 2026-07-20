// โปรโมชั่นรายฟอนต์ — helper กลางใช้ร่วมกันทั้งฝั่งแสดงผล (FontCard / FontDetail /
// หน้ารวม) และฝั่งคิดเงิน (checkout-service) เพื่อให้ราคาที่ลูกค้าเห็นตรงกับที่ถูก
// เรียกเก็บเสมอ — framework-free: ห้าม import อะไรนอกจาก plain TS

/**
 * ส่วนลดรายฟอนต์ active เมื่อ is_sale + มี sale_price และยังไม่พ้นวันสิ้นสุด
 * sale_end เก็บแบบ ISO `yyyy-mm-dd` (จาก `<input type="date">`) — นับให้หมดอายุ
 * เมื่อพ้นสิ้นวันนั้น (23:59:59) ตามเวลาท้องถิ่น
 */
export function isSaleActive(
  font: { is_sale?: boolean | null; sale_price?: number | null; sale_end?: string | null },
  now: number = Date.now()
): boolean {
  if (!font.is_sale || !font.sale_price || font.sale_price <= 0) return false;
  if (font.sale_end) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(font.sale_end);
    const end = m
      ? new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 59).getTime()
      : Date.parse(font.sale_end);
    if (!Number.isNaN(end) && now > end) return false;
  }
  return true;
}

/** วันนี้แบบ ISO `yyyy-mm-dd` ตามเวลาท้องถิ่น — ใช้เป็น min ของ date input / เช็ควันย้อนหลัง */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** แปลง ISO `yyyy-mm-dd` → `dd/mm/yyyy` สำหรับแสดงผล */
export function formatSaleEnd(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}
