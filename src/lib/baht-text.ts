/**
 * แปลงจำนวนเงินเป็นข้อความภาษาไทย เช่น 1500 → "หนึ่งพันห้าร้อยบาทถ้วน"
 * ใช้ร่วมกันระหว่าง PrintLightbox (พรีวิว/พิมพ์) และ quote-doc (สร้าง PDF)
 * — แยกไฟล์เพื่อไม่ให้ PrintLightbox ต้องลาก pdf-lib เข้า bundle หลัก
 */
export function bahtText(amount: number): string {
  if (amount === 0) return "ศูนย์บาทถ้วน";
  const digits = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const positions = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];
  const str = Math.round(amount).toString();
  let result = "";
  for (let i = 0; i < str.length; i++) {
    const d = parseInt(str[i]);
    const pos = str.length - i - 1;
    if (d === 0) continue;
    if (d === 1 && pos === 1) result += "สิบ";
    else if (d === 2 && pos === 1) result += "ยี่สิบ";
    else result += digits[d] + positions[pos];
  }
  return result + "บาทถ้วน";
}
