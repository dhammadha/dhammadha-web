"use client";

import Image from "next/image";
import Link from "next/link";

const socials = [
  {
    name: "Facebook",
    url: "https://www.facebook.com/dhammadha",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
      </svg>
    ),
  },
  {
    name: "Instagram",
    url: "https://www.instagram.com/dhammadha",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    ),
  },
  {
    name: "TikTok",
    url: "https://www.tiktok.com/@dhammadha",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z" />
      </svg>
    ),
  },
  {
    name: "LINE",
    url: "https://lin.ee/EYRmUTx",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M19.952 12.477c0-4.185-4.195-7.586-9.352-7.586S1.248 8.292 1.248 12.477c0 3.75 3.328 6.892 7.823 7.487.305.066.72.2.824.46.094.235.062.604.03.842l-.133.8c-.04.237-.188.926.812.505 1-.422 5.398-3.18 7.367-5.445 1.359-1.49 2.012-3.003 2.012-4.649zm-12.36 2.105H5.677a.512.512 0 0 1-.512-.511V10.6a.512.512 0 0 1 1.024 0v2.959h1.403a.512.512 0 0 1 0 1.023zm1.578-.511a.512.512 0 0 1-1.024 0V10.6a.512.512 0 0 1 1.024 0v3.471zm4.687 0a.512.512 0 0 1-.897.338l-1.786-2.43v2.093a.512.512 0 0 1-1.024 0V10.6a.512.512 0 0 1 .897-.338l1.786 2.43V10.6a.512.512 0 0 1 1.024 0v3.471zm2.823-2.448a.512.512 0 0 1 0 1.023h-1.403v.913h1.403a.512.512 0 0 1 0 1.023H14.17a.512.512 0 0 1-.512-.511V10.6a.512.512 0 0 1 .512-.512h1.51a.512.512 0 0 1 0 1.023H14.68v.512h1.403z" />
      </svg>
    ),
  },
];

export default function Footer() {
  return (
    <footer className="bg-white">
      <div className="max-w-site mx-auto grid grid-cols-1 md:grid-cols-[1.8fr_1fr_1fr_1fr] gap-8 px-8 pt-9 pb-7">
        {/* Brand */}
        <div className="flex flex-col gap-3">
          <Link href="/" className="flex items-center gap-2 no-underline">
            <Image
              src="/logo_DHAMMADHA_2025_simple.png"
              alt="Dhammadha Studio"
              width={28}
              height={28}
              className="rounded-[5px] object-cover"
            />
            <span className="text-[13px] font-semibold text-navy tracking-[0.04em]">
              DHAMMADHA STUDIO
            </span>
          </Link>
          <div className="flex gap-2.5 mt-1">
            {socials.map((s) => (
              <button
                key={s.name}
                onClick={() => window.open(s.url, "_blank", "noopener")}
                className="bg-transparent border-none p-0 cursor-pointer text-navy hover:text-mint transition-colors flex"
                aria-label={s.name}
              >
                {s.icon}
              </button>
            ))}
          </div>
        </div>

        {/* Fonts */}
        <div>
          <h4 className="text-[12px] font-semibold text-navy mb-3 tracking-[0.02em]">ผลิตภัณฑ์</h4>
          <Link href="/fonts/" className="block text-[12px] text-[#888] no-underline mb-2 hover:text-mint transition-colors">ฟอนต์ทั้งหมด</Link>
          <Link href="/agreement/" className="block text-[12px] text-[#888] no-underline mb-2 hover:text-mint transition-colors">สัญญาอนุญาต</Link>
          <Link href="/#pricing" className="block text-[12px] text-[#888] no-underline mb-2 hover:text-mint transition-colors">ราคาและแผนบริการ</Link>
        </div>

        {/* Legal */}
        <div>
          <h4 className="text-[12px] font-semibold text-navy mb-3 tracking-[0.02em]">นโยบาย</h4>
          <Link href="/privacy/" className="block text-[12px] text-[#888] no-underline mb-2 hover:text-mint transition-colors">นโยบายความเป็นส่วนตัว</Link>
          <Link href="/terms/" className="block text-[12px] text-[#888] no-underline mb-2 hover:text-mint transition-colors">ข้อกำหนดการใช้งาน</Link>
          <Link href="/refund-policy/" className="block text-[12px] text-[#888] no-underline mb-2 hover:text-mint transition-colors">นโยบายการคืนเงิน</Link>
          <Link href="/designer-agreement/" className="block text-[12px] text-[#888] no-underline mb-2 hover:text-mint transition-colors">ข้อตกลงสำหรับนักออกแบบ</Link>
        </div>

        {/* Help */}
        <div>
          <h4 className="text-[12px] font-semibold text-navy mb-3 tracking-[0.02em]">ช่วยเหลือ</h4>
          <a href="mailto:info@dhammadha.com" className="block text-[12px] text-[#888] no-underline mb-2 hover:text-mint transition-colors">ติดต่อสอบถาม</a>
          <Link href="/become-a-designer/" className="block text-[12px] text-[#888] no-underline mb-2 hover:text-mint transition-colors">สมัครเป็นนักออกแบบ</Link>
        </div>
      </div>

      <div className="border-t border-[#f0f0f0]">
        <div className="max-w-site mx-auto px-8 py-3.5 text-center text-[11px] text-[#bbb]">
          © 2012–2026 DHAMMADHA STUDIO
        </div>
      </div>
    </footer>
  );
}
