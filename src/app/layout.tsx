import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai_Looped } from "next/font/google";
import localFont from "next/font/local";
import { AuthProvider } from "@/context/AuthContext";
import { FavouritesProvider } from "@/context/FavouritesContext";
import { CartProvider } from "@/context/CartContext";
import ScrollReset from "@/components/ScrollReset";
import { NAME as BRAND_NAME, FAVICON_SRC } from "@/lib/brand";
import "./globals.css";

// ระบบดีไซน์: docs/design/DESIGN.md §2.1
// รีแบรนด์เฟส 2 (8 ส.ค. 2569) — เลิกใช้ Noto Sans Thai / Noto Sans Thai Looped ทั้งคู่
//
// เนื้อความ — IBM Plex Sans Thai Looped
// ⚠️ ตระกูลนี้ "ไม่มี" variable font บน Google Fonts (มีแต่ static 100–700)
//    ต่างจาก Noto ของเดิมที่จงใจละ `weight` ไว้เพราะ resolve ไป variable ให้เอง
//    → ที่นี่ต้องประกาศ weight เป็นรายตัว ไม่งั้น build ล้มทันที
//    300 = text-body-sm/footnote/fc-byline · 400 = text-body · 700 = font-bold
// subsets: เพิ่ม "latin" ตามที่เจ้าของเคาะ — เดิมมีแต่ "thai" ทำให้ตัวเลข/ราคา/อีเมล/
//    ชื่อฟอนต์อังกฤษตกไปที่ฟอนต์ของเครื่อง (San Francisco/Segoe UI) คนละหน้าตากันทุกเครื่อง
const plexThaiLooped = IBM_Plex_Sans_Thai_Looped({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "700"],
  display: "swap",
  variable: "--font-plex-looped",
});

// หัวข้อ/ปุ่ม/ป้าย — typedee (ฟอนต์ของเจ้าของเอง · Copyright Montonn Thanaroj)
//
// ⚠️ ส่งขึ้นเว็บแค่ Bold 700 + Black 900 "ไม่ส่ง Regular" เป็นมาตรการกันฟอนต์หลุด
//    (Regular คือน้ำหนักที่ขโมยไปใช้คุ้มที่สุด) → ทุกจุดที่ขอ typedee ที่น้ำหนัก 300/400
//    เบราว์เซอร์จะเลือก 700 ให้เงียบ ๆ ไม่มี error — type scale จึงต้องไม่ขอน้ำหนักอื่น
//    ดู tailwind.config.ts หัวข้อ TYPE SCALE
//
// ⚠️ ไฟล์ต้นฉบับ .otf ห้ามอยู่ใน public/ (เปิดโหลดตรงทาง URL ได้) — เก็บไว้ที่
//    docs/design/typedee.com/font/typedee/ ส่วนที่ส่งขึ้นเว็บคือ .woff2 ใน src/fonts/
//    ซึ่ง next/font/local จะ emit เป็น /_next/static/media/<hash>.woff2 ให้เอง
//    แปลงด้วย fontTools: fsType=4 (Preview & Print) + license string ใน name nameID 13/14
const typedee = localFont({
  src: [
    { path: "../fonts/typedee-Bold.woff2", weight: "700", style: "normal" },
    { path: "../fonts/typedee-Black.woff2", weight: "900", style: "normal" },
  ],
  display: "swap",
  variable: "--font-typedee",
});

export const metadata: Metadata = {
  title: BRAND_NAME,
  description: "คลังฟอนต์ภาษาไทยคุณภาพสูง สำหรับนักออกแบบ แบรนด์ และครีเอเตอร์ไทย",
  icons: { icon: FAVICON_SRC },
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
      <body className={`${typedee.variable} ${plexThaiLooped.variable} min-h-screen flex flex-col`}>
        <ScrollReset />
        <AuthProvider>
          <FavouritesProvider>
            <CartProvider>{children}</CartProvider>
          </FavouritesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
