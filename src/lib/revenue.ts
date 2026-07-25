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

/**
 * รายการย่อยในคำสั่งซื้อ (ตาราง order_items — migration 0069)
 * มีเฉพาะคำสั่งซื้อ Retail · ใบจากใบเสนอราคาเป็นของนักออกแบบคนเดียวอยู่แล้ว
 * จึงยังใช้ orders.designer_id ตามเดิม
 */
export type OrderItemLite = {
  font_id: string | null;
  designer_id: string | null;
  name: string | null;
  price: number;
  platform_amount: number | null;
  designer_amount: number | null;
};

export type OrderLite = {
  id: string;
  order_no: string;
  /** null ได้เมื่อในใบมีหลายนักออกแบบ (ตะกร้าข้ามร้าน) — ดู order_items */
  designer_id: string | null;
  total_amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  source: string | null; // 'quote' | 'checkout' (order เก่าก่อน Phase 3 อาจเป็น null → ถือเป็น 'quote')
  platform_amount: number | null;
  designer_amount: number | null;
  items: { font_id?: string; name: string; license_type?: string; price: number }[] | null;
  /** แนบมาเมื่อ query ฝั่งหน้าเว็บ embed `order_items(...)` มาด้วย */
  order_items?: OrderItemLite[] | null;
  // ข้อมูลผู้ซื้อ — optional เพราะบางหน้า (admin/payouts) select เฉพาะคอลัมน์ที่ใช้คำนวณยอด
  customer_name?: string | null;
  customer_email?: string | null;
  company_name?: string | null;
};

export type PayoutRow = {
  id: string;
  designer_id: string;
  period_year: number;
  period_quarter: number; // 1-4 (ตั้งแต่ 0064 — เดิมเป็น period_month)
  amount: number;
  note: string | null;
  paid_at: string;
};

type Totals = {
  b2cTotal: number; // ยอดขาย checkout รวม
  platformAmount: number; // ส่วนแบ่งเว็บ (sum platform_amount)
  designerAmount: number; // ส่วนแบ่ง designer ที่ต้องโอน (sum designer_amount)
  b2cCount: number;
  b2bTotal: number; // ยอด quote (รับตรง 100% — ไม่มี payout)
  b2bCount: number;
  orders: OrderLite[]; // orders ของงวดนั้น เรียงใหม่→เก่า
};

export type QuarterStatement = Totals & {
  key: string; // "2026-Q3"
  year: number; // ค.ศ.
  quarter: number; // 1-4
  payout: PayoutRow | null; // บันทึกการโอนของไตรมาสนี้ (ถ้ามี = จ่ายแล้ว)
};

const PLATFORM_RATE_FALLBACK = 0.25; // ต้องตรงกับ create_checkout_order ใน 0033

function quarterKey(year: number, quarter: number): string {
  return `${year}-Q${quarter}`;
}

/** เดือน 1-12 → ไตรมาส 1-4 (Q1 = ม.ค.–มี.ค.) */
export function quarterOfMonth(month: number): number {
  return Math.ceil(month / 3);
}

// เดือนของ order มาจาก paid_at (ถ้ามี) หรือ created_at — ใช้ local time
// ให้ตรงกับวิธีที่หน้าเว็บอื่น ๆ แสดงวันที่ (new Date(...).getFullYear()/getMonth())
function orderMonthParts(order: OrderLite): { year: number; month: number } {
  const d = new Date(order.paid_at ?? order.created_at);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function emptyTotals(): Totals {
  return {
    b2cTotal: 0,
    platformAmount: 0,
    designerAmount: 0,
    b2cCount: 0,
    b2bTotal: 0,
    b2bCount: 0,
    orders: [],
  };
}

/**
 * ส่วนแบ่งที่ designer ได้จาก order หนึ่งใบ — จุดเดียวที่รู้สูตร fallback
 * (designer_amount อาจเป็น null ในข้อมูลผิดปกติ ที่ไม่ควรเกิดจาก create_checkout_order ปกติ)
 * ต้องเรียกผ่านฟังก์ชันนี้เสมอ ห้าม hardcode `* 0.75` ซ้ำ — ที่เขียนเองมักลืม round2
 * แล้วเศษ floating-point จะไหลไปโผล่ใน input จำนวนเงินตอน admin บันทึกจ่าย
 */
export function designerShareOf(order: Pick<OrderLite, "total_amount" | "platform_amount" | "designer_amount">): number {
  const platformAmount = order.platform_amount ?? round2(order.total_amount * PLATFORM_RATE_FALLBACK);
  return order.designer_amount ?? round2(order.total_amount - platformAmount);
}

function addOrder(t: Totals, order: OrderLite): void {
  t.orders.push(order);
  if (order.source === "checkout") {
    const platformAmount = order.platform_amount ?? round2(order.total_amount * PLATFORM_RATE_FALLBACK);
    const designerAmount = designerShareOf(order);
    t.b2cTotal += order.total_amount;
    t.platformAmount += platformAmount;
    t.designerAmount += designerAmount;
    t.b2cCount += 1;
  } else {
    // 'quote' หรือ null → B2B รับตรง ไม่มีส่วนแบ่งเว็บ
    t.b2bTotal += order.total_amount;
    t.b2bCount += 1;
  }
}

// เรียง orders ใหม่→เก่า + ปัดยอดรวมเป็น 2 ตำแหน่ง ณ ต้นทาง
// (กัน floating-point เช่น 186.55+74.25 → 260.79999... หลุดไปโผล่ใน input
// จำนวนเงินตอน admin บันทึกจ่าย แล้วถูกเซฟลง payouts.amount ทั้งอย่างนั้น)
function seal(t: Totals): void {
  t.orders.sort((a, b) => {
    const ta = new Date(a.paid_at ?? a.created_at).getTime();
    const tb = new Date(b.paid_at ?? b.created_at).getTime();
    return tb - ta;
  });
  t.b2cTotal = round2(t.b2cTotal);
  t.platformAmount = round2(t.platformAmount);
  t.designerAmount = round2(t.designerAmount);
  t.b2bTotal = round2(t.b2bTotal);
}

/**
 * สรุปยอดรายไตรมาส + สถานะการโอน — งวดการจ่ายส่วนแบ่งจริงของระบบ
 * (จ่ายทุก 3 เดือน โอนในเดือน ม.ค./เม.ย./ก.ค./ต.ค. ดู payoutMonthFor)
 *
 * ข้อสมมติสำคัญ: ฟังก์ชันนี้ถือว่า orders/payouts ที่ส่งเข้ามาเป็นของ designer
 * คนเดียวกัน (ไม่กรอง designer_id ซ้ำภายในฟังก์ชัน) — หน้า designer ส่ง order
 * ของตัวเองเข้ามาได้ตรง ๆ ส่วนหน้า admin ต้อง groupOrdersByDesigner ก่อน
 * แล้วเรียกฟังก์ชันนี้แยกทีละ designer
 */
export function buildQuarterlyStatements(orders: OrderLite[], payouts: PayoutRow[]): QuarterStatement[] {
  const map = new Map<string, QuarterStatement>();

  for (const order of orders.filter((o) => o.status === "paid")) {
    const { year, month } = orderMonthParts(order);
    const quarter = quarterOfMonth(month);
    const key = quarterKey(year, quarter);
    let stmt = map.get(key);
    if (!stmt) {
      stmt = { key, year, quarter, payout: null, ...emptyTotals() };
      map.set(key, stmt);
    }
    addOrder(stmt, order);
  }

  for (const stmt of map.values()) seal(stmt);

  // จับคู่ payout ตาม (year, quarter) — ถือว่า payouts ทั้งหมดเป็นของ designer นี้แล้ว
  for (const payout of payouts) {
    const key = quarterKey(payout.period_year, payout.period_quarter);
    let stmt = map.get(key);
    if (!stmt) {
      // มี payout แต่ไม่มี order paid ในไตรมาสนั้น (เช่น order ถูกยกเลิกทีหลัง)
      // ยังสร้างแถวไว้ให้เห็นว่ามีการโอนเกิดขึ้น — ไม่งั้นจะค้างใน DB โดยมองไม่เห็น
      stmt = {
        key,
        year: payout.period_year,
        quarter: payout.period_quarter,
        payout: null,
        ...emptyTotals(),
      };
      map.set(key, stmt);
    }
    stmt.payout = payout;
  }

  return Array.from(map.values()).sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
}

/**
 * มุมมองของคำสั่งซื้อใบเดียว **เฉพาะส่วนของนักออกแบบคนหนึ่ง** — ใช้กับใบที่ลูกค้า
 * ซื้อข้ามร้านในตะกร้าเดียว: ยอดรวม/ส่วนแบ่ง/รายการ ถูกตัดเหลือเฉพาะของคนนั้น
 * เพื่อให้ฟังก์ชันคำนวณที่เหลือ (statement/payout/รายงานรายฟอนต์) ทำงานต่อได้
 * เหมือนตอนที่ 1 ใบ = 1 นักออกแบบ
 */
export function orderViewForDesigner(order: OrderLite, designerId: string): OrderLite {
  const mine = (order.order_items ?? []).filter((i) => i.designer_id === designerId);
  if (!mine.length) return order;
  const total = round2(mine.reduce((s, i) => s + i.price, 0));
  const platform = round2(
    mine.reduce((s, i) => s + (i.platform_amount ?? round2(i.price * PLATFORM_RATE_FALLBACK)), 0)
  );
  return {
    ...order,
    designer_id: designerId,
    total_amount: total,
    platform_amount: platform,
    designer_amount: round2(total - platform),
    items: mine.map((i) => ({
      font_id: i.font_id ?? undefined,
      name: i.name ?? "",
      price: i.price,
    })),
    order_items: mine,
  };
}

/**
 * จัดกลุ่ม orders ตามนักออกแบบ
 * - มี order_items → กลุ่มตาม designer ของรายการ (ใบข้ามร้านจะไปโผล่ในหลายกลุ่ม
 *   โดยแต่ละกลุ่มเห็นเฉพาะส่วนของตัวเองผ่าน orderViewForDesigner)
 * - ไม่มี order_items (ใบจากใบเสนอราคา/ข้อมูลเก่า) → ใช้ orders.designer_id
 * - ไม่มีทั้งคู่ → ข้ามใบนั้น
 */
export function groupOrdersByDesigner(orders: OrderLite[]): Map<string, OrderLite[]> {
  const map = new Map<string, OrderLite[]>();
  const push = (designerId: string, order: OrderLite) => {
    const list = map.get(designerId);
    if (list) list.push(order);
    else map.set(designerId, [order]);
  };

  for (const order of orders) {
    const itemDesigners = Array.from(
      new Set((order.order_items ?? []).map((i) => i.designer_id).filter((v): v is string => !!v))
    );
    if (itemDesigners.length > 1) {
      for (const id of itemDesigners) push(id, orderViewForDesigner(order, id));
    } else if (itemDesigners.length === 1) {
      push(itemDesigners[0], order);
    } else if (order.designer_id) {
      push(order.designer_id, order);
    }
  }
  return map;
}

/** ป้ายชื่อเดือนแบบไทย เช่น "กรกฎาคม 2569" (Intl แปลง ค.ศ. → พ.ศ. ให้เอง) */
export function monthLabel(year: number, month: number): string {
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat("th-TH", { year: "numeric", month: "long" }).format(date);
}

const QUARTER_MONTHS = ["ม.ค.–มี.ค.", "เม.ย.–มิ.ย.", "ก.ค.–ก.ย.", "ต.ค.–ธ.ค."];

/** ป้ายชื่อไตรมาสแบบไทย เช่น "ไตรมาส 3/2569 (ก.ค.–ก.ย.)" */
export function quarterLabel(year: number, quarter: number): string {
  const be = new Intl.DateTimeFormat("th-TH", { year: "numeric" }).format(new Date(year, 0, 1));
  return `ไตรมาส ${quarter}/${be} (${QUARTER_MONTHS[quarter - 1] ?? ""})`;
}

/**
 * เดือนที่โอนส่วนแบ่งของไตรมาสนั้น — โอนหลังจบไตรมาส
 * Q1 → เม.ย. · Q2 → ก.ค. · Q3 → ต.ค. · Q4 → ม.ค. ปีถัดไป
 */
export function payoutMonthFor(year: number, quarter: number): { year: number; month: number } {
  return quarter === 4 ? { year: year + 1, month: 1 } : { year, month: quarter * 3 + 1 };
}

/** ไตรมาสนั้นครบรอบโอนแล้วหรือยัง (ถึงเดือนที่ต้องโอนแล้ว) */
export function isPayoutDue(year: number, quarter: number, now = new Date()): boolean {
  const due = payoutMonthFor(year, quarter);
  const nowKey = now.getFullYear() * 12 + now.getMonth() + 1;
  return nowKey >= due.year * 12 + due.month;
}

/** เลยรอบโอนมาแล้วเกิน 1 เดือน (ค้างชำระ) — now > เดือนรอบโอน */
export function isPayoutOverdue(year: number, quarter: number, now = new Date()): boolean {
  const due = payoutMonthFor(year, quarter);
  const nowKey = now.getFullYear() * 12 + now.getMonth() + 1;
  return nowKey > due.year * 12 + due.month;
}

// ── ช่วงเวลา (filter หน้ารายได้/Payouts) ─────────────────────────────────────
// dropdown ตัวเดียว 5 ตัวเลือก: ไตรมาสนี้ / ไตรมาสก่อน / 3 ปีย้อนหลัง

export type Period =
  | { type: "quarter"; year: number; quarter: number }
  | { type: "year"; year: number }
  | { type: "all" };

export function periodKey(p: Period): string {
  if (p.type === "quarter") return `q-${p.year}-${p.quarter}`;
  if (p.type === "year") return `y-${p.year}`;
  return "all";
}

export function periodLabel(p: Period): string {
  if (p.type === "quarter") return quarterLabel(p.year, p.quarter);
  if (p.type === "all") return "ทั้งหมด";
  const be = new Intl.DateTimeFormat("th-TH", { year: "numeric" }).format(new Date(p.year, 0, 1));
  return `ปี ${be}`;
}

/** ตัวเลือก filter: ไตรมาสนี้ · ไตรมาสก่อน (ข้ามปีได้) · 3 ปีย้อนหลัง · ทั้งหมด */
export function periodOptions(now = new Date()): { key: string; label: string; period: Period }[] {
  const y = now.getFullYear();
  const q = quarterOfMonth(now.getMonth() + 1);
  const prev = q === 1 ? { year: y - 1, quarter: 4 } : { year: y, quarter: q - 1 };
  const opts: Period[] = [
    { type: "quarter", year: y, quarter: q },
    { type: "quarter", year: prev.year, quarter: prev.quarter },
    { type: "year", year: y },
    { type: "year", year: y - 1 },
    { type: "year", year: y - 2 },
    { type: "all" },
  ];
  return opts.map((period) => ({ key: periodKey(period), label: periodLabel(period), period }));
}

/**
 * เดือนทั้งหมดในช่วง — ไตรมาส = 3 เดือน, ปี = 12 เดือน (ใช้วน RPC subscription รายเดือน)
 * "ทั้งหมด" คืน [] — ไม่โหลด subscription สำหรับโหมดนี้ (sub=0 · เพิ่มเมื่อ Phase 4.1 live)
 */
export function monthsInPeriod(p: Period): { year: number; month: number }[] {
  if (p.type === "all") return [];
  if (p.type === "year") {
    return Array.from({ length: 12 }, (_, i) => ({ year: p.year, month: i + 1 }));
  }
  const first = (p.quarter - 1) * 3 + 1;
  return [0, 1, 2].map((i) => ({ year: p.year, month: first + i }));
}

/** order อยู่ในช่วงที่เลือกไหม (อิงเดือนของ paid_at/created_at) */
export function orderInPeriod(order: OrderLite, p: Period): boolean {
  if (p.type === "all") return true;
  const { year, month } = orderMonthParts(order);
  if (p.type === "year") return year === p.year;
  return year === p.year && quarterOfMonth(month) === p.quarter;
}

// ── สรุปยอดขายรายฟอนต์ (B2C) ────────────────────────────────────────────────

export type FontSale = {
  fontId: string;
  name: string | null;
  price: number; // ราคาขายจริง ณ ตอนซื้อ (แยกจุดราคา — ปกติ vs ลดราคา คนละแถว)
  qty: number; // จำนวน item ที่ขายที่ราคานี้
  total: number; // price × qty
  designerShare: number; // 75% ของ total
};

/**
 * รวมรายการขาย Retail Font (B2C) จาก order.items[] แยกตาม "จุดราคา"
 * ฟอนต์เดียวที่เคยขายราคาปกติ + ราคาลด จะได้คนละแถว (เหมือนใบเสร็จ MyFonts)
 *
 * ส่วนแบ่ง designer = 75% ของราคา item **เป๊ะ** — เพราะ Retail checkout ใช้ platform
 * rate คงที่ 0.25 ทั้ง create_checkout_order_multi และของเดิม · ใบที่ซื้อข้ามร้าน
 * ต้องส่ง order ที่ผ่าน orderViewForDesigner มาแล้ว (items เหลือเฉพาะของคนนั้น)
 * ยอดจ่ายจริงยังยึด payouts.amount ที่ admin กรอกเอง
 */
export function buildFontSales(orders: OrderLite[]): FontSale[] {
  const map = new Map<string, FontSale>();
  for (const o of orders) {
    if (o.status !== "paid" || o.source !== "checkout") continue;
    for (const it of o.items ?? []) {
      const id = it.font_id;
      if (!id) continue;
      const key = `${id}:${it.price}`;
      let row = map.get(key);
      if (!row) {
        row = { fontId: id, name: it.name ?? null, price: it.price, qty: 0, total: 0, designerShare: 0 };
        map.set(key, row);
      }
      row.qty += 1;
      if (!row.name && it.name) row.name = it.name;
    }
  }
  for (const row of map.values()) {
    row.total = round2(row.price * row.qty);
    row.designerShare = round2(row.total * (1 - PLATFORM_RATE_FALLBACK));
  }
  // เรียงตามชื่อฟอนต์ก่อน แล้วราคามาก→น้อย (จุดราคาของฟอนต์เดียวกันอยู่ติดกัน)
  return Array.from(map.values()).sort((a, b) => {
    const an = a.name ?? "", bn = b.name ?? "";
    return an !== bn ? an.localeCompare(bn) : b.price - a.price;
  });
}

export type FontSaleAgg = { fontId: string; name: string | null; qty: number; total: number; designerShare: number };

/** รวม FontSale หลายจุดราคากลับเป็นรายฟอนต์ (สำหรับสรุป "รายได้ทั้งหมด" ไม่แยกราคา) */
export function aggregateFontSales(sales: FontSale[]): FontSaleAgg[] {
  const map = new Map<string, FontSaleAgg>();
  for (const s of sales) {
    let row = map.get(s.fontId);
    if (!row) { row = { fontId: s.fontId, name: s.name, qty: 0, total: 0, designerShare: 0 }; map.set(s.fontId, row); }
    row.qty += s.qty;
    row.total = round2(row.total + s.total);
    row.designerShare = round2(row.designerShare + s.designerShare);
    if (!row.name && s.name) row.name = s.name;
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
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
