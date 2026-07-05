import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-noto-thai",
});

export const metadata: Metadata = {
  title: "DHAMMADHA STUDIO",
  description: "คลังฟอนต์ภาษาไทยคุณภาพสูง สำหรับนักออกแบบ แบรนด์ และครีเอเตอร์ไทย",
  icons: { icon: "/logo_DHAMMADHA_2025_simple.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4457591147215902"
          crossOrigin="anonymous"
        />
      </head>
      <body className={notoSansThai.variable}>{children}</body>
    </html>
  );
}
