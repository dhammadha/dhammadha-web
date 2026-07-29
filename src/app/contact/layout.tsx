import type { Metadata } from "next";
import { NAME as BRAND_NAME, pageTitle } from "@/lib/brand";

// page.tsx เป็น client component (ฟอร์ม + Turnstile) จึง export metadata เองไม่ได้
// → ใส่ผ่าน layout ของ route นี้แทน
export const metadata: Metadata = {
  title: pageTitle("ติดต่อสอบถาม"),
  description: `ส่งคำถามเรื่องฟอนต์ สิทธิการใช้งาน หรือใบเสนอราคา ถึงทีมงาน ${BRAND_NAME}`,
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
