// กติกาเลือกไฟล์ที่จะสตรีมให้สมาชิก subscription
//
// เจ้าของกำหนด (3 ส.ค. 2569): **ถ้าฟอนต์มีทั้ง .otf และ .ttf ให้สตรีม .otf
// ถ้ามีแค่ .ttf ให้ใช้ .ttf**
//
// ทำที่ฝั่ง server ไม่ปล่อยให้แอปเลือก เพราะได้ผลสองต่อ:
//   1. แอปไม่ต้องรู้กติกา — `list` ส่งมาให้แล้วเฉพาะไฟล์ที่ควรสตรีม
//   2. **endpoint ไม่มีวันปล่อยไฟล์ซ้ำซ้อนออกไปเลย** — คลังปัจจุบัน 22 ฟอนต์
//      ลดจาก 284 ไฟล์เหลือ 144 (21 ใน 22 ตัวมีทั้งสองฟอร์แมต)
//
// 🔴 **`list` กับ `download` ต้องเรียกฟังก์ชันนี้ตัวเดียวกันเสมอ** และ `file_index`
// คือ index ของ *ผลลัพธ์ที่กรองแล้ว* ไม่ใช่ของ `full_font_files` ดิบ
// ถ้ากรองแค่ที่ `list` แล้ว `download` ไปอ่าน array ดิบ ผู้ใช้จะขอ index ของ .ttf
// ได้ตรง ๆ แล้วกติกาจะกลายเป็นแค่คำแนะนำ — โปรเจกต์นี้มีแผลจาก "สองสำเนาที่ต้อง
// ตรงกัน" มาแล้วกับ `normalizeTesterText` ของ render-tester

function extOf(path: string): string {
  return path.split(".").pop()?.toLowerCase() ?? "";
}

/**
 * คัดไฟล์ที่จะสตรีม — คืน array ใหม่ที่คงลำดับเดิมไว้ (index อ้างอิงผลลัพธ์นี้)
 *
 * ฟอนต์ที่ไม่มีทั้ง .otf และ .ttf (เช่นมีแต่ไฟล์เว็บ) คืน `[]` โดยตั้งใจ —
 * แอปลงทะเบียนฟอนต์กับ OS ได้เฉพาะสองฟอร์แมตนี้ และตัว stamp ก็รองรับแค่นี้
 */
export function pickStreamFiles(paths: string[] | null | undefined): string[] {
  const all = paths ?? [];
  const otf = all.filter((p) => extOf(p) === "otf");
  if (otf.length) return otf;
  return all.filter((p) => extOf(p) === "ttf");
}
