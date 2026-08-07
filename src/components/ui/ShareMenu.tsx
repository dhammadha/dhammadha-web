"use client";

import { useEffect, useState } from "react";

// เมนูแชร์ใช้ร่วมกัน — เดิมอยู่ใน FontDetail.tsx ตัวเดียว ตอนนี้หน้า "ฟอนต์ของฉัน"
// ก็เรียกใช้ด้วย (variant="text")
//
// getUrl เป็นฟังก์ชัน ไม่ใช่ string เพราะ static export ไม่มี window ตอน prerender —
// เรียกตอนคลิกเท่านั้น

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M15 8.5h-2a1.5 1.5 0 0 0-1.5 1.5v2H15l-.5 3H11.5V21H8.5v-6H7v-3h1.5V9.5A3.5 3.5 0 0 1 12 6h3v2.5z" />
  </svg>
);

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17" cy="7" r="0.8" fill="currentColor" stroke="none" />
  </svg>
);

const LinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M9 15l6-6M10.5 6.5l1-1a3.5 3.5 0 0 1 5 5l-1 1M13.5 17.5l-1 1a3.5 3.5 0 0 1-5-5l1-1" />
  </svg>
);

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <circle cx="18" cy="5" r="2.5" />
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="19" r="2.5" />
    <path d="M8.2 10.7l7.6-4.4M8.2 13.3l7.6 4.4" />
  </svg>
);

const ITEM_CLASS =
  "w-full flex items-center gap-2.5 px-4 py-2.5 font-ui text-ui text-black bg-transparent border-none text-left cursor-pointer hover:bg-orange transition-colors duration-150 ease-base";

const TRIGGER_CLASS = {
  icon: "flex items-center justify-center w-10 h-10 rounded-full bg-surface text-black hover:text-orange-text cursor-pointer border-none transition-colors duration-150 ease-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black",
  // ชุดคลาสเดียวกับปุ่ม "แก้ไข" ในตารางฟอนต์ของฉัน — ให้สูงเท่ากันทั้งแถว
  text: "font-ui text-ui px-2.5 py-1 bg-surface text-black hover:bg-black hover:text-page transition-colors duration-150 ease-base border-none cursor-pointer",
};

export default function ShareMenu({
  getUrl,
  title,
  text,
  variant = "icon",
  label = "แชร์",
}: {
  getUrl: () => string;
  title?: string;
  text?: string;
  variant?: "icon" | "text";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<"link" | "ig" | null>(null);

  async function copyShareLink(kind: "link" | "ig") {
    try {
      await navigator.clipboard.writeText(getUrl());
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // clipboard permission ปฏิเสธ — ปล่อยผ่าน ไม่ต้อง block UI
    }
  }

  // เช็คหลัง mount เท่านั้น — static export ไม่มี navigator ตอน prerender
  //
  // ต้องเช็ค pointer:coarse ด้วย ไม่ใช่แค่ navigator.share: macOS Safari มี navigator.share
  // เหมือนกัน แต่ share sheet ที่เด้งคือของระบบ (AirDrop/Mail/Notes) ไม่มีโซเชียลสักตัว —
  // แย่กว่า dropdown เดิม ส่วนบนมือถือ share sheet มี Facebook/Line/Messenger ครบตามแอปที่ติดตั้ง
  const [canNativeShare, setCanNativeShare] = useState(false);
  useEffect(() => {
    setCanNativeShare(
      typeof navigator !== "undefined" &&
      !!navigator.share &&
      window.matchMedia("(pointer: coarse)").matches
    );
  }, []);

  // มือถือ: เปิด share sheet ของเครื่อง แทน dropdown ที่มีลิงก์ facebook.com/sharer ตรง ๆ
  // ซึ่ง content blocker บน iOS ซ่อนทิ้ง · desktop ใช้ dropdown เดิม
  async function handleShareClick() {
    if (!canNativeShare) { setOpen((v) => !v); return; }
    try {
      await navigator.share({ title, text, url: getUrl() });
    } catch {
      // ผู้ใช้กดยกเลิก share sheet → AbortError ไม่ต้องทำอะไร
    }
  }

  return (
    // hover เปิด submenu เหมือนไอคอนตะกร้า/user ใน Nav.tsx, กดก็เปิดได้ (มือถือ)
    <div
      className="relative"
      onMouseEnter={() => { if (!canNativeShare) setOpen(true); }}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={handleShareClick}
        aria-label="แชร์ฟอนต์นี้"
        aria-expanded={open}
        title="แชร์"
        className={TRIGGER_CLASS[variant]}
      >
        {variant === "icon" ? <ShareIcon /> : label}
      </button>
      {open && (
        <div className="absolute right-0 top-full pt-2 w-56 z-50">
          <div className="bg-surface shadow-lg py-1">
            {/* เปิดด้วย window.open ไม่ใช่ <a href> — content blocker จับจาก URL
                ใน markup แล้วซ่อนทั้งรายการทิ้ง (ต้นเหตุที่แท็บนี้หายบนมือถือ) */}
            <button
              type="button"
              onClick={() => window.open(
                `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getUrl())}`,
                "_blank",
                "noopener,noreferrer"
              )}
              className={ITEM_CLASS}
            >
              <FacebookIcon /> Facebook
            </button>
            <button type="button" onClick={() => copyShareLink("ig")} className={ITEM_CLASS}>
              <InstagramIcon /> {copied === "ig" ? "คัดลอกลิงก์แล้ว วางใน Instagram ได้เลย" : "Instagram"}
            </button>
            <button type="button" onClick={() => copyShareLink("link")} className={ITEM_CLASS}>
              <LinkIcon /> {copied === "link" ? "คัดลอกลิงก์แล้ว" : "คัดลอกลิงก์"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
