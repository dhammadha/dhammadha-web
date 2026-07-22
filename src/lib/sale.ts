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

/**
 * โปรร้าน (shop-wide) กับส่วนลดรายฟอนต์ (per-font) เป็นคนละ layer กัน — โปรร้าน
 * มาจากตาราง designer_promotions ส่วนลดรายฟอนต์มาจาก fonts.is_sale/sale_*
 * ระหว่างโปรร้าน active จะ "ชนะแบบไม่มีเงื่อนไข" (ไม่ merge field ข้าม layer)
 * เมื่อโปรร้านหมดอายุ ส่วนลดรายฟอนต์ (ถ้ามี) จะกลับมาแสดงเองอัตโนมัติ
 * การปัดเศษราคา (Math.round) ต้องเกิดที่นี่ที่เดียว — กันราคาที่โชว์กับราคาที่เก็บเงินจริงต่างกัน ฿1
 */

/** โปรร้าน active เมื่อมี shop_discount_percent > 0 และยังไม่พ้น sale_end (end-of-day) */
export function shopSaleActive(
  font: { shop_discount_percent?: number | null; shop_sale_end?: string | null },
  now: number = Date.now()
): boolean {
  if (typeof font.shop_discount_percent !== "number" || font.shop_discount_percent <= 0) return false;
  if (!font.shop_sale_end) return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(font.shop_sale_end);
  const end = m
    ? new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 59).getTime()
    : Date.parse(font.shop_sale_end);
  if (!Number.isNaN(end) && now > end) return false;
  return true;
}

/** รวมผลลัพธ์ทั้งสอง layer เป็นค่าเดียวสำหรับแสดงผล/คิดเงิน — โปรร้านชนะแบบไม่มีเงื่อนไข */
export function effectiveSale(
  font: {
    price?: number | null;
    is_free?: boolean | null;
    is_sale?: boolean | null;
    sale_price?: number | null;
    sale_end?: string | null;
    discount_percent?: number | null;
    sale_label?: string | null;
    shop_discount_percent?: number | null;
    shop_sale_end?: string | null;
  },
  now: number = Date.now()
): { active: boolean; discountPercent: number; salePrice: number; saleLabel: string } {
  if (font.is_free || !font.price || font.price <= 0) {
    return { active: false, discountPercent: 0, salePrice: 0, saleLabel: "" };
  }
  if (shopSaleActive(font, now)) {
    return {
      active: true,
      discountPercent: font.shop_discount_percent!,
      salePrice: Math.round(font.price * (1 - font.shop_discount_percent! / 100)),
      saleLabel: `ลด ${font.shop_discount_percent}%`,
    };
  }
  if (isSaleActive(font, now)) {
    return {
      active: true,
      discountPercent: font.discount_percent ?? 0,
      salePrice: font.sale_price ?? 0,
      saleLabel: font.sale_label || "Sale",
    };
  }
  return { active: false, discountPercent: 0, salePrice: 0, saleLabel: "" };
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
