"use client";

import Image from "next/image";
import Link from "next/link";
import Container from "@/components/ui/Container";
import { cn } from "@/lib/cn";

/**
 * Footer — ดีไซน์ใหม่ (docs/design/DESIGN.md §6.3, moodboard/footer.png)
 *
 * โครงตรงกับของเดิมเกือบหมด (คอลัมน์ครบ + social อยู่แล้ว) → restyle ล้วน
 * ไม่เพิ่ม ไม่ตัดลิงก์สักตัว
 *
 * moodboard วาด social เป็นสี่เหลี่ยมขาว 4 อัน = ที่วางไอคอน ไม่ใช่สี่เหลี่ยมจริง
 * → คงไอคอนจริงทั้ง 4 (Facebook/Instagram/TikTok/LINE) ไว้
 *
 * ข้อความลิขสิทธิ์คงของเดิม "© 2012–2026 DHAMMADHA STUDIO" —
 * moodboard เขียน "สงวนลิขสิทธิ์ (C) ธรรมดาสตูดิโอ" ซึ่งเป็นการเปลี่ยน "เนื้อหา"
 * ไม่ใช่ดีไซน์ และทิ้งช่วงปีไป → ไม่แตะ ถ้าอยากเปลี่ยนค่อยบอก
 *
 * เปลี่ยนโครงสร้าง 1 จุด: ปุ่ม social จาก <button onClick={window.open}> → <a target="_blank">
 * ปลายทางเหมือนเดิมเป๊ะ (เปิดแท็บใหม่ + noopener) แต่แก้บั๊ก a11y จริง —
 * element ที่พาไปหน้าอื่นต้องเป็นลิงก์ ไม่ใช่ปุ่ม (screen reader อ่านผิดบทบาท,
 * คลิกกลางเปิดแท็บไม่ได้, คัดลอกลิงก์ไม่ได้)
 */

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

// grey-400 บนพื้นดำ = 9.23:1 ผ่าน AA สบาย (DESIGN.md §3.2 — กฎ "ห้ามใช้กับตัวหนังสือ"
// ใช้กับพื้นขาวเท่านั้น ซึ่งได้แค่ 2.17:1)
const LINK = cn(
  "block font-body text-body-sm text-grey-400 no-underline",
  "hover:text-mint transition-colors duration-150 ease-base",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint"
);

// หัวคอลัมน์ใช้ `ui` (Sans Bold 16) — Figma ไม่มีสไตล์ "footer heading" โดยเฉพาะ
// และ fc-heading สงวนไว้ให้ชื่อฟอนต์บนการ์ด (สองอันเป็น Sans Bold 16 เหมือนกัน
// แต่ชื่อต้องตรงกับหน้าที่)
const HEADING = "font-heading text-ui text-white mb-3";

function Col({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className={HEADING}>{title}</h4>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="bg-black">
      <Container className="grid grid-cols-1 md:grid-cols-[1.8fr_1fr_1fr_1fr] gap-8 md:gap-6 pt-10 pb-8">
        {/* Brand */}
        <div className="flex flex-col gap-4">
          <Link
            href="/"
            className={cn(
              "flex items-center gap-2.5 no-underline w-fit",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint"
            )}
          >
            <Image
              src="/logo_DHAMMADHA_2025_simple.png"
              alt="Dhammadha Studio"
              width={28}
              height={28}
              className="object-cover"
            />
            <span className="font-heading text-body-sm font-bold text-white tracking-wide">
              DHAMMADHA STUDIO
            </span>
          </Link>
          <div className="flex gap-3">
            {socials.map((s) => (
              <a
                key={s.name}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "text-white hover:text-mint transition-colors duration-150 ease-base flex",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint"
                )}
                aria-label={s.name}
              >
                {s.icon}
              </a>
            ))}
          </div>
        </div>

        <Col title="ผลิตภัณฑ์">
          <Link href="/fonts/" className={LINK}>ฟอนต์ทั้งหมด</Link>
          <Link href="/agreement/" className={LINK}>สัญญาอนุญาต</Link>
          <Link href="/#pricing" className={LINK}>ราคาและแผนบริการ</Link>
        </Col>

        <Col title="นโยบาย">
          <Link href="/privacy/" className={LINK}>นโยบายความเป็นส่วนตัว</Link>
          <Link href="/terms/" className={LINK}>ข้อกำหนดการใช้งาน</Link>
          <Link href="/refund-policy/" className={LINK}>นโยบายการคืนเงิน</Link>
          <Link href="/designer-agreement/" className={LINK}>ข้อตกลงสำหรับนักออกแบบ</Link>
        </Col>

        <Col title="ช่วยเหลือ">
          <a href="mailto:info@dhammadha.com" className={LINK}>ติดต่อสอบถาม</a>
          <Link href="/become-a-designer/" className={LINK}>สมัครเป็นนักออกแบบ</Link>
        </Col>
      </Container>

      {/* แถบล่างพื้นอ่อน ตาม moodboard/footer.png — ใช้ `footnote` (Looped Light 12) */}
      <div className="bg-grey-50">
        <Container className="py-4 text-center font-body text-footnote text-grey-600">
          © 2012–2026 DHAMMADHA STUDIO
        </Container>
      </div>
    </footer>
  );
}
