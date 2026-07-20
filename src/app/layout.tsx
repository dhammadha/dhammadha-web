import type { Metadata } from "next";
import { Noto_Sans_Thai, Noto_Sans_Thai_Looped } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import { FavouritesProvider } from "@/context/FavouritesContext";
import ScrollReset from "@/components/ScrollReset";
import "./globals.css";

// ระบบดีไซน์: docs/design/DESIGN.md §2.1
//
// ละ weight = ประกาศเจตนาว่าใช้ variable font ตรง ๆ
// (เดิมประกาศ 9 static weights ไว้ แต่ next/font resolve ไปที่ variable font ให้อยู่แล้ว
//  → output เท่าเดิมเป๊ะ 70KB/3 subset ไม่ได้ประหยัดอะไรเพิ่ม แค่โค้ดตรงกับความจริง
//  วัดแล้วยืนยัน: build ทั้งสองแบบได้ไฟล์ 26/15/29 KB เหมือนกัน)
//
// subsets: ["thai"] คงเดิม ตัวอักษรละตินยัง fallback ไป system font เหมือนที่เป็นอยู่
// การเพิ่ม "latin" จะเปลี่ยนหน้าตาตัวละตินทั้งเว็บรวม admin = นอกขอบเขตรอบนี้
const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai"],
  display: "swap",
  variable: "--font-noto-thai",
});

// Body — Noto Sans Thai Looped (หัวกลม อ่านสบายกว่าสำหรับเนื้อความ)
// ยังไม่ถูกใช้จนกว่าจะถึง Phase 4+ ที่ component เริ่ม opt-in ผ่าน class `font-body`
// ⚠️ ห้ามสลับ body { font-family } ใน globals.css เป็นตัวนี้ — admin จะเปลี่ยนฟอนต์ตามทั้งหมด
//
// ราคาที่จ่าย: +70KB (woff2, cache ได้, display:swap) — ตระกูลที่สองเพิ่มเท่าตัวจาก 71 → 140KB
// ไม่มีส่วนลดจากการเปลี่ยนไป variable เพราะของเดิมก็เป็น variable อยู่แล้ว (ดูข้างบน)
const notoSansThaiLooped = Noto_Sans_Thai_Looped({
  subsets: ["thai"],
  display: "swap",
  variable: "--font-noto-thai-looped",
});

export const metadata: Metadata = {
  title: "DHAMMADHA STUDIO",
  description: "คลังฟอนต์ภาษาไทยคุณภาพสูง สำหรับนักออกแบบ แบรนด์ และครีเอเตอร์ไทย",
  icons: { icon: "/logo_DHAMMADHA_192px.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4457591147215902"
          crossOrigin="anonymous"
        />
      </head>
      {/* sticky footer — หน้าที่เนื้อหาสั้น (เช่น /verify) footer ต้องอยู่ติดขอบล่างจอ
          ไม่ใช่ลอยขึ้นมากลางจอ · คู่กับ `mt-auto` ที่ <footer> ใน Footer.tsx
          min-h-screen ทำให้ body สูงอย่างน้อยเต็มจอ แต่ยังยืดตามเนื้อหาได้เมื่อเนื้อยาว
          → ไม่มีการบีบ flex item เพราะ container ไม่เคยถูกจำกัดความสูง */}
      <body className={`${notoSansThai.variable} ${notoSansThaiLooped.variable} min-h-screen flex flex-col`}>
        <ScrollReset />
        <AuthProvider>
          <FavouritesProvider>{children}</FavouritesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
