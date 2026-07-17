// อ่าน weight / style / format จาก "ข้างในไฟล์ฟอนต์" ไม่ใช่จากชื่อไฟล์
//
// ทำไมไม่เดาจากชื่อไฟล์: ชื่อไฟล์ไม่มีมาตรฐาน แต่ละ designer ตั้งคนละแบบ
// ตัวอย่างจริงที่ทำให้ parser เดิมพังทั้งชุด (ฟอนต์ Bangkok):
//   bangkok_bold-italic_v1-0.ttf   ← "-" ใช้ทั้งบอก italic และอยู่ใน v1-0
//   bangkok-decor_bold_v1-0.ttf    ← "-" ยังใช้ในชื่อตระกูลย่อยอีก
// parser เดิม (ตัดที่ "-" ตัวสุดท้าย) อ่านได้ "0" ทุกไฟล์ → 1 weight / 1 style
//
// วิธีที่ถูก: อ่านตาราง metadata ที่ designer ใส่มาในไฟล์เอง ซึ่งเป็นตัวเดียวกับที่
// ระบบปฏิบัติการใช้ตอนแสดงรายชื่อฟอนต์ใน Illustrator/Word
//   name table ID 16/1  → ชื่อตระกูล  เช่น "Bangkok Decor"
//   name table ID 17/2  → ชื่อ style   เช่น "Bold Italic"
//   OS/2.usWeightClass  → น้ำหนักเป็นตัวเลข 400/700
//   OS/2.fsSelection    → เอียงหรือไม่
// ชื่อไฟล์จะเป็นอะไรก็ได้ ผลลัพธ์เหมือนเดิม
//
// ใช้ @pdf-lib/fontkit ซึ่งเป็น dependency ที่มีอยู่แล้ว (quote-doc.ts ใช้ทำ PDF)
// ไม่ต้องพึ่ง Pyodide (~10MB) ที่ใช้สร้าง Demo
//
// กติกาการนับ (ยืนยันกับ user):
//   weights = usWeightClass ที่ไม่ซ้ำ                → Bangkok = {400,700} = 2
//   styles  = คู่ (ตระกูล + style) ที่ไม่ซ้ำ          → Bangkok = 12 (เท่าจำนวนไฟล์ที่ลูกค้าได้)
//   formats = นามสกุลที่ไม่ซ้ำ ไม่นับ .zip           → OTF, TTF
//   ไฟล์ .otf กับ .ttf ของ style เดียวกัน = style เดียว ต่างแค่ format

import fontkit from "@pdf-lib/fontkit";

export interface FontFileMeta {
  filename: string;
  /** ชื่อตระกูลจาก name table เช่น "Bangkok Decor" */
  family: string | null;
  /** ชื่อ style จาก name table เช่น "Bold Italic" */
  subfamily: string | null;
  /** OS/2.usWeightClass เช่น 400, 700 */
  weightClass: number | null;
  italic: boolean;
  /** นามสกุลตัวใหญ่ เช่น "OTF" */
  format: string;
  /** อ่าน metadata ที่จำเป็นได้ครบไหม (ถ้าไม่ ต้องให้ designer กรอกเอง) */
  ok: boolean;
}

export interface FontMetaSummary {
  weightCount: number;
  styleCount: number;
  formats: string[];
  /** ชื่อไฟล์ที่อ่าน metadata ไม่ได้ — ต้องเตือน designer */
  failed: string[];
  /** ชื่อตระกูลที่เจอ (ไว้แสดงให้ designer ยืนยัน เช่น Bangkok มี 5 ตระกูลย่อย) */
  families: string[];
}

function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toUpperCase();
}

type FontkitFont = {
  familyName?: string;
  subfamilyName?: string;
  "OS/2"?: { usWeightClass?: number; fsSelection?: { italic?: boolean } };
  head?: { macStyle?: { italic?: boolean } };
};

/** อ่าน metadata จากไฟล์ฟอนต์ 1 ไฟล์ — ไม่ throw คืน ok:false แทนถ้าอ่านไม่ได้ */
export async function readFontFileMeta(file: File): Promise<FontFileMeta> {
  const base: FontFileMeta = {
    filename: file.name,
    family: null,
    subfamily: null,
    weightClass: null,
    italic: false,
    format: extOf(file.name),
    ok: false,
  };
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const parsed = fontkit.create(bytes) as unknown as FontkitFont & { fonts?: FontkitFont[] };
    // .ttc เป็น collection — เอาตัวแรกพอ (ในทางปฏิบัติ designer ไม่ค่อยส่ง ttc)
    const font = parsed.fonts?.length ? parsed.fonts[0] : parsed;

    const family = font.familyName?.trim() || null;
    const subfamily = font.subfamilyName?.trim() || null;
    const weightClass = font["OS/2"]?.usWeightClass ?? null;
    const italic = !!(font["OS/2"]?.fsSelection?.italic ?? font.head?.macStyle?.italic);

    return {
      ...base,
      family,
      subfamily,
      weightClass,
      italic,
      // ต้องมีครบทั้ง 3 ถึงจะนับได้ถูก — ขาดอย่างใดอย่างหนึ่งถือว่าอ่านไม่ผ่าน
      ok: !!family && !!subfamily && typeof weightClass === "number",
    };
  } catch {
    return base;
  }
}

/** สรุป weight/style/format จาก metadata ของทุกไฟล์ */
export function summarizeFontMeta(metas: FontFileMeta[]): FontMetaSummary {
  const usable = metas.filter((m) => m.ok && m.format !== "ZIP");
  const weights = new Set(usable.map((m) => m.weightClass));
  const styles = new Set(usable.map((m) => `${m.family}|${m.subfamily}`.toLowerCase()));
  const families = [...new Set(usable.map((m) => m.family!))].sort();
  const formats = [...new Set(metas.filter((m) => m.format && m.format !== "ZIP").map((m) => m.format))].sort();
  return {
    weightCount: weights.size,
    styleCount: styles.size,
    formats,
    failed: metas.filter((m) => !m.ok && m.format !== "ZIP").map((m) => m.filename),
    families,
  };
}

/** อ่านหลายไฟล์พร้อมกันแล้วสรุป */
export async function readFontMetaSummary(files: File[]): Promise<FontMetaSummary> {
  const metas = await Promise.all(files.map(readFontFileMeta));
  return summarizeFontMeta(metas);
}
