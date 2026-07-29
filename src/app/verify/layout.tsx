import type { Metadata } from "next";
import { DOMAIN, pageTitle } from "@/lib/brand";

// page.tsx เป็น client component (อ่าน searchParams) จึง export metadata เองไม่ได้
export const metadata: Metadata = {
  title: pageTitle("ตรวจสอบสิทธิการใช้งานฟอนต์"),
  description: `ตรวจสอบว่าไฟล์ฟอนต์ที่คุณถืออยู่มาจากคำสั่งซื้อจริงบน ${DOMAIN}`,
};

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
