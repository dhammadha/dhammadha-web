"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Container from "@/components/ui/Container";
import { Font } from "@/components/FontCard";

/**
 * CoverCarousel — สไลด์ cover แบบ full-bleed เน้นตรงกลาง prev/next โผล่ข้าง ๆ ต่อเนื่อง
 * (docs/design/DESIGN.md §7 + รีวิวเจ้าของ 2026-07-18)
 *
 * ใช้ซ้ำได้: หน้าแรก (ฟอนต์คัดสรรทั้งเว็บ) + หน้า designer storefront (เฉพาะฟอนต์ดีไซเนอร์นั้น)
 * รับ pool ฟอนต์ที่คัด/สุ่มมาแล้วจากภายนอก (component ไม่ยุ่งกับ query) → แสดงผลเหมือนกันทุกที่
 *
 * `slides` (Phase 8) — โหมดรูปดิบ สำหรับหน้า font detail ที่ต้องเลื่อน cover + preview
 * ของฟอนต์ **ตัวเดียว** ไม่ใช่ฟอนต์หลายตัว geometry เหมือนกันทุกอย่างจึงใช้ตัวนี้ต่อ
 * ส่ง `slides` มา = ใช้ตรง ๆ · ไม่ส่ง = map จาก `fonts` เหมือนเดิม (call site เดิมไม่ต้องแก้)
 *
 * cover = 16:9 (สัดส่วนรูปจริง) · ตัดชื่อฟอนต์ในสไลด์ (เลี่ยงโหลด webfont · §7)
 * ลูกศรที่ขอบ cover กลาง + จุดวางทับ cover (active mint)
 *
 * geometry: วัดความกว้าง/ตำแหน่งเนื้อหา (max-w-site) ด้วย ResizeObserver
 *   slideW = ความกว้างเนื้อหา (หลังหัก padding) → cover กลางตรงขอบกริดหน้าอื่น
 *   slideOffset = ระยะ peek ซ้าย (สมมาตรกับขวา) = ตำแหน่งซ้ายของ cover กลาง
 */

// PAD = clone แต่ละข้าง ต้อง ≥2 เพื่อให้ตำแหน่ง clone ตอน wrap ยังมี cover ข้าง ๆ โผล่
// (peek โชว์เพื่อนบ้าน 1 ใบต่อข้าง ถ้า clone แค่ 1 ขอบจะมีช่องว่างวูบตอน snap)
const PAD = 2;

/** สไลด์หนึ่งใบ — `href` ละได้ (font detail ไม่ลิงก์ไปไหน รูปเป็นของฟอนต์ที่เปิดอยู่แล้ว) */
export type Slide = { key: string; src: string; alt: string; href?: string };

function buildStrip(pool: Slide[], v: number): Slide[] {
  if (!pool.length) return [];
  return [...pool.slice(-v), ...pool, ...pool.slice(0, v)];
}

function fontsToSlides(fonts: Font[]): Slide[] {
  return fonts.map((f) => ({
    key: f.id ?? f.slug,
    src: f.cover_image_url ?? "",
    alt: f.name ?? "",
    href: `/fonts/${f.designer_slug}/${f.slug}`,
  }));
}

export default function CoverCarousel({
  fonts,
  slides,
  loading = false,
  intervalMs = 3000,
}: {
  /** pool ฟอนต์ที่คัด/สุ่มมาแล้ว (component ไม่ query เอง) — ละได้ถ้าส่ง `slides` */
  fonts?: Font[];
  /** รูปดิบ — ชนะ `fonts` ถ้าส่งมาทั้งคู่ */
  slides?: Slide[];
  /** กำลังโหลดอยู่ไหม — true = โชว์ skeleton แทนการหายไป (กัน layout shift) */
  loading?: boolean;
  /** ระยะเลื่อนอัตโนมัติ (ms) — เดิม 4000 เจ้าของว่านานไป ลดเป็น 3000 (2026-07-18) */
  intervalMs?: number;
}) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pool = slides ?? fontsToSlides(fonts ?? []);
  const poolSize = pool.length;
  const pad = Math.min(PAD, poolSize); // clamp เผื่อ pool เล็กกว่า PAD
  const strip = buildStrip(pool, pad);
  const [pos, setPos] = useState(pad);
  const [animated, setAnimated] = useState(true);
  const dotIdx = poolSize > 0 ? (pos - pad + poolSize * 10) % poolSize : 0;

  // วัด cover กลาง (= เนื้อหา Container) เพื่อจัดกึ่งกลาง + คำนวณ peek
  const measureRef = useRef<HTMLDivElement>(null);
  const [slideW, setSlideW] = useState(0);
  const [slideOffset, setSlideOffset] = useState(0);
  useEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const update = () => { setSlideW(el.clientWidth); setSlideOffset(el.offsetLeft); };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => { ro.disconnect(); window.removeEventListener("resize", update); };
  }, []);

  // reset ตำแหน่งเมื่อ pool เปลี่ยน
  // ผูกกับ "เนื้อใน" ไม่ใช่ identity ของ array — โหมด `slides` สร้าง array ใหม่ทุก render
  // ถ้าใส่ตัว array ตรง ๆ ใน deps สไลด์จะรีเซ็ตตำแหน่งทุกครั้งที่ parent re-render
  const poolKey = pool.map((s) => s.key).join("|");
  useEffect(() => {
    setPos(pad || 0);
    setAnimated(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setAnimated(true)));
  }, [poolKey, pad]);

  // auto-advance — ข้ามการเลื่อนตอนแท็บซ่อน (กัน pos ไต่หนีจนสไลด์ตาย · DESIGN.md §8)
  useEffect(() => {
    if (poolSize < 2) return;
    timerRef.current = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      setPos((p) => p + 1);
    }, intervalMs);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [poolSize, intervalMs]);

  // กลับมามองเห็นแท็บ → กู้ animated (กัน transition ค้าง none)
  useEffect(() => {
    const onVis = () => { if (!document.hidden) setAnimated(true); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (!animated) {
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimated(true)));
    }
  }, [animated]);

  function onTransitionEnd() {
    if (pos >= poolSize + pad) { setAnimated(false); setPos(pad); }
    else if (pos < pad && poolSize > 0) { setAnimated(false); setPos(poolSize + pos); }
  }

  function moveSlide(dir: number) {
    if (poolSize < 2) return;
    setPos((p) => p + dir);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        if (typeof document !== "undefined" && document.hidden) return;
        setPos((p) => p + 1);
      }, intervalMs);
    }
  }

  // ไม่มีฟอนต์และไม่ได้กำลังโหลด = ไม่แสดงสไลด์เลย
  if (poolSize === 0 && !loading) return null;

  return (
    <section className="relative overflow-hidden bg-white">
      {/* ตัววัดความกว้าง/ตำแหน่งเนื้อหา (max-w-site) — ซ่อน ไม่กินพื้นที่แนวตั้ง */}
      <div aria-hidden className="max-w-site mx-auto px-4 md:px-6 lg:px-8 pointer-events-none">
        <div ref={measureRef} className="h-0" />
      </div>

      <div className="pt-5 pb-5">
        {loading || !slideW || poolSize === 0 ? (
          <Container>
            <div className="aspect-video bg-grey-200 animate-pulse" />
          </Container>
        ) : (
          /* แถว cover — relative เพื่อวางลูกศร + จุด ทับบน cover กลาง */
          <div className="relative">
            <div
              className="flex"
              style={{
                transform: `translateX(${slideOffset - pos * slideW}px)`,
                transition: animated ? "transform 0.45s cubic-bezier(0.25,0.1,0.25,1)" : "none",
              }}
              onTransitionEnd={onTransitionEnd}
            >
              {strip.map((s, i) => {
                const cover = (
                  <div className="aspect-video w-full bg-grey-200 overflow-hidden">
                    {s.src
                      ? <img src={s.src} alt={s.alt} className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-grey-200" />}
                  </div>
                );
                return s.href ? (
                  <Link key={i} href={s.href} style={{ width: slideW }} className="block no-underline flex-none">
                    {cover}
                  </Link>
                ) : (
                  <div key={i} style={{ width: slideW }} className="flex-none">
                    {cover}
                  </div>
                );
              })}
            </div>

            {poolSize > 1 && (
              <>
                {/* ลูกศรเปล่าที่ขอบ cover กลาง — ไม่มีวงกลมรองพื้น (§4.0) ขาว+เงาให้อ่านออกบนรูป */}
                <button onClick={() => moveSlide(-1)}
                  style={{ left: slideOffset + 8, textShadow: "0 1px 4px rgba(0,0,0,0.45)" }}
                  className="absolute top-1/2 -translate-y-1/2 z-10 bg-transparent border-none cursor-pointer text-[32px] leading-none text-white hover:text-mint transition-colors px-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint"
                  aria-label="ก่อนหน้า">
                  ‹
                </button>
                <button onClick={() => moveSlide(1)}
                  style={{ right: slideOffset + 8, textShadow: "0 1px 4px rgba(0,0,0,0.45)" }}
                  className="absolute top-1/2 -translate-y-1/2 z-10 bg-transparent border-none cursor-pointer text-[32px] leading-none text-white hover:text-mint transition-colors px-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint"
                  aria-label="ถัดไป">
                  ›
                </button>

                {/* จุดบอกตำแหน่ง — วางทับ cover กลาง (bottom-center) · active mint */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                  {Array.from({ length: poolSize }, (_, i) => (
                    <button key={i} onClick={() => { setPos(pad + i); }}
                      className={`border-none cursor-pointer rounded-full transition-all ${i === dotIdx ? "w-5 h-[3px] bg-mint" : "w-[5px] h-[3px] bg-white/70"}`}
                      aria-label={`ตำแหน่ง ${i + 1}`} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
