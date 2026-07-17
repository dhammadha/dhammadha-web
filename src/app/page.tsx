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
// สไลด์หน้าแรก = full-bleed เน้น cover กลาง มี prev/next โผล่ข้าง ๆ ต่อเนื่องกัน (เจ้าของ 2026-07-18)
// PAD = จำนวน clone แต่ละข้าง — ต้อง ≥2 เพื่อให้ "ตำแหน่ง clone ตอน wrap" ยังมี cover ข้าง ๆ โผล่
// (peek โชว์เพื่อนบ้าน 1 ใบต่อข้าง ถ้า clone แค่ 1 ขอบจะมีช่องว่างวูบตอน snap)
const PAD = 2;

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

  // Carousel — peek: cover กลางกว้างเท่าเนื้อหา (max-w-site) prev/next โผล่เต็มขอบจอ
  const poolSize = sliderPool.length;
  const pad = Math.min(PAD, poolSize); // clamp เผื่อ pool เล็กกว่า PAD
  const strip = buildStrip(sliderPool, pad);
  const [pos, setPos] = useState(pad); // start after prepended clones
  const [animated, setAnimated] = useState(true);
  const dotIdx = poolSize > 0 ? (pos - pad + poolSize * 10) % poolSize : 0;

  // วัดความกว้าง+ตำแหน่งของ cover กลาง (= เนื้อหา Container) เพื่อจัดกึ่งกลาง + คำนวณ peek
  // slideW = ความกว้างเนื้อหา (หลังหัก padding) → cover กลางตรงขอบกริดด้านล่าง
  // slideOffset = ระยะจากขอบซ้าย section ถึงขอบซ้าย cover = ระยะ peek ซ้าย (สมมาตรกับขวา)
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
    setPos(pad || 0);
    setAnimated(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setAnimated(true)));
  }, [sliderPool, pad]);

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
          {/* บรรทัดเดียวบนเดสก์ท็อป (ไม่ใส่ max-w) — มือถือ wrap ตาม responsive เอง (เจ้าของ 2026-07-18) */}
          <p className="font-body text-body text-grey-600">
            คลังฟอนต์ภาษาไทยคุณภาพสูง สำหรับนักออกแบบ แบรนด์ และครีเอเตอร์ไทย
          </p>
        </Container>
      </section>

      {/* FEATURED SLIDER — full-bleed เน้น cover กลาง prev/next โผล่ข้าง ๆ ต่อเนื่อง ไม่มีแถบ bg (เจ้าของ 2026-07-18) */}
      <section className="relative overflow-hidden bg-white">
        {/* ตัววัดความกว้าง/ตำแหน่งเนื้อหา (max-w-site) — ซ่อน ไม่กินพื้นที่แนวตั้ง */}
        <div aria-hidden className="max-w-site mx-auto px-4 md:px-6 lg:px-8 pointer-events-none">
          <div ref={measureRef} className="h-0" />
        </div>

        <div className="py-8">
          {loading || !slideW ? (
            <Container>
              <div className="aspect-[2/1] bg-grey-200 animate-pulse" />
            </Container>
          ) : poolSize === 0 ? (
            <Container>
              <div className="text-center font-body text-grey-600 py-10 text-body-sm">ยังไม่มีฟอนต์ในระบบ</div>
            </Container>
          ) : (
            <>
              {/* แถว cover — relative เพื่อวางลูกศรที่ขอบ cover กลาง */}
              <div className="relative">
                <div
                  className="flex"
                  style={{
                    // cover แต่ละใบกว้าง slideW (= เนื้อหา Container) เรียงต่อกัน translateX จัด cover ที่ pos ให้กึ่งกลาง
                    transform: `translateX(${slideOffset - pos * slideW}px)`,
                    transition: animated ? "transform 0.45s cubic-bezier(0.25,0.1,0.25,1)" : "none",
                  }}
                  onTransitionEnd={onTransitionEnd}
                >
                  {strip.map((f, i) => (
                    <Link
                      key={i}
                      href={`/fonts/${f.designer_slug}/${f.slug}`}
                      style={{ width: slideW }}
                      className="block no-underline flex-none"
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

                {/* ลูกศรเปล่าที่ขอบ cover กลาง — ไม่มีวงกลมรองพื้น (§4.0) ขาว+เงาให้อ่านออกบนรูป */}
                {poolSize > 1 && (
                  <>
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
                  </>
                )}
              </div>

              {/* จุดบอกตำแหน่ง — active = mint (inactive grey-400 ให้เห็นบนพื้นขาว) */}
              {poolSize > 1 && (
                <div className="flex gap-1.5 justify-center mt-4">
                  {Array.from({ length: poolSize }, (_, i) => (
                    <button key={i} onClick={() => { setPos(pad + i); }}
                      className={`border-none cursor-pointer rounded-full transition-all ${i === dotIdx ? "w-5 h-[3px] bg-mint" : "w-[5px] h-[3px] bg-grey-400"}`}
                      aria-label={`ตำแหน่ง ${i + 1}`} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
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
              <Badge variant="plan" className="self-start mb-2.5">ซื้อครั้งเดียว</Badge>
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
