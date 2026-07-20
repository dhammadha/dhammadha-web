"use client";

import { useEffect, useRef } from "react";
import Container from "@/components/ui/Container";

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

interface Props {
  slot: string;
  className?: string;
}

/**
 * AdBanner — แถบโฆษณา AdSense (docs/design/DESIGN.md §16.10)
 *
 * Google ยัด iframe เฉพาะใน `<ins>` เท่านั้น — กรอบรอบนอก (พื้น + ป้าย ADS) เป็นของเรา
 * และไม่หายไปตอน ad จริงขึ้น จึงต้องอยู่ในระบบดีไซน์เหมือนส่วนอื่น
 *
 * ผู้เรียกที่อยู่ใน `Container` ของหน้า (FontDetail, FontGrid) ส่ง `-mx-4 md:-mx-6 lg:-mx-8`
 * มาเพื่อให้ "พื้น" ทะลุขอบ ส่วน `Container` ข้างในใส่ padding ชุดเดียวกันกลับ
 * → เนื้อในจึงเรียงตรงกับเนื้อหาหน้าทุก breakpoint (ของเดิม px-8 ตายตัว = เยื้อง 32px บนมือถือ)
 */
export default function AdBanner({ slot, className = "" }: Props) {
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {}
  }, []);

  return (
    <div className={`bg-surface ${className}`}>
      <Container className="py-2.5 flex items-center justify-center gap-2.5">
        <span className="font-heading text-badge text-grey-600 shrink-0">ADS</span>
        <div className="flex-1 max-w-[728px] flex justify-center">
          <ins
            className="adsbygoogle"
            style={{ display: "block" }}
            data-ad-client="ca-pub-4457591147215902"
            data-ad-slot={slot}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>
      </Container>
    </div>
  );
}
