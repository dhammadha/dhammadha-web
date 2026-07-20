import type { Metadata } from "next";

// page.tsx เป็น client component (ฟอร์ม + Turnstile) จึง export metadata เองไม่ได้
// → ใส่ผ่าน layout ของ route นี้แทน
export const metadata: Metadata = {
  title: "ติดต่อสอบถาม — DHAMMADHA STUDIO",
  description: "ส่งคำถามเรื่องฟอนต์ สิทธิการใช้งาน หรือใบเสนอราคา ถึงทีมงาน DHAMMADHA STUDIO",
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
