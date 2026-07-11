/**
 * ตรรกะคำนวณรายได้/สรุปยอดรายเดือน ใช้ร่วมกันระหว่างหน้า revenue ของ admin
 * และของ designer — ไฟล์นี้ไม่ผูก React หรือ Supabase (ไม่ import "./supabase")
 * หน้าที่ดึงข้อมูล (orders/payouts) เอง แล้วส่งเข้ามาให้ฟังก์ชันที่นี่คำนวณล้วน ๆ
 *
 * กติกาส่วนแบ่งรายได้ (อ้างอิง 0032/0033):
 * - source = 'checkout' (B2C ผ่าน Stripe) → เว็บหักส่วนแบ่ง 25%, designer ได้ 75%
 *   (platform_amount / designer_amount ถูกบันทึกไว้ ณ เวลาขายใน orders แล้ว)
 * - source = 'quote' หรือ null (B2B ใบเสนอราคา, เงินเข้าบัญชี designer ตรง)
 *   → เว็บไม่หักส่วนแบ่ง ไม่มี payout เกี่ยวข้อง เป็นแค่ยอดข้อมูลประกอบ (informational)
 */

export type OrderLite = {
  id: string;
  order_no: string;
  designer_id: string | null;
  total_amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  source: string | null; // 'quote' | 'checkout' (order เก่าก่อน Phase 3 อาจเป็น null → ถือเป็น 'quote')
  platform_amount: number | null;
  designer_amount: number | null;
  items: { font_id?: string; name: string; license_type?: string; price: number }[] | null;
};

export type PayoutRow = {
  id: string;
  designer_id: string;
  period_year: number;
  period_month: number;
  amount: number;
  note: string | null;
  paid_at: string;
};

export type MonthStatement = {
  key: string; // "2026-07"
  year: number; // ค.ศ.
  month: number; // 1-12
  b2cTotal: number; // ยอดขาย checkout รวม
  platformAmount: number; // ส่วนแบ่งเว็บ (sum platform_amount)
  designerAmount: number; // ส่วนแบ่ง designer ที่ต้องโอน (sum designer_amount)
  b2cCount: number;
  b2bTotal: number; // ยอด quote (รับตรง 100% — ไม่มี payout)
  b2bCount: number;
  payout: PayoutRow | null; // บันทึกการโอนของเดือนนี้ (ถ้ามี = จ่ายแล้ว)
  orders: OrderLite[]; // orders ของเดือนนั้น เรียงใหม่→เก่า
};

const PLATFORM_RATE_FALLBACK = 0.25; // ต้องตรงกับ create_checkout_order ใน 0033

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

// เดือนของ order มาจาก paid_at (ถ้ามี) หรือ created_at — ใช้ local time
// ให้ตรงกับวิธีที่หน้าเว็บอื่น ๆ แสดงวันที่ (new Date(...).getFullYear()/getMonth())
function orderMonthParts(order: OrderLite): { year: number; month: number } {
  const d = new Date(order.paid_at ?? order.created_at);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/**
 * สร้างสรุปยอดรายเดือนจาก orders + payouts
 *
 * ข้อสมมติสำคัญ: ฟังก์ชันนี้ถือว่า orders และ payouts ที่ส่งเข้ามาทั้งหมด
 * เป็นของ designer คนเดียวกัน (ไม่กรอง designer_id ซ้ำภายในฟังก์ชัน) —
 * หน้า designer ส่ง order/payout ของตัวเองเข้ามาได้ตรง ๆ ส่วนหน้า admin
 * ต้อง groupOrdersByDesigner ก่อน แล้วเรียกฟังก์ชันนี้แยกทีละ designer
 */
export function buildMonthlyStatements(orders: OrderLite[], payouts: PayoutRow[]): MonthStatement[] {
  const paidOrders = orders.filter((o) => o.status === "paid");

  const map = new Map<string, MonthStatement>();

  for (const order of paidOrders) {
    const { year, month } = orderMonthParts(order);
    const key = monthKey(year, month);

    let stmt = map.get(key);
    if (!stmt) {
      stmt = {
        key,
        year,
        month,
        b2cTotal: 0,
        platformAmount: 0,
        designerAmount: 0,
        b2cCount: 0,
        b2bTotal: 0,
        b2bCount: 0,
        payout: null,
        orders: [],
      };
      map.set(key, stmt);
    }

    stmt.orders.push(order);

    if (order.source === "checkout") {
      // platform_amount/designer_amount อาจเป็น null ในข้อมูลผิดปกติ (ไม่ควรเกิด
      // จาก create_checkout_order ปกติ) — fallback คำนวณ 25/75 จาก total_amount
      const platformAmount = order.platform_amount ?? round2(order.total_amount * PLATFORM_RATE_FALLBACK);
      const designerAmount = order.designer_amount ?? round2(order.total_amount - platformAmount);
      stmt.b2cTotal += order.total_amount;
      stmt.platformAmount += platformAmount;
      stmt.designerAmount += designerAmount;
      stmt.b2cCount += 1;
    } else {
      // 'quote' หรือ null → B2B รับตรง ไม่มีส่วนแบ่งเว็บ
      stmt.b2bTotal += order.total_amount;
      stmt.b2bCount += 1;
    }
  }

  // เรียง orders ในแต่ละเดือนใหม่→เก่า + ปัดยอดรวมเป็น 2 ตำแหน่ง ณ ต้นทาง
  // (กัน floating-point เช่น 186.55+74.25 → 260.79999... หลุดไปโผล่ใน input
  // จำนวนเงินตอน admin บันทึกจ่าย แล้วถูกเซฟลง payouts.amount ทั้งอย่างนั้น)
  for (const stmt of map.values()) {
    stmt.orders.sort((a, b) => {
      const ta = new Date(a.paid_at ?? a.created_at).getTime();
      const tb = new Date(b.paid_at ?? b.created_at).getTime();
      return tb - ta;
    });
    stmt.b2cTotal = round2(stmt.b2cTotal);
    stmt.platformAmount = round2(stmt.platformAmount);
    stmt.designerAmount = round2(stmt.designerAmount);
    stmt.b2bTotal = round2(stmt.b2bTotal);
  }

  // จับคู่ payout ตาม (year, month) — ถือว่า payouts ทั้งหมดเป็นของ designer นี้แล้ว
  for (const payout of payouts) {
    const key = monthKey(payout.period_year, payout.period_month);
    let stmt = map.get(key);
    if (!stmt) {
      // มี payout แต่ไม่มี order paid ในเดือนนั้น (เช่น order ถูกยกเลิกทีหลัง)
      // ยังสร้างแถวไว้ให้เห็นว่ามีการโอนเกิดขึ้น
      stmt = {
        key,
        year: payout.period_year,
        month: payout.period_month,
        b2cTotal: 0,
        platformAmount: 0,
        designerAmount: 0,
        b2cCount: 0,
        b2bTotal: 0,
        b2bCount: 0,
        payout: null,
        orders: [],
      };
      map.set(key, stmt);
    }
    stmt.payout = payout;
  }

  return Array.from(map.values()).sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
}

/** จัดกลุ่ม orders ตาม designer_id — ข้าม order ที่ designer_id เป็น null */
export function groupOrdersByDesigner(orders: OrderLite[]): Map<string, OrderLite[]> {
  const map = new Map<string, OrderLite[]>();
  for (const order of orders) {
    if (!order.designer_id) continue;
    const list = map.get(order.designer_id);
    if (list) {
      list.push(order);
    } else {
      map.set(order.designer_id, [order]);
    }
  }
  return map;
}

/** ป้ายชื่อเดือนแบบไทย เช่น "กรกฎาคม 2569" (Intl แปลง ค.ศ. → พ.ศ. ให้เอง) */
export function monthLabel(year: number, month: number): string {
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat("th-TH", { year: "numeric", month: "long" }).format(date);
}

/** จัดรูปแบบจำนวนเงินบาท เช่น 1234.5 → "฿1,234.5", 1000 → "฿1,000" (ทศนิยมสูงสุด 2 ตำแหน่ง) */
export function fmtBaht(n: number): string {
  return (
    "฿" +
    n.toLocaleString("th-TH", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
