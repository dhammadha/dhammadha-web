"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { supabase } from "@/lib/supabase";
import FontCard, { Font } from "@/components/FontCard";
import AdBanner from "@/components/AdBanner";
import SubscriptionPricingCard from "@/components/SubscriptionPricingCard";

// ── Helpers ──────────────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

const SLIDER_SIZE = 8;
// สไลด์หน้าแรก = cover เดียว (DESIGN.md §7 "1 cover ตรงกลาง")
const MAX_VISIBLE = 1;

function buildSliderPool(fonts: Font[]): Font[] {
  const sale = fonts.filter((f) => f.is_sale);
  const others = shuffle(fonts.filter((f) => !f.is_sale));
  return [...sale, ...others].slice(0, SLIDER_SIZE);
}

// Build infinite strip: [last V items] + pool + [first V items]
function buildStrip(pool: Font[], v: number): Font[] {
  if (!pool.length) return [];
  return [...pool.slice(-v), ...pool, ...pool.slice(0, v)];
}

// ── Page ─────────────────────────────────────────────────────────────────────
// กริด "ฟอนต์ล่าสุด" = 11 ใบ + ช่อง "ดูฟอนต์ทั้งหมด" = 3 แถว × 4 (DESIGN.md §7)
const GRID_SHOW = 11;

export default function HomePage() {
  const [fonts, setFonts] = useState<Font[]>([]);
  const [sliderPool, setSliderPool] = useState<Font[]>([]);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Carousel
  const poolSize = sliderPool.length;
  const showCount = Math.min(poolSize, MAX_VISIBLE);
  const strip = buildStrip(sliderPool, showCount);
  const [pos, setPos] = useState(showCount); // start after prepended clones
  const [animated, setAnimated] = useState(true);
  const dotIdx = poolSize > 0 ? (pos - showCount + poolSize * 10) % poolSize : 0;

  useEffect(() => {
    setLoading(true);
    supabase
      .from("fonts")
      // embed ผ่าน view designer_profiles ไม่ใช่ users — ตั้งแต่ 0054 anon อ่าน users
      // ไม่ได้แล้ว (bank/tax_id อยู่ในนั้น) ถ้า embed users ทั้ง query จะ 401 = ไม่มีฟอนต์ขึ้นเลย
      .select("*, designer_profiles!owner_id(designer_slug, business_name)")
      .eq("is_active", true)
      .not("published_at", "is", null)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) { setLoading(false); return; }
        type RawFont = { designer_profiles?: { designer_slug?: string; business_name?: string } | null } & Record<string, unknown>;
        const active = ((data ?? []) as unknown as RawFont[]).map((r) => ({ ...r, designer_slug: r.designer_profiles?.designer_slug ?? undefined, designer_business_name: r.designer_profiles?.business_name ?? undefined, designer_profiles: undefined })) as unknown as Font[];
        setFonts(active);
        setSliderPool(buildSliderPool(active));
        setLoading(false);
      });
  }, []);

  const gridFonts = fonts.slice(0, GRID_SHOW);
  const remaining = fonts.length - GRID_SHOW;

  // Reset strip position when pool changes
  useEffect(() => {
    setPos(showCount || 0);
    setAnimated(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setAnimated(true)));
  }, [sliderPool, showCount]);

  // Auto-advance — ข้ามการเลื่อนตอนแท็บซ่อนอยู่ (DESIGN.md §8)
  // เดิม: แท็บ hidden ไม่ยิง rAF → animated ค้าง false → transitionend ไม่ยิง → ไม่ snap
  // แต่ setInterval ยังเดิน → pos ไต่ออกนอกจอถาวร (carousel ตาย) → กันด้วย document.hidden
  useEffect(() => {
    if (poolSize < 2) return;
    timerRef.current = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      setPos((p) => p + 1);
    }, 4000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [poolSize]);

  // กลับมามองเห็นแท็บ → กู้ animated (กัน transition ค้าง none ตอนซ่อน)
  useEffect(() => {
    const onVis = () => { if (!document.hidden) setAnimated(true); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Re-enable animation after instant snap
  useEffect(() => {
    if (!animated) {
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimated(true)));
    }
  }, [animated]);

  function onTransitionEnd() {
    if (pos >= poolSize + showCount) { setAnimated(false); setPos(showCount); }
    else if (pos <= 0 && showCount > 0) { setAnimated(false); setPos(poolSize); }
  }

  function moveSlide(dir: number) {
    if (poolSize < 2) return;
    setPos((p) => p + dir);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        if (typeof document !== "undefined" && document.hidden) return;
        setPos((p) => p + 1);
      }, 4000);
    }
  }

  return (
    <>
      <Nav />

      {/* HERO */}
      <section className="bg-white">
        <Container className="pt-14 pb-12">
          <h1 className="font-heading text-hero text-black mb-3.5">
            ฟอนต์ไทย<br />ที่ <em className="text-mint-text not-italic">ออกแบบ</em> อย่างพิถีพิถัน
          </h1>
          <p className="font-body text-body text-grey-600 max-w-[480px]">
            คลังฟอนต์ภาษาไทยคุณภาพสูง สำหรับนักออกแบบ แบรนด์ และครีเอเตอร์ไทย
          </p>
        </Container>
      </section>

      {/* FEATURED SLIDER — cover เดียวบนแถบ surface (DESIGN.md §7) */}
      <section className="bg-surface">
        <Container className="py-8">
          <div className="relative">
            {/* Prev — ลูกศรเปล่า ไม่มีวงกลมรองพื้น (§4.0) */}
            {poolSize > 1 && (
              <button onClick={() => moveSlide(-1)}
                className="absolute left-0 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-[28px] text-grey-400 hover:text-black transition-colors px-2 z-10 leading-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                aria-label="ก่อนหน้า">
                ‹
              </button>
            )}

            {/* Strip */}
            <div className="overflow-hidden mx-8">
              {loading ? (
                <div className="aspect-[2/1] bg-grey-200 animate-pulse" />
              ) : poolSize === 0 ? (
                <div className="text-center font-body text-grey-600 py-10 text-body-sm">ยังไม่มีฟอนต์ในระบบ</div>
              ) : (
                <div
                  className="flex"
                  style={{
                    // translateX(%) is relative to the element itself
                    // moving pos items = -(pos/strip.length)*100% of strip
                    transform: `translateX(${-(pos / strip.length) * 100}%)`,
                    transition: animated ? "transform 0.45s cubic-bezier(0.25,0.1,0.25,1)" : "none",
                    // strip total width relative to the overflow container
                    width: `${(strip.length / showCount) * 100}%`,
                  }}
                  onTransitionEnd={onTransitionEnd}
                >
                  {strip.map((f, i) => (
                    <Link
                      key={i}
                      href={`/fonts/${f.designer_slug}/${f.slug}`}
                      style={{ width: `${100 / strip.length}%` }}
                      className="block no-underline shrink-0"
                    >
                      {/* cover ล้วน — ตัดชื่อฟอนต์ในสไลด์ (§7 เลี่ยงโหลด webfont) */}
                      <div className="aspect-[2/1] w-full bg-grey-200 overflow-hidden">
                        {f.cover_image_url
                          ? <img src={f.cover_image_url} alt={f.name ?? ""} className="w-full h-full object-cover" />
                          : <div className="w-full h-full bg-grey-200" />}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Next */}
            {poolSize > 1 && (
              <button onClick={() => moveSlide(1)}
                className="absolute right-0 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-[28px] text-grey-400 hover:text-black transition-colors px-2 z-10 leading-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                aria-label="ถัดไป">
                ›
              </button>
            )}
          </div>

          {poolSize > 1 && (
            <div className="flex gap-1.5 justify-center mt-4">
              {Array.from({ length: poolSize }, (_, i) => (
                <button key={i} onClick={() => { setPos(showCount + i); }}
                  className={`border-none cursor-pointer rounded-full transition-all ${i === dotIdx ? "w-5 h-[3px] bg-mint" : "w-[5px] h-[3px] bg-grey-200"}`}
                  aria-label={`ตำแหน่ง ${i + 1}`} />
              ))}
            </div>
          )}
        </Container>
      </section>

      <AdBanner slot="1401819374" />

      {/* FONT GRID */}
      <section id="fonts" className="bg-white">
        <Container className="py-6">
          <h2 className="font-heading text-h1 text-black mb-3.5">ฟอนต์ล่าสุด</h2>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="bg-surface aspect-[4/3] animate-pulse" />
              ))}
            </div>
          ) : fonts.length === 0 ? (
            <div className="text-center font-body text-grey-600 py-10 text-body-sm">ยังไม่มีฟอนต์ในระบบ</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {gridFonts.map((f) => (
                <FontCard key={f.id} font={f} />
              ))}
              {remaining > 0 && (
                <Link href="/fonts/" className="flex flex-col items-center justify-center gap-1 bg-surface cursor-pointer transition-shadow duration-150 ease-base hover:shadow-md p-6 no-underline">
                  <span className="font-heading text-h2 text-black">+{remaining}</span>
                  <span className="font-body text-body-sm text-grey-600">ฟอนต์อื่น ๆ</span>
                  <span className="font-body text-body-sm text-mint-text mt-0.5">ดูทั้งหมด →</span>
                </Link>
              )}
            </div>
          )}
        </Container>
      </section>

      <AdBanner slot="1401819374" />

      {/* PRICING */}
      <section id="pricing" className="bg-white">
        <Container className="py-7">
          <h2 className="font-heading text-h1 text-black mb-4">ราคาและแผนบริการ</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div className="p-5 bg-surface flex flex-col">
              <Badge variant="tag" className="self-start mb-2.5">ซื้อครั้งเดียว</Badge>
              <div className="font-heading text-h2 text-black">ซื้อรายฟอนต์</div>
              <div className="font-heading text-h2 text-black">ราคาแตกต่างกัน</div>
              <div className="font-body text-body-sm text-grey-600 mt-2.5 mb-2.5">/ ชุดฟอนต์</div>
              <div className="font-body text-body-sm text-grey-600 flex-1">
                ดาวน์โหลดไฟล์ฟอนต์ได้ทันทีหลังชำระเงิน
              </div>
              <Button as="link" href="/fonts/" variant="primary" className="mt-4 w-full">
                ดูฟอนต์ทั้งหมด
              </Button>
            </div>
            <SubscriptionPricingCard />
          </div>
        </Container>
      </section>

      <Footer />
    </>
  );
}
