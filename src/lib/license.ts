// Label กลางสำหรับรูปแบบสิทธิ์ใช้งาน (license type)
// - ค่า enum เริ่มต้น (small_medium/large_agency/extended) → ข้อความไทย
// - custom tier ที่เก็บชื่อเป็นข้อความอยู่แล้ว → คืนค่าเดิม (pass-through)
// ใช้แทนการ render license_type ดิบทุกจุด (ตาราง/รายละเอียด/modal/อีเมล/เอกสาร)

const LICENSE_LABEL: Record<string, string> = {
  small_medium: "บริษัทขนาดเล็ก / กลาง",
  large_agency: "บริษัทขนาดใหญ่ / Ad Agency",
  extended: "สิทธิการใช้งานเพิ่มเติม",
};

export function licenseLabel(value: string | null | undefined): string {
  if (!value) return "";
  return LICENSE_LABEL[value] ?? value;
}
