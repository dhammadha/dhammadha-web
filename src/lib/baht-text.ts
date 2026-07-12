/**
 * แปลงจำนวนเงินเป็นข้อความภาษาไทย เช่น 1500 → "หนึ่งพันห้าร้อยบาทถ้วน"
 * รองรับสตางค์ เช่น 4510.5 → "สี่พันห้าร้อยสิบบาทห้าสิบสตางค์"
 * ใช้ร่วมกันระหว่าง PrintLightbox (พรีวิว/พิมพ์) และ quote-doc (สร้าง PDF)
 * — แยกไฟล์เพื่อไม่ให้ PrintLightbox ต้องลาก pdf-lib เข้า bundle หลัก
 */
const DIGITS = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const POSITIONS = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

/**
 * แปลงจำนวนเต็ม (ไม่ติดลบ) เป็นคำอ่านภาษาไทย โดยไม่มีหน่วย "บาท"/"สตางค์" ต่อท้าย
 * ใช้ร่วมกันทั้งสำหรับส่วนบาทและส่วนสตางค์
 */
function numberToThaiWords(num: number): string {
  if (num === 0) return "";
  const str = num.toString();
  let result = "";
  for (let i = 0; i < str.length; i++) {
    const d = parseInt(str[i]);
    const pos = str.length - i - 1;
    if (d === 0) continue;
    if (pos === 0 && d === 1 && str.length > 1) result += "เอ็ด";
    else if (d === 1 && pos === 1) result += "สิบ";
    else if (d === 2 && pos === 1) result += "ยี่สิบ";
    else result += DIGITS[d] + POSITIONS[pos];
  }
  return result;
}

export function bahtText(amount: number): string {
  let baht = Math.floor(amount);
  let satang = Math.round((amount - Math.floor(amount)) * 100);
  if (satang >= 100) {
    satang -= 100;
    baht += 1;
  }

  const bahtWords = baht === 0 ? "ศูนย์" : numberToThaiWords(baht);

  if (satang === 0) return `${bahtWords}บาทถ้วน`;

  const satangWords = numberToThaiWords(satang);
  return `${bahtWords}บาท${satangWords}สตางค์`;
}
