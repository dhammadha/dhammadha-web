/**
 * ตรรกะแบ่งรายได้ subscription รายเดือน — pure (ไม่ผูก React/Supabase)
 * รับ output ของ RPC subscription_month_data (0048) มาแปลงเป็นยอดเงินต่อ designer
 *
 * โมเดล (ยืนยันกับ user 2026-07-12):
 *   revenue เดือนนั้น → เว็บ 50% | equal pool 15% | stream pool 35%
 *   - equal pool  ÷ จำนวนฟอนต์ opt-in → เจ้าของฟอนต์ (ทุกฟอนต์เท่ากัน)
 *   - stream pool แบ่งตาม stream_share (RPC normalize แบบ user-centric มาแล้ว
 *     — subscriber แต่ละคนน้ำหนัก 1 เท่ากัน sum(stream_share) = 1 เมื่อมีคนสตรีม)
 *   - ฟอนต์ opt-out กลางเดือนแต่มีสตรีม (orphan) → ยังรับส่วน stream ให้เจ้าของ
 *   - equal pool คิดจาก snapshot ฟอนต์ opt-in ณ เวลาคำนวณเท่านั้น
 *   - ส่วนที่แบ่งไม่หมด (ไม่มีฟอนต์/ไม่มีคนสตรีม) ตกเป็นของแพลตฟอร์ม
 *   - เดือนทดสอบ revenue = 0 → ทุกยอด 0 แต่สัดส่วน/font-days ยังแสดงจริง
 */

export const SPLIT = { web: 0.5, equal: 0.15, stream: 0.35 } as const;

export type FontEntry = {
  font_id: string;
  name: string | null;
  owner_id: string;
  stream_share: number; // 0..1 (รวมทุกฟอนต์ = 1 เมื่อมีคนสตรีม)
  font_days: number;
};

export type MonthData = {
  year: number;
  month: number;
  revenue: number;
  subscriber_count: number;
  contributing_users: number;
  opted_fonts: FontEntry[];
  orphan_stream: FontEntry[];
};

export type FontShare = {
  fontId: string;
  name: string | null;
  ownerId: string;
  optedIn: boolean; // false = orphan (opt-out แล้วแต่ยังมีสตรีม)
  equalAmount: number;
  streamAmount: number;
  total: number;
  streamShare: number;
  fontDays: number;
};

export type DesignerSlice = {
  ownerId: string;
  equal: number;
  stream: number;
  total: number;
  fonts: FontShare[];
};

export type SubMonthStatement = {
  year: number;
  month: number;
  revenue: number;
  subscriberCount: number;
  contributingUsers: number;
  webAmount: number; // 50% (nominal)
  equalPool: number; // 15% (nominal)
  streamPool: number; // 35% (nominal)
  optedCount: number;
  fonts: FontShare[]; // opt-in + orphan รวมกัน
  byDesigner: Map<string, DesignerSlice>;
  designerTotal: number; // รวมที่จ่ายให้ designer ทั้งหมด (ปัดแล้ว)
  platformAmount: number; // ส่วนที่เว็บเก็บ = revenue - designerTotal (รวม web 50% + pool แบ่งไม่หมด + เศษปัด)
};

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildSubMonthStatement(data: MonthData): SubMonthStatement {
  const revenue = data.revenue || 0;
  const webAmount = round2(revenue * SPLIT.web);
  const equalPool = round2(revenue * SPLIT.equal);
  const streamPool = round2(revenue * SPLIT.stream);

  const opted = data.opted_fonts ?? [];
  const orphans = data.orphan_stream ?? [];
  const optedCount = opted.length;
  const equalPerFont = optedCount > 0 ? (revenue * SPLIT.equal) / optedCount : 0;

  const fonts: FontShare[] = [];

  for (const f of opted) {
    const equalAmount = round2(equalPerFont);
    const streamAmount = round2(revenue * SPLIT.stream * f.stream_share);
    fonts.push({
      fontId: f.font_id,
      name: f.name,
      ownerId: f.owner_id,
      optedIn: true,
      equalAmount,
      streamAmount,
      total: round2(equalAmount + streamAmount),
      streamShare: f.stream_share,
      fontDays: f.font_days,
    });
  }

  for (const f of orphans) {
    const streamAmount = round2(revenue * SPLIT.stream * f.stream_share);
    fonts.push({
      fontId: f.font_id,
      name: f.name,
      ownerId: f.owner_id,
      optedIn: false,
      equalAmount: 0,
      streamAmount,
      total: streamAmount,
      streamShare: f.stream_share,
      fontDays: f.font_days,
    });
  }

  // จัดกลุ่มต่อ designer เจ้าของฟอนต์
  const byDesigner = new Map<string, DesignerSlice>();
  for (const fs of fonts) {
    let slice = byDesigner.get(fs.ownerId);
    if (!slice) {
      slice = { ownerId: fs.ownerId, equal: 0, stream: 0, total: 0, fonts: [] };
      byDesigner.set(fs.ownerId, slice);
    }
    slice.equal = round2(slice.equal + fs.equalAmount);
    slice.stream = round2(slice.stream + fs.streamAmount);
    slice.total = round2(slice.total + fs.total);
    slice.fonts.push(fs);
  }

  const designerTotal = round2(
    Array.from(byDesigner.values()).reduce((sum, s) => sum + s.total, 0)
  );
  // แพลตฟอร์มเก็บส่วนที่เหลือ = web 50% + pool ที่แบ่งไม่หมด + เศษปัด (ให้ยอดรวม reconcile)
  const platformAmount = round2(revenue - designerTotal);

  return {
    year: data.year,
    month: data.month,
    revenue,
    subscriberCount: data.subscriber_count || 0,
    contributingUsers: data.contributing_users || 0,
    webAmount,
    equalPool,
    streamPool,
    optedCount,
    fonts,
    byDesigner,
    designerTotal,
    platformAmount,
  };
}

/** ตัดเฉพาะส่วนของ designer คนเดียว (หน้า /designer/revenue) — null ถ้าไม่มีส่วนแบ่ง */
export function designerSlice(stmt: SubMonthStatement, designerId: string): DesignerSlice | null {
  return stmt.byDesigner.get(designerId) ?? null;
}
