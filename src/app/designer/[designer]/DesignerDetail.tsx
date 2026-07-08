"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import FontCard, { Font } from "@/components/FontCard";
import { supabase } from "@/lib/supabase";
import PdfLightbox from "@/components/PdfLightbox";

const SLIDER_SIZE = 5;
const MAX_VISIBLE = 3;

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function buildSliderPool(fonts: Font[]): Font[] {
  const sale = fonts.filter((f) => f.is_sale);
  const others = shuffle(fonts.filter((f) => !f.is_sale));
  return [...sale, ...others].slice(0, SLIDER_SIZE);
}

function buildStrip(pool: Font[], v: number): Font[] {
  if (!pool.length) return [];
  return [...pool.slice(-v), ...pool, ...pool.slice(0, v)];
}

export default function DesignerDetail() {
  const params = useParams();
  const designerSlug = typeof params?.designer === "string" ? params.designer : "";

  const [designerName, setDesignerName] = useState("");
  const [fonts, setFonts] = useState<Font[]>([]);
  const [sliderPool, setSliderPool] = useState<Font[]>([]);
  const [loading, setLoading] = useState(true);
  const [licenseConfig, setLicenseConfig] = useState<{ use_default: boolean; license_pdf_url: string | null } | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);

  const poolSize = sliderPool.length;
  const showCount = Math.min(poolSize, MAX_VISIBLE);
  const strip = buildStrip(sliderPool, showCount);
  const [pos, setPos] = useState(showCount);
  const [animated, setAnimated] = useState(true);
  const dotIdx = poolSize > 0 ? (pos - showCount + poolSize * 10) % poolSize : 0;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!designerSlug) return;
    (async () => {
      setLoading(true);
      const { data: userData } = await supabase
        .from("users")
        .select("id, business_name, name")
        .eq("designer_slug", designerSlug)
        .single();

      if (!userData) { setLoading(false); return; }
      setDesignerName(userData.business_name || userData.name || designerSlug);

      const { data: licenseData } = await supabase
        .from("designer_license_config")
        .select("use_default, license_pdf_url")
        .eq("designer_id", userData.id)
        .single();
      setLicenseConfig(licenseData ?? null);

      const { data: fontData } = await supabase
        .from("fonts")
        .select("*")
        .eq("owner_id", userData.id)
        .eq("is_active", true)
        .not("published_at", "is", null)
        .order("created_at", { ascending: false });

      const allFonts = ((fontData ?? []) as Font[]).map((f) => ({
        ...f,
        designer_slug: designerSlug,
        designer_business_name: userData.business_name || userData.name || "",
      }));

      setFonts(allFonts);
      setSliderPool(buildSliderPool(allFonts));
      setLoading(false);
    })();
  }, [designerSlug]);

  useEffect(() => {
    if (poolSize <= 1) return;
    timerRef.current = setInterval(() => setPos((p) => p + 1), 4000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [poolSize]);

  useEffect(() => {
    if (!animated) {
      const id = requestAnimationFrame(() => {
        setAnimated(true);
        setPos((p) => {
          if (p >= poolSize + showCount) return showCount;
          if (p < showCount) return poolSize + p;
          return p;
        });
      });
      return () => cancelAnimationFrame(id);
    }
  }, [animated, poolSize, showCount]);

  function move(dir: number) {
    setPos((p) => p + dir);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => setPos((p) => p + 1), 4000);
    }
  }

  const handleTransitionEnd = () => {
    if (pos >= poolSize + showCount || pos < showCount) setAnimated(false);
  };

  if (loading) {
    return (
      <>
        <Nav />
        <div className="min-h-screen flex items-center justify-center">
          <span className="text-[14px] text-[#aaa]">กำลังโหลด...</span>
        </div>
        <Footer />
      </>
    );
  }

  if (!designerName) {
    return (
      <>
        <Nav />
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
          <div className="text-[18px] font-semibold text-navy">ไม่พบ designer นี้</div>
          <Link href="/fonts/" className="text-[14px] text-mint no-underline">← ดูฟอนต์ทั้งหมด</Link>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Nav />
      <div className="bg-bg min-h-screen">
        <div className="max-w-site mx-auto px-8 py-10">
          <div className="mb-8">
            <p className="text-[12px] text-[#aaa] mb-1">
              <Link href="/fonts/" className="text-[#aaa] no-underline hover:text-mint transition-colors">ฟอนต์ทั้งหมด</Link>
              {" / "}นักออกแบบ
            </p>
            <h1 className="text-[32px] font-semibold text-navy">{designerName}</h1>
            <div className="flex items-center gap-4 mt-1">
              <p className="text-[13px] text-[#aaa]">{fonts.length} ฟอนต์</p>
              {licenseConfig && !licenseConfig.use_default && licenseConfig.license_pdf_url ? (
                <button
                  onClick={() => setPdfOpen(true)}
                  className="text-[13px] text-mint bg-transparent border-none cursor-pointer p-0 hover:underline"
                >
                  สัญญาอนุญาต →
                </button>
              ) : (
                <Link href="/agreement/" className="text-[13px] text-mint no-underline hover:underline">
                  สัญญาอนุญาต →
                </Link>
              )}
            </div>
          </div>

          {sliderPool.length > 0 && (
            <section className="mb-10">
              <h2 className="text-[13px] font-semibold text-[#aaa] tracking-[0.06em] uppercase mb-4">แนะนำ</h2>
              <div className="relative overflow-hidden">
                <div
                  className="flex"
                  style={{
                    transform: `translateX(calc(-${pos} * (100% / ${showCount})))`,
                    transition: animated ? "transform 0.45s cubic-bezier(.4,0,.2,1)" : "none",
                    width: `calc(${strip.length} * (100% / ${showCount}))`,
                  }}
                  onTransitionEnd={handleTransitionEnd}
                >
                  {strip.map((f, i) => (
                    <div key={i} style={{ width: `calc(100% / ${strip.length})` }} className="px-1.5">
                      <FontCard font={f} />
                    </div>
                  ))}
                </div>
                {poolSize > showCount && (
                  <>
                    <button onClick={() => move(-1)} className="absolute left-0 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-[28px] text-[#ccc] hover:text-navy transition-colors px-2 z-10 leading-none">‹</button>
                    <button onClick={() => move(1)} className="absolute right-0 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-[28px] text-[#ccc] hover:text-navy transition-colors px-2 z-10 leading-none">›</button>
                  </>
                )}
              </div>
              {poolSize > 1 && (
                <div className="flex justify-center gap-1.5 mt-3">
                  {sliderPool.map((_, i) => (
                    <button key={i} onClick={() => setPos(i + showCount)} className={`border-none cursor-pointer rounded-full transition-all ${i === dotIdx ? "w-5 h-[3px] bg-navy" : "w-[5px] h-[3px] bg-[#ddd]"}`} />
                  ))}
                </div>
              )}
            </section>
          )}

          <section>
            <h2 className="text-[13px] font-semibold text-[#aaa] tracking-[0.06em] uppercase mb-4">ฟอนต์ทั้งหมด</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {fonts.map((f) => <FontCard key={f.id} font={f} />)}
            </div>
          </section>
        </div>
      </div>
      <Footer />
      {licenseConfig?.license_pdf_url && (
        <PdfLightbox
          open={pdfOpen}
          url={licenseConfig.license_pdf_url}
          onClose={() => setPdfOpen(false)}
        />
      )}
    </>
  );
}
