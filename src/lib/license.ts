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
 * อ่าน designer_license_config.tiers (jsonb ที่ไม่มี type) → LicenseTier[]
 *
 * tier ของ designer ยุคเก่ายังไม่มี id — จึงต้องเลือกว่าจะทำอย่างไรกับตัวที่ id หาย:
 *  - readers (หน้าขอใบเสนอราคา/หน้าฟอนต์/หน้า quotes) → `mintMissingIds: false` (ค่าเริ่มต้น)
 *    ใช้ "ชื่อ" เป็นตัวระบุแทน = พฤติกรรมเดิมเป๊ะ
 *    ⚠️ ห้าม mint id สุ่มตอนอ่านเด็ดขาด — จะได้ id ใหม่ทุกครั้งที่โหลดหน้า ทำให้ใบเสนอราคา
 *    ที่เพิ่งเก็บ id ไปหา tier ไม่เจอในการโหลดครั้งถัดไป
 *  - editor (หน้าราคาของ designer) → `mintMissingIds: true`
 *    แจก id ถาวรแล้วเขียนลง DB ตอนกดบันทึก จากนั้นใบเสนอราคาใหม่จะอ้าง id แทนชื่อ
 */
export function parseDesignerTiers(
  value: unknown,
  opts: { mintMissingIds?: boolean } = {}
): LicenseTier[] {
  if (!Array.isArray(value)) return [];
  return value.reduce<LicenseTier[]>((acc, raw) => {
    if (!raw || typeof raw !== "object") return acc;
    const t = raw as Record<string, unknown>;
    const name = typeof t.name === "string" ? t.name.trim() : "";
    const price = toPrice(t.price);
    if (!name || price === null) return acc;
    const rawId = typeof t.id === "string" ? t.id.trim() : "";
    const id = rawId || (opts.mintMissingIds ? newTierId() : name);
    const desc = typeof t.desc === "string" && t.desc.trim() ? t.desc.trim() : undefined;
    acc.push({ id, name, price, ...(desc ? { desc } : {}) });
    return acc;
  }, []);
}

/**
 * หา tier ที่ตรงกับค่า license_type ที่เก็บไว้ในแถว quotes/orders/entitlements
 *
 * license_type ถูกบันทึกมาแล้ว 3 รูปแบบตามยุค — แถวเก่าห้ามพัง จึงลองตามลำดับ:
 *   1. id           — รูปแบบปัจจุบัน (`small_medium` ของเว็บ / `custom_<hex>` ของ designer)
 *   2. name         — ยุคที่ tier ของ designer ยังไม่มี id เก็บชื่อลงไปตรง ๆ
 *   3. `custom_<N>` — ยุคแรกสุด เก็บ "ลำดับ" ของ tier ในอาร์เรย์
 *
 * ลำดับสำคัญ: id เป็นการ match ตรงตัวจึงต้องมาก่อนเสมอ ไม่งั้น id ใหม่ที่บังเอิญ
 * เป็นตัวเลขล้วน (เช่น custom_12345678) จะไปเข้าเงื่อนไข custom_<N> ผิด ๆ
 */
export function findTier(
  value: string | null | undefined,
  tiers?: LicenseTier[] | null
): LicenseTier | undefined {
  if (!value || !tiers?.length) return undefined;
  const byId = tiers.find((t) => t.id === value);
  if (byId) return byId;
  const byName = tiers.find((t) => t.name === value);
  if (byName) return byName;
  const m = value.match(/^custom_(\d+)$/);
  if (m) return tiers[parseInt(m[1], 10)];
  return undefined;
}

/**
 * แปลง license_type → ข้อความแสดงผล
 * ลำดับ: tiers ที่ส่งเข้ามา (ดู findTier) → LICENSE_LABEL (legacy) → ค่าดิบ
 * เรียกแบบ argument เดียวได้เหมือนเดิม
 */
export function licenseLabel(
  value: string | null | undefined,
  tiers?: LicenseTier[] | null
): string {
  if (!value) return "";
  const fromTiers = findTier(value, tiers)?.name;
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
