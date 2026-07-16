// แยก weight / style / format จากชื่อไฟล์ฟอนต์ — ใช้ตอนบันทึกใน FontForm
// แล้วเก็บลง fonts.weight_count / style_count / formats (คอลัมน์สาธารณะ)
//
// ทำไมต้องเก็บเป็นคอลัมน์ ไม่คำนวณตอนแสดงผล: ไฟล์ Full Family อยู่ใน
// font_files_private ซึ่งหน้าสาธารณะอ่านไม่ได้ (ตั้งใจ — ดู 0028/0052)
// หน้า detail จึงคำนวณเองไม่ได้ ต้องคำนวณตอนบันทึกแล้วเก็บไว้
//
// ⚠️ ตรรกะที่นี่ต้องตรงกับ SQL backfill ใน migration 0060 เป๊ะ ๆ
// ถ้าแก้ที่นี่ต้องคิดด้วยว่าข้อมูลเก่าที่ backfill ไปแล้วจะเพี้ยนไหม
//
// กติกา:
//   style  = ส่วนหลัง "-" ตัวสุดท้ายของชื่อไฟล์ (ไม่มี "-" ถือว่า Regular)
//            เช่น KRONN-BoldItalic.otf → "BoldItalic"
//   weight = style ที่ตัด italic/oblique ออก → "Bold"
//   format = นามสกุลไฟล์ตัวใหญ่ ไม่นับ .zip
//
// ไฟล์ .otf กับ .ttf ของ weight เดียวกัน = style เดียวกัน ต่างแค่ format
// → KRONN-Black.otf + KRONN-Black.ttf = 1 weight, 1 style, 2 formats

/** ชื่อไฟล์จาก path หรือ URL (ตัด query string และโฟลเดอร์ออก) */
function filenameOf(pathOrUrl: string): string {
  const noQuery = decodeURIComponent(pathOrUrl).split("?")[0];
  return noQuery.split("/").pop() ?? "";
}

/** นามสกุลตัวใหญ่ เช่น "OTF" — คืน "" ถ้าไม่มีนามสกุล */
function extOf(pathOrUrl: string): string {
  const name = filenameOf(pathOrUrl);
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toUpperCase();
}

/** ชื่อ style จากชื่อไฟล์ เช่น KRONN-BoldItalic.otf → "BoldItalic" */
export function styleNameOf(pathOrUrl: string): string {
  const base = filenameOf(pathOrUrl).replace(/\.[^.]+$/, "");
  const dash = base.lastIndexOf("-");
  return dash === -1 ? "Regular" : base.slice(dash + 1);
}

/** ชื่อ weight = style ที่ตัด italic/oblique ออก เช่น "BoldItalic" → "Bold" */
export function weightNameOf(pathOrUrl: string): string {
  const stripped = styleNameOf(pathOrUrl).replace(/italic|oblique/gi, "");
  return stripped || "Regular";
}

export interface FontMeta {
  /** จำนวน weight ที่ไม่ซ้ำ (ตัด italic ออกแล้ว) */
  weightCount: number;
  /** จำนวน style ที่ไม่ซ้ำ (weight + italic) */
  styleCount: number;
  /** นามสกุลที่ไม่ซ้ำ เรียง A-Z เช่น ["OTF","TTF"] */
  formats: string[];
}

/** สรุป weight/style/format จากรายชื่อไฟล์ฟอนต์ (ข้าม .zip) */
export function computeFontMeta(pathsOrUrls: string[]): FontMeta {
  const files = pathsOrUrls.filter((p) => extOf(p) !== "ZIP" && extOf(p) !== "");
  const weights = new Set(files.map((f) => weightNameOf(f).toLowerCase()));
  const styles = new Set(files.map((f) => styleNameOf(f).toLowerCase()));
  const formats = [...new Set(files.map(extOf))].sort();
  return { weightCount: weights.size, styleCount: styles.size, formats };
}
