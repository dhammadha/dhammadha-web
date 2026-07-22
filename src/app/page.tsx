"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import { effectiveSale } from "@/lib/sale";
import { mergeShopPromos } from "@/lib/shop-promo";
import FontCard, { Font } from "@/components/FontCard";
import CoverCarousel from "@/components/CoverCarousel";
import AdBanner from "@/components/AdBanner";
import SubscriptionPricingCard from "@/components/SubscriptionPricingCard";

// ── Helpers ──────────────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

const SLIDER_SIZE = 8;

// pool สไลด์คัดสรร: ฟอนต์ลดราคาก่อน แล้วสุ่มที่เหลือ ตัดเหลือ SLIDER_SIZE
// (logic สไลด์ทั้งหมดอยู่ใน CoverCarousel — หน้านี้แค่คัด pool ส่งเข้าไป)
function buildSliderPool(fonts: Font[]): Font[] {
  const sale = fonts.filter((f) => effectiveSale(f).active);
  const others = shuffle(fonts.filter((f) => !effectiveSale(f).active));
  return [...sale, ...others].slice(0, SLIDER_SIZE);
}

// ── Page ─────────────────────────────────────────────────────────────────────
// กริด "ฟอนต์ล่าสุด" = 11 ใบ + ช่อง "ดูฟอนต์ทั้งหมด" = 3 แถว × 4 (DESIGN.md §7)
const GRID_SHOW = 11;

export default function HomePage() {
  const [fonts, setFonts] = useState<Font[]>([]);
  const [sliderPool, setSliderPool] = useState<Font[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("fonts")
        // embed ผ่าน view designer_profiles ไม่ใช่ users — ตั้งแต่ 0054 anon อ่าน users
        // ไม่ได้แล้ว (bank/tax_id อยู่ในนั้น) ถ้า embed users ทั้ง query จะ 401 = ไม่มีฟอนต์ขึ้นเลย
        .select("*, designer_profiles!owner_id(designer_slug, business_name)")
        .eq("is_active", true)
        .not("published_at", "is", null)
        .order("created_at", { ascending: false });
      if (error) { setLoading(false); return; }
      type RawFont = { designer_profiles?: { designer_slug?: string; business_name?: string } | null } & Record<string, unknown>;
      const flat = ((data ?? []) as unknown as RawFont[]).map((r) => ({ ...r, designer_slug: r.designer_profiles?.designer_slug ?? undefined, designer_business_name: r.designer_profiles?.business_name ?? undefined, designer_profiles: undefined })) as unknown as Font[];
      const active = await mergeShopPromos(flat);
      setFonts(active);
      setSliderPool(buildSliderPool(active));
      setLoading(false);
    })();
  }, []);

  const gridFonts = fonts.slice(0, GRID_SHOW);
  const remaining = fonts.length - GRID_SHOW;

  return (
    <>
      <Nav />

      {/* HERO — gap น้อยลงตามที่เจ้าของสั่ง ~30-40px (เดิม pt-14 pb-12 หลวมเกิน) */}
      <section className="bg-white">
        <Container className="pt-10 pb-5">
          <h1 className="font-heading text-hero text-black mb-3.5">
            ฟอนต์ไทย<br />ที่ <em className="text-mint-text not-italic">ออกแบบ</em> อย่างพิถีพิถัน
          </h1>
          {/* บรรทัดเดียวบนเดสก์ท็อป (ไม่ใส่ max-w) — มือถือ wrap ตาม responsive เอง (เจ้าของ 2026-07-18) */}
          <p className="font-body text-body text-grey-600">
            คลังฟอนต์ภาษาไทยคุณภาพสูง สำหรับนักออกแบบ แบรนด์ และครีเอเตอร์ไทย
          </p>
        </Container>
      </section>

      {/* FEATURED SLIDER — full-bleed cover slider (component reuse ได้กับหน้า designer) */}
      <CoverCarousel fonts={sliderPool} loading={loading} />

      {/* FONT GRID (ตัด ad ระหว่างสไลด์กับกริดออกตามที่เจ้าของสั่ง 2026-07-18) */}
      <section id="fonts" className="bg-white">
        <Container className="pt-5 pb-6">
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
