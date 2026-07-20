"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * ScrollReset — เลื่อนขึ้นบนสุดทุกครั้งที่เปลี่ยนหน้า (client-side navigation)
 *
 * แก้บั๊ก: Next.js App Router ตอน client-nav บางครั้งเลื่อนเนื้อหาใหม่ไปชิด y=0
 * ซึ่งอยู่ "หลัง" Nav ที่เป็น sticky (สูง 70px) → ขอบบนของเนื้อหาถูกบังราว ๆ ความสูง nav
 * ("เหมือน scroll ลงมานิดนึง" — เจ้าของเจอทุกหน้า 2026-07-18)
 *
 * behavior:"instant" บังคับกระโดดทันที (ไม่งั้น scroll-behavior:smooth ใน globals.css จะทำให้ค่อย ๆ เลื่อน)
 * ข้ามถ้ามี hash (เช่น /#pricing) เพื่อไม่ทับการเลื่อนไป anchor ที่ตั้งใจ
 */
export default function ScrollReset() {
  const pathname = usePathname();
  useEffect(() => {
    if (typeof window === "undefined" || window.location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return null;
}
