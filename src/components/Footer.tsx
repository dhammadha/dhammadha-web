"use client";

import Image from "next/image";
import Link from "next/link";
import Container from "@/components/ui/Container";
import { cn } from "@/lib/cn";
import { NAME as BRAND_NAME, WORDMARK_SRC, SOCIAL } from "@/lib/brand";

/**
 * Footer — ดีไซน์ใหม่ (docs/design/DESIGN.md §6.3, moodboard/footer.png)
 *
 * โครงตรงกับของเดิมเกือบหมด (คอลัมน์ครบ + social อยู่แล้ว) → restyle ล้วน
 * ไม่เพิ่ม ไม่ตัดลิงก์สักตัว
 *
 * moodboard วาด social เป็นสี่เหลี่ยมขาว 4 อัน = ที่วางไอคอน ไม่ใช่สี่เหลี่ยมจริง
 * → คงไอคอนจริงทั้ง 4 (Facebook/Instagram/TikTok/LINE) ไว้
 *
 * ข้อความลิขสิทธิ์: ปีเริ่มต้นและชื่อมาจาก `lib/brand.ts` ปีปลายคิดตอน build
 * (เดิม hardcode "2026" ไว้ ซึ่งจะค้างผิดปีตั้งแต่ 1 ม.ค. 2027 เป็นต้นไป) —
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
    url: SOCIAL.facebook,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
      </svg>
    ),
  },
  {
    name: "Instagram",
    url: SOCIAL.instagram,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    ),
  },
  // TikTok + LINE ถอดออก 7 ส.ค. 2569 ตอนแยกแบรนด์ — typedee ยังไม่ได้เปิดสองช่องทางนี้
  // (ของเดิมชี้ไปบัญชี Dhammadha Studio ซึ่งตอนนี้เป็น foundry เจ้าหนึ่งบนแพลตฟอร์ม
  //  ไม่ใช่ตัวแพลตฟอร์ม) เปิดบัญชีเมื่อไรเติม URL ใน SOCIAL แล้วเอา icon กลับมาที่นี่
  // หมายเหตุ: LINE เคย hardcode URL ไว้ตรงนี้ ไม่ได้อ่านจาก SOCIAL.line เหมือนตัวอื่น
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
  // mt-auto — ดันตัวเองไปชิดขอบล่างเมื่อเนื้อหาสั้นกว่าจอ (body เป็น flex-col min-h-screen
  // ใน app/layout.tsx) หน้าเนื้อยาวไม่มีผล เพราะไม่เหลือที่ว่างให้ดัน
  return (
    <footer className="bg-black mt-auto">
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
            {/* wordmark ทุกขนาดจอ — Footer ไม่มีของอื่นแย่งที่ในแถวเดียวกันเหมือน Nav
                จึงไม่ต้องสลับเป็นเครื่องหมายอย่างเดียวตอนจอแคบ
                84×20 = อัตราส่วน 4.20:1 หลัง crop (ดู WORDMARK_SRC ใน lib/brand.ts) */}
            <Image src={WORDMARK_SRC} alt={BRAND_NAME} width={84} height={20} />
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
          <Link href="/subscribe/" className={LINK}>สมัครสมาชิกรายเดือน</Link>
        </Col>

        <Col title="นโยบาย">
          <Link href="/terms/" className={LINK}>ข้อกำหนดการใช้งาน</Link>
          <Link href="/privacy/" className={LINK}>นโยบายความเป็นส่วนตัว</Link>
          <Link href="/refund-policy/" className={LINK}>นโยบายการคืนเงิน</Link>
          <Link href="/designer-agreement/" className={LINK}>ข้อตกลงสำหรับนักออกแบบ</Link>
        </Col>

        <Col title="ช่วยเหลือ">
          <Link href="/contact/" className={LINK}>ติดต่อสอบถาม</Link>
          <Link href="/verify/" className={LINK}>ตรวจสอบสิทธิการใช้งานฟอนต์</Link>
          <Link href="/become-a-designer/" className={LINK}>สมัครเป็นนักออกแบบ</Link>
        </Col>
      </Container>

      {/* แถบล่างพื้นอ่อน ตาม moodboard/footer.png — ใช้ `footnote` (Looped Light 12) */}
      <div className="bg-surface">
        <Container className="py-4 text-center font-body text-footnote text-grey-600">
          © {new Date().getFullYear()} {BRAND_NAME}
        </Container>
      </div>
    </footer>
  );
}
