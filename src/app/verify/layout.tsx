import type { Metadata } from "next";

// page.tsx เป็น client component (อ่าน searchParams) จึง export metadata เองไม่ได้
export const metadata: Metadata = {
  title: "ตรวจสอบสิทธิการใช้งานฟอนต์ — DHAMMADHA STUDIO",
  description: "ตรวจสอบว่าไฟล์ฟอนต์ที่คุณถืออยู่มาจากคำสั่งซื้อจริงบน dhammadha.com",
};

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
