// Label กลางสำหรับรูปแบบสิทธิ์ใช้งาน (license type)
// - LICENSE_LABEL = fallback ถาวรสำหรับ id เดิม (small_medium/large_agency/extended)
//   ห้ามลบ! แถวเก่าใน quotes/entitlements/orders เก็บ id เหล่านี้ไว้ ถ้าลบใบเสร็จ/PDF/อีเมลเก่าจะโชว์ id ดิบ
// - custom tier ที่เก็บชื่อเป็นข้อความอยู่แล้ว → คืนค่าเดิม (pass-through)
// ใช้แทนการ render license_type ดิบทุกจุด (ตาราง/รายละเอียด/modal/อีเมล/เอกสาร)

import { EFFECTIVE_DATE } from "./legal";

export const LICENSE_LABEL: Record<string, string> = {
  // `personal` = สิทธิ์ที่ได้จากการซื้อรายฟอนต์บนเว็บ (checkout-service ตั้งค่านี้)
  // ใช้ถ้อยคำเดียวกับ /agreement ข้อ "สิทธิการใช้งานส่วนบุคคล ใช้งานได้เพียงคนเดียว"
  // — ถ้าไม่มีบรรทัดนี้ อีเมลยืนยันคำสั่งซื้อจะโชว์ค่าดิบว่า "personal"
  personal: "สิทธิการใช้งานส่วนบุคคล",
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

/* ── ข้อความสิทธิ์บนเอกสาร (ใบเสนอราคา/ใบแจ้งหนี้/ใบเสร็จ) ──────────────────── */

/**
 * ชื่อฟอนต์ที่จะพิมพ์ลงเอกสาร — `"ชื่อไทย | ชื่ออังกฤษ"`
 * ฟอนต์ที่ยังไม่มีชื่อไทย (name_th ว่างได้) ให้ขึ้นชื่ออังกฤษเดี่ยว ไม่มีขีดคั่นค้าง
 *
 * ⚠️ ผลลัพธ์ถูกตรึงลง quotes.fonts_detail ตอนออกใบ เช่นเดียวกับ licenseDocLines()
 */
export function fontDocName(
  nameEn: string | null | undefined,
  nameTh: string | null | undefined,
  fallback = ""
): string {
  const en = nameEn?.trim() || fallback.trim();
  const th = nameTh?.trim();
  if (th && en && th !== en) return `${th} | ${en}`;
  return th || en;
}

/** บรรทัดแรกของทุกรายการ — คงที่ ไม่ขึ้นกับ tier */
const DOC_LICENSE_HEADLINE = "สิทธิการใช้งาน สำหรับ ห้างร้าน องค์กร และบริษัท";

/**
 * บรรทัดปิดท้ายของ tier "สิทธิการใช้งานเพิ่มเติม" — อ้าง **ข้อ 5** ในหน้า /agreement
 *
 * ⚠️ ผูกกับเลขข้อในหน้า `/agreement` โดยตรง ถ้าเรียงข้อใหม่ต้องแก้ที่นี่คู่กันเสมอ
 * (เดิมอ้าง "ข้อ (3)" — ฉบับ 1 ส.ค. 2569 เพิ่มข้อนิยาม/ผู้รับจ้างช่วงเข้ามาข้างหน้า
 * ทำให้เลื่อนเป็นข้อ 5) เอกสารเก่าที่ตรึงคำว่า "ข้อ (3)" ไว้แล้วจะยังอ้างข้อ 3 ต่อไป
 * ซึ่งถูกต้อง เพราะมันชี้ไปสัญญาฉบับที่มีผลตอนออกใบนั้น
 */
const DOC_EXTENDED_CLAUSE = "พร้อมสิทธิการใช้งานเพิ่มเติม ตาม ข้อ (5) ในสัญญาอนุญาต";

/** บรรทัดสุดท้ายของทุกรายการ — ตรึงว่าใบนี้อยู่ใต้สัญญาอนุญาตฉบับไหน */
const DOC_VERSION_LINE = `ตามสัญญาอนุญาตฉบับ ${EFFECTIVE_DATE}`;

/**
 * tier นี้ "เหมือน default ทุกอย่าง เปลี่ยนแค่ราคา" หรือไม่
 *
 * ใช้ตัดสินว่าจะพิมพ์ข้อความอ้างอิงข้อสัญญาลงเอกสารได้หรือเปล่า — อ้างได้เฉพาะ
 * สิทธิ์ที่เว็บนิยามเอง ห้ามอ้างแทนสิทธิ์ที่ designer ตั้งชื่อ/เขียนคำอธิบายเอง
 *
 * เทียบทั้ง id + name + desc เพราะตอน designer ปิด use_default ตัวแก้ไขราคา
 * seed จาก DEFAULT_LICENSE_TIERS ทั้งชุดโดยคง id เดิมไว้ (ดู OwnPricing.tsx)
 * id อย่างเดียวจึงไม่พอ — แก้ชื่อแล้ว id ยังเป็น extended อยู่
 */
export function isDefaultTier(tier: LicenseTier | undefined | null): boolean {
  if (!tier) return false;
  const base = DEFAULT_LICENSE_TIERS.find((d) => d.id === tier.id);
  if (!base) return false;
  return base.name === tier.name && (base.desc ?? "") === (tier.desc ?? "");
}

/** "ชื่อ (คำอธิบาย)" — ไม่มีคำอธิบายก็เหลือแค่ชื่อ */
function tierLine(tier: LicenseTier): string {
  return tier.desc ? `${tier.name} (${tier.desc})` : tier.name;
}

/**
 * บรรทัดย่อยใต้ชื่อฟอนต์บนเอกสาร
 *
 * ปกติ 2 บรรทัด (หัวข้อ + ชื่อ tier) แต่ "สิทธิการใช้งานเพิ่มเติม" แบบ default
 * เป็นส่วนต่อยอดจากสิทธิบริษัทขนาดใหญ่ จึงได้ 3 บรรทัด: หัวข้อ + สิทธิ์ large_agency
 * + ข้อความอ้างข้อสัญญา
 *
 * ปิดท้ายทุกกรณีด้วยบรรทัดเวอร์ชันสัญญา เพราะข้อความอย่าง "ตาม ข้อ (5) ในสัญญาอนุญาต"
 * ชี้ไปหน้าเว็บที่แก้ได้ — ถ้าไม่ตรึงว่าเป็นฉบับไหน ใบเก่าจะกลายเป็นชี้ไปสัญญาฉบับใหม่
 * ที่ผู้ซื้อไม่เคยตกลงด้วย (ดู /agreement ข้อ 14)
 *
 * ⚠️ ผลลัพธ์ของฟังก์ชันนี้ถูก "ตรึง" ลง quotes.fonts_detail ตอนออกใบเสนอราคา
 * (ดู IssueQuoteModal) เอกสารที่ออกไปแล้วจึงไม่เปลี่ยนตามการแก้ราคา/ชื่อสิทธิ์
 * ภายหลัง — ห้ามเปลี่ยนไปคำนวณสดตอนพิมพ์เด็ดขาด
 */
export function licenseDocLines(
  value: string | null | undefined,
  tiers?: LicenseTier[] | null
): string[] {
  const tier = findTier(value, tiers);
  if (!tier) {
    const label = licenseLabel(value, tiers);
    return label
      ? [DOC_LICENSE_HEADLINE, label, DOC_VERSION_LINE]
      : [DOC_LICENSE_HEADLINE, DOC_VERSION_LINE];
  }

  if (tier.id === "extended" && isDefaultTier(tier)) {
    const large = (tiers ?? []).find((t) => t.id === "large_agency");
    const largeLine = large && isDefaultTier(large)
      ? tierLine(large)
      : tierLine(DEFAULT_LICENSE_TIERS.find((d) => d.id === "large_agency")!);
    return [DOC_LICENSE_HEADLINE, largeLine, DOC_EXTENDED_CLAUSE, DOC_VERSION_LINE];
  }

  return [DOC_LICENSE_HEADLINE, tierLine(tier), DOC_VERSION_LINE];
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
