// Label กลางสำหรับรูปแบบสิทธิ์ใช้งาน (license type)
// - LICENSE_LABEL = fallback ถาวรสำหรับ id เดิม (small_medium/large_agency/extended)
//   ห้ามลบ! แถวเก่าใน quotes/entitlements/orders เก็บ id เหล่านี้ไว้ ถ้าลบใบเสร็จ/PDF/อีเมลเก่าจะโชว์ id ดิบ
// - custom tier ที่เก็บชื่อเป็นข้อความอยู่แล้ว → คืนค่าเดิม (pass-through)
// ใช้แทนการ render license_type ดิบทุกจุด (ตาราง/รายละเอียด/modal/อีเมล/เอกสาร)

export const LICENSE_LABEL: Record<string, string> = {
  small_medium: "บริษัทขนาดเล็ก / กลาง",
  large_agency: "บริษัทขนาดใหญ่ / Ad Agency",
  extended: "สิทธิการใช้งานเพิ่มเติม",
};

export type LicenseTier = {
  id: string;
  name: string;
  desc?: string;
  price: number;
};

// โครงสร้างสิทธิ์ default ของเว็บ (ใช้เมื่อ settings.licensing ว่าง/พัง)
export const DEFAULT_LICENSE_TIERS: LicenseTier[] = [
  {
    id: "small_medium",
    name: "บริษัทขนาดเล็ก / กลาง",
    desc: "ผู้ใช้งานไม่เกิน 10 เครื่อง",
    price: 3500,
  },
  {
    id: "large_agency",
    name: "บริษัทขนาดใหญ่ / Ad Agency",
    desc: "ไม่จำกัดจำนวนเครื่อง",
    price: 7000,
  },
  {
    id: "extended",
    name: "สิทธิการใช้งานเพิ่มเติม",
    desc: "TVC / Digital Video Ad / Film / Identity / Web Font / App Font ฯลฯ",
    price: 20000,
  },
];

// map ของ legacy key (settings.licensing รูปแบบเก่า) → id canonical
const LEGACY_KEY_TO_ID: Record<string, string> = {
  small: "small_medium",
  large: "large_agency",
  extra: "extended",
};

function toPrice(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * อ่านค่า settings row key='licensing' → LicenseTier[]
 * รองรับทั้ง 2 รูปแบบ:
 *  - ใหม่:   { tiers: LicenseTier[] }
 *  - เก่า:   { small: number, large: number, extra: number }
 *  - null/พัง → DEFAULT_LICENSE_TIERS
 */
export function parseLicenseSettings(value: unknown): LicenseTier[] {
  if (!value || typeof value !== "object") return DEFAULT_LICENSE_TIERS;
  const v = value as Record<string, unknown>;

  // รูปแบบใหม่
  if (Array.isArray(v.tiers)) {
    const tiers = (v.tiers as unknown[]).reduce<LicenseTier[]>((acc, raw) => {
      if (!raw || typeof raw !== "object") return acc;
      const t = raw as Record<string, unknown>;
      const id = typeof t.id === "string" ? t.id.trim() : "";
      const name = typeof t.name === "string" ? t.name.trim() : "";
      const price = toPrice(t.price);
      if (!id || !name || price === null) return acc;
      const desc = typeof t.desc === "string" && t.desc.trim() ? t.desc.trim() : undefined;
      acc.push({ id, name, price, ...(desc ? { desc } : {}) });
      return acc;
    }, []);
    return tiers.length ? tiers : DEFAULT_LICENSE_TIERS;
  }

  // รูปแบบเก่า { small, large, extra } → map ลง id canonical (คงชื่อ/คำอธิบาย default)
  const legacy = Object.entries(LEGACY_KEY_TO_ID).reduce<LicenseTier[]>((acc, [key, id]) => {
    const price = toPrice(v[key]);
    if (price === null) return acc;
    const base = DEFAULT_LICENSE_TIERS.find((d) => d.id === id);
    if (!base) return acc;
    acc.push({ ...base, price });
    return acc;
  }, []);
  return legacy.length ? legacy : DEFAULT_LICENSE_TIERS;
}

/**
 * แปลง license_type → ข้อความแสดงผล
 * ลำดับ: tiers ที่ส่งเข้ามา (id → name) → LICENSE_LABEL (legacy) → ค่าดิบ
 * เรียกแบบ argument เดียวได้เหมือนเดิม
 */
export function licenseLabel(
  value: string | null | undefined,
  tiers?: LicenseTier[] | null
): string {
  if (!value) return "";
  const fromTiers = tiers?.find((t) => t.id === value)?.name;
  if (fromTiers) return fromTiers;
  return LICENSE_LABEL[value] ?? value;
}

/**
 * สร้าง id ใหม่สำหรับ tier ที่ admin เพิ่มเอง
 * id ต้องนิ่งถาวร และห้ามอิงจากชื่อ — เปลี่ยนชื่อ tier แล้วแถวเก่าต้องไม่พัง
 */
export function newTierId(): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return `custom_${uuid.replace(/-/g, "").slice(0, 8)}`;
}
