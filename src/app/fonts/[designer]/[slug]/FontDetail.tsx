"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import FontCard, { Font } from "@/components/FontCard";
import AdBanner from "@/components/AdBanner";
import Button from "@/components/Button";
import TypeTester from "./TypeTester";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useFavourites } from "@/context/FavouritesContext";
import { trackFontView, trackFreeDownload } from "@/lib/track";
import { parseLicenseSettings, parseDesignerTiers, type LicenseTier } from "@/lib/license";

function parseWeight(url: string): string {
  const decoded = decodeURIComponent(url.split("?")[0]);
  const filename = decoded.split("/").pop() || "";
  const base = filename.replace(/\.[^.]+$/, "");
  const parts = base.split("-");
  return parts.length > 1 ? parts[parts.length - 1] : "Regular";
}

const WEIGHT_MAP: Record<string, number> = {
  thin: 100, extralight: 200, ultralight: 200, light: 300,
  regular: 400, normal: 400, medium: 500, semibold: 600,
  demibold: 600, bold: 700, extrabold: 800, ultrabold: 800,
  black: 900, heavy: 900,
};

function weightToCss(name: string): number {
  return WEIGHT_MAP[name.toLowerCase()] ?? 400;
}

function getUniqueWeights(urls: string[]): string[] {
  const unique = [...new Set(urls.map(parseWeight))];
  return unique.sort((a, b) => weightToCss(a) - weightToCss(b));
}

function getFormats(urls: string[]): string {
  const exts = new Set(
    urls
      .map((u) => {
        const decoded = decodeURIComponent(u.split("?")[0]);
        return decoded.split("/").pop()?.split(".").pop()?.toUpperCase();
      })
      .filter((e): e is string => !!e && e !== "ZIP")
  );
  return [...exts].join(", ") || "—";
}

export default function FontDetail({ initialFont }: { initialFont?: Font | null }) {
  const { user } = useAuth();
  const router = useRouter();
  const { isFavourite, toggle } = useFavourites();
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const [font, setFont] = useState<Font | null>(initialFont ?? null);
  const [related, setRelated] = useState<Font[]>([]);
  const [loading, setLoading] = useState(!initialFont);
  const [defaultTiers, setDefaultTiers] = useState<LicenseTier[]>(() => parseLicenseSettings(null));
  const [customLicenseTiers, setCustomLicenseTiers] = useState<LicenseTier[] | null>(null);
  const [promotion, setPromotion] = useState<{ discount_percent: number; sale_end: string; active: boolean } | null>(null);
  const [slideIdx, setSlideIdx] = useState(0);
  const [specimenOpen, setSpecimenOpen] = useState(false);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!slug) return;
    async function load() {
      // Flatten nested users join into font object
      // embed ผ่าน view designer_profiles ไม่ใช่ users — ตั้งแต่ 0054 anon อ่าน users ไม่ได้แล้ว
      // (bank/tax_id อยู่ในนั้น) ถ้า embed users ทั้ง query จะ 401 ทำให้ related fonts หายและ
      // client-side nav หาฟอนต์ไม่เจอ
      type RawFont = { designer_profiles?: { designer_slug?: string; business_name?: string } | null } & Record<string, unknown>;
      const flattenFont = (r: RawFont): Font => ({ ...(r as unknown as Font), designer_slug: r.designer_profiles?.designer_slug ?? undefined, designer_business_name: r.designer_profiles?.business_name ?? undefined });

      try {
        // If initialFont was not provided (client-side nav), fetch the font too
        const fontPromise = initialFont
          ? Promise.resolve({ data: null })
          : supabase.from("fonts").select("*, designer_profiles!owner_id(designer_slug, business_name)").eq("slug", slug).eq("is_active", true).not("published_at", "is", null).limit(1);

        const [fontResult, { data: allRows }, { data: settings }] = await Promise.all([
          fontPromise,
          supabase.from("fonts").select("*, designer_profiles!owner_id(designer_slug, business_name)").eq("is_active", true).not("published_at", "is", null),
          supabase.from("settings").select("key, value").in("key", ["licensing", "promotion"]),
        ]);

        let currentFont = initialFont ?? null;
        if (!initialFont) {
          const fontRows = (fontResult as { data: unknown[] | null }).data;
          if (!fontRows?.length) { setLoading(false); return; }
          currentFont = flattenFont(fontRows[0] as unknown as RawFont);
          setFont(currentFont);
        }

        const others = ((allRows ?? []) as unknown as RawFont[]).map(flattenFont).filter((f) => f.slug !== slug);
        setRelated([...others].sort(() => Math.random() - 0.5).slice(0, 4));

        for (const row of (settings ?? []) as { key: string; value: Record<string, unknown> }[]) {
          const v = row.value;
          if (row.key === "licensing") {
            setDefaultTiers(parseLicenseSettings(v));
          } else if (row.key === "promotion") {
            setPromotion({ discount_percent: (v.discount_percent as number) ?? 0, sale_end: (v.sale_end as string) ?? "", active: !!(v.active) });
          }
        }

        const ownerId = (currentFont as unknown as { owner_id?: string })?.owner_id;
        if (ownerId) {
          const { data: licConfig } = await supabase
            .from("designer_license_config")
            .select("use_default, tiers")
            .eq("designer_id", ownerId)
            .single();
          if (licConfig && !licConfig.use_default) {
            const parsed = parseDesignerTiers(licConfig.tiers);
            if (parsed.length > 0) setCustomLicenseTiers(parsed);
          }
        }
      } catch {
        // โหลดข้อมูลเสริมไม่สำเร็จ — หน้าเพจยังแสดงจาก initialFont ได้
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  useEffect(() => {
    if (!font?.id) return;
    trackFontView(font.id);
  }, [font?.id]);

  // Global promotion — applies when font has no individual sale
  const activePromo = (() => {
    if (!promotion?.active || !promotion.discount_percent) return null;
    if (promotion.sale_end) {
      const [d, m, y] = promotion.sale_end.split("/").map(Number);
      const end = new Date(y, m - 1, d, 23, 59, 59);
      if (Date.now() > end.getTime()) return null;
    }
    return promotion;
  })();

  // ซื้อฟอนต์ (สิทธิ์บุคคลทั่วไป) — สร้าง Stripe Checkout Session ฝั่ง server
  // แล้วพาไปหน้าจ่ายเงิน ราคาคำนวณจาก DB ที่ server ไม่ได้ส่งจาก client
  async function handleBuy() {
    if (!font || buying) return;
    setBuying(true);
    setBuyError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          font_id: font.id,
          cancel_path: `/fonts/${font.designer_slug ?? ""}/${font.slug}/`,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; url?: string };
      if (data.ok && data.url) {
        window.location.href = data.url;
        return; // คง loading ไว้ระหว่าง browser พาไป Stripe
      }
      setBuyError("เริ่มการชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } catch {
      setBuyError("เริ่มการชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    }
    setBuying(false);
  }

  const images: string[] = font
    ? [font.cover_image_url, ...(font.preview_images || [])].filter(
        (u): u is string => !!u
      )
    : [];

  useEffect(() => {
    if (images.length <= 1) return;
    timerRef.current = setInterval(
      () => setSlideIdx((i) => (i + 1) % images.length),
      5000
    );
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [images.length]);

  function moveSlide(dir: number) {
    setSlideIdx((i) => (i + dir + images.length) % images.length);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = setInterval(
        () => setSlideIdx((i) => (i + 1) % images.length),
        5000
      );
    }
  }

  if (loading) {
    return (
      <>
        <Nav />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-[14px] text-[#aaa]">กำลังโหลด...</div>
        </div>
        <Footer />
      </>
    );
  }

  if (!font) {
    return (
      <>
        <Nav />
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
          <div className="text-[18px] font-semibold text-navy">ไม่พบฟอนต์นี้</div>
          <Link href="/" className="text-[14px] text-mint no-underline">
            ← กลับหน้าแรก
          </Link>
        </div>
        <Footer />
      </>
    );
  }

  // น้ำหนัก / สไตล์ / Font Format มาจากคอลัมน์ที่ FontForm คำนวณจากไฟล์ Full Family
  // ตอนบันทึก (ดู src/lib/font-meta.ts + migration 0060) — หน้านี้เป็นหน้าสาธารณะ
  // จึงอ่าน font_files_private เองไม่ได้ และไฟล์ demo ก็ไม่ได้สะท้อนของที่ลูกค้าซื้อ
  // (demo ที่ระบบ gen ให้มีไฟล์เดียว → เคยทำให้ Font Format โชว์แค่ OTF ทั้งที่ขาย OTF+TTF)
  //
  // fallback ไปคำนวณจากไฟล์ demo/free เฉพาะฟอนต์เก่าที่ยังไม่มีคอลัมน์ใหม่
  const infoFiles = font.is_free ? font.free_font_files || [] : font.demo_font_files || [];
  const formats = font.formats?.length ? font.formats.join(", ") : getFormats(infoFiles);
  const weightTotal = font.weight_count || getUniqueWeights(infoFiles).length;
  const styleCount = font.style_count || weightTotal;

  const mainTitle = font.name_th || font.name || "—";
  const subTitle = font.name_th ? font.name : undefined;

  return (
    <>
      <Nav />
      <div className="bg-bg min-h-screen">
        <div className="max-w-site mx-auto px-8 py-8">

          {/* IMAGE SLIDER */}
          <div
            className="relative bg-navy rounded-xl overflow-hidden mb-6"
            style={{ aspectRatio: "16/9" }}
          >
            {images.length > 0 ? (
              <img
                src={images[slideIdx]}
                alt={font.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-[28px] font-semibold text-white/20">
                  {font.name}
                </span>
              </div>
            )}

            {images.length > 1 && (
              <>
                <button
                  onClick={() => moveSlide(-1)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center border-none cursor-pointer transition-colors"
                  aria-label="ก่อนหน้า"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <button
                  onClick={() => moveSlide(1)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center border-none cursor-pointer transition-colors"
                  aria-label="ถัดไป"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {images.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setSlideIdx(i)}
                      className={`border-none cursor-pointer rounded-full transition-all ${
                        i === slideIdx
                          ? "w-5 h-[3px] bg-navy"
                          : "w-[5px] h-[3px] bg-[#ddd]"
                      }`}
                      aria-label={`รูป ${i + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* TYPE TESTER */}
          <TypeTester font={font} />

          {/* 2-COLUMN */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">

            {/* LEFT: Font Info */}
            <div className="bg-white border border-[0.5px] border-border rounded-xl p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[26px] font-semibold text-navy leading-snug">
                    {mainTitle}
                  </div>
                  {subTitle && (
                    <div className="text-[14px] text-[#aaa] mt-1">{subTitle}</div>
                  )}
                </div>

                {/* บันทึกไว้ดูภายหลัง — เหลือแค่ไอคอนเพราะพื้นที่ข้างชื่อฟอนต์จำกัด
                    ข้อความเดิมย้ายไปอยู่ใน aria-label/title แทน */}
                <button
                  type="button"
                  onClick={() => {
                    if (!user) {
                      router.push(`/auth/login?next=${encodeURIComponent(`/fonts/${font.designer_slug ?? ""}/${font.slug}/`)}`);
                      return;
                    }
                    toggle(font.id);
                  }}
                  aria-pressed={isFavourite(font.id)}
                  aria-label={isFavourite(font.id) ? "บันทึกแล้ว" : "บันทึกไว้ดูภายหลัง"}
                  title={isFavourite(font.id) ? "บันทึกแล้ว" : "บันทึกไว้ดูภายหลัง"}
                  className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-white text-navy hover:text-mint transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill={isFavourite(font.id) ? "#5ECEC8" : "none"} stroke={isFavourite(font.id) ? "#5ECEC8" : "currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </button>
              </div>

              <div className="h-[0.5px] bg-border mb-3.5" />

              <table className="w-full text-[14px] border-collapse">
                <tbody>
                  <tr>
                    <td className="py-1 text-[#888] w-[45%]">น้ำหนัก</td>
                    <td className="py-1 font-medium text-navy text-right">
                      {weightTotal || "—"}{weightTotal ? " weights" : ""}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 text-[#888]">สไตล์</td>
                    <td className="py-1 font-medium text-navy text-right">
                      {styleCount || "—"}{styleCount ? " styles" : ""}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 text-[#888]">Font Format</td>
                    <td className="py-1 font-medium text-navy text-right">
                      {formats}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 text-[#888]">ออกแบบโดย</td>
                    <td className="py-1 font-medium text-right">
                      {font.designer_slug ? (
                        <Link href={`/designer/${font.designer_slug}`} className="text-mint no-underline hover:underline">
                          {font.designer_business_name || font.designer_name || "ธรรมดาสตูดิโอ"}
                        </Link>
                      ) : (
                        <span className="text-navy">{font.designer_name || "ธรรมดาสตูดิโอ"}</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>

              {(font.description_th || font.tags?.length) && (
                <div className="h-[0.5px] bg-border my-3.5" />
              )}

              {font.description_th && (
                <p className="text-[14px] text-[#555] leading-[1.55] whitespace-pre-line">
                  {font.description_th}
                </p>
              )}

              {font.tags && font.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {font.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[12px] px-2 py-0.5 rounded-full bg-bg border border-[0.5px] border-border text-[#888]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {font.specimen_files && font.specimen_files.length > 0 && (
                <>
                  <div className="h-[0.5px] bg-border mt-4 mb-3" />
                  <button
                    onClick={() => setSpecimenOpen(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 text-[13px] text-navy border border-[0.5px] border-border rounded-[8px] bg-transparent hover:border-navy cursor-pointer transition-colors"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    ดูตัวอย่างฟอนต์เพิ่มเติม
                  </button>
                </>
              )}
            </div>

            {/* RIGHT: Purchase */}
            <div className="bg-white border border-[0.5px] border-border rounded-xl p-5 flex flex-col gap-3.5">

              {/* Personal tier */}
              <div>
                <div className="text-[13px] font-semibold tracking-[0.06em] uppercase text-[#aaa] mb-2">
                  บุคคลทั่วไป
                </div>
                <div className="border border-[0.5px] border-border rounded-[8px] p-3 mb-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[14px] font-medium text-navy">
                      ผู้ใช้งานทั่วไป นิสิต นักศึกษา นักออกแบบอิสระ
                    </span>
                    <span className="flex items-center gap-1.5 ml-3 shrink-0">
                      {font.is_free ? (
                        <span className="text-[15px] font-semibold text-[#0a8a84]">ฟรี</span>
                      ) : font.is_sale ? (
                        <>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#f0c040] text-[#5a3800] font-semibold">
                            -{font.discount_percent ?? 0}%
                          </span>
                          <span className="text-[15px] font-semibold text-navy">
                            ฿{(font.sale_price ?? 0).toLocaleString()}
                          </span>
                          <span className="text-[12px] text-[#bbb] line-through">
                            ฿{(font.price ?? 0).toLocaleString()}
                          </span>
                        </>
                      ) : font.price && activePromo ? (
                        <>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#f0c040] text-[#5a3800] font-semibold">
                            -{activePromo.discount_percent}%
                          </span>
                          <span className="text-[15px] font-semibold text-navy">
                            ฿{Math.round(font.price * (1 - activePromo.discount_percent / 100)).toLocaleString()}
                          </span>
                          <span className="text-[12px] text-[#bbb] line-through">
                            ฿{font.price.toLocaleString()}
                          </span>
                        </>
                      ) : font.price ? (
                        <span className="text-[15px] font-semibold text-navy">
                          ฿{font.price.toLocaleString()}
                        </span>
                      ) : null}
                    </span>
                  </div>
                </div>

                {font.is_free ? (
                  user ? (
                    <Button as="a" href={font.free_font_files?.[0] || "#"} external size="lg" className="w-full" onClick={() => trackFreeDownload(font.id)}>
                      ดาวน์โหลดฟรี
                    </Button>
                  ) : (
                    <div>
                      <Button
                        as="link"
                        href={`/auth/login/?next=${encodeURIComponent(`/fonts/${font.designer_slug ?? ""}/${font.slug}/`)}`}
                        size="lg"
                        className="w-full"
                      >
                        เข้าสู่ระบบเพื่อดาวน์โหลดฟรี
                      </Button>
                      <p className="text-[11px] text-[#aaa] text-center mt-1.5">
                        สมัครสมาชิกฟรี ใช้เวลาไม่ถึงนาที
                      </p>
                    </div>
                  )
                ) : (
                  <div>
                    <Button
                      size="lg"
                      className="w-full"
                      disabled={!font.price || buying}
                      onClick={handleBuy}
                    >
                      {buying ? "กำลังไปหน้าชำระเงิน..." : "ซื้อฟอนต์นี้"}
                    </Button>
                    {buyError && (
                      <p className="text-[12px] text-[#c0392b] text-center mt-1.5">{buyError}</p>
                    )}
                    <p className="text-[11px] text-[#aaa] text-center mt-1.5">
                      ชำระผ่าน PromptPay หรือบัตรเครดิต — ดาวน์โหลดได้ทันที
                    </p>
                  </div>
                )}

              </div>

              {font.demo_font_files && font.demo_font_files.length > 0 && (
                  <a
                    href={font.demo_font_files[0]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 border border-[0.5px] border-[#ddd] rounded-[9px] text-[14px] text-navy no-underline hover:border-navy transition-colors"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    ดาวน์โหลด Demo ฟรี
                  </a>
                )}

              {font.is_subscription && (
                <div className="bg-mint-light border border-[0.5px] border-mint-mid rounded-[8px] px-3.5 py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[12px] font-semibold text-[#0a8a84] mb-1">
                      รวมอยู่ใน Subscription
                    </div>
                    <div className="text-[12px] text-[#0a8a84]">
                      เข้าถึงฟอนต์ทุกตัวด้วยแพลนรายเดือน
                    </div>
                  </div>
                  <Link
                    href="/subscribe/"
                    className="flex-shrink-0 text-[12px] font-medium text-[#0a8a84] no-underline bg-white border border-[0.5px] border-mint rounded-[7px] px-3 py-1.5 hover:bg-mint hover:text-navy transition-colors"
                  >
                    ดูแผนบริการ
                  </Link>
                </div>
              )}

              <div className="h-[0.5px] bg-border" />

              {/* Org tiers */}
              <div>
                <div className="text-[13px] font-semibold tracking-[0.06em] uppercase text-[#aaa] mb-2">
                  ห้างร้าน องค์กร บริษัท
                </div>
                <div className="flex flex-col gap-2 mb-2.5">
                  {customLicenseTiers ? (
                    customLicenseTiers.map((tier) => (
                      <div key={tier.id} className="border border-[0.5px] border-border rounded-[8px] p-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[14px] font-medium text-navy">{tier.name}</span>
                          <span className="text-[14px] font-semibold text-navy ml-3 shrink-0">฿{tier.price.toLocaleString()}</span>
                        </div>
                        {tier.desc && (
                          <div className="text-[12px] text-[#aaa] mt-0.5">{tier.desc}</div>
                        )}
                      </div>
                    ))
                  ) : (
                    defaultTiers.map((tier) => (
                      <div key={tier.id} className="border border-[0.5px] border-border rounded-[8px] p-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[14px] font-medium text-navy">{tier.name}</span>
                          <span className="text-[14px] font-semibold text-navy ml-3 shrink-0">฿{tier.price.toLocaleString()}</span>
                        </div>
                        {tier.desc && (
                          <div className="text-[12px] text-[#aaa] mt-0.5">{tier.desc}</div>
                        )}
                      </div>
                    ))
                  )}
                </div>
                <div className="text-[12px] text-[#aaa] mb-2.5">
                  ดูรายละเอียด{" "}
                  <Link href="/agreement/" className="text-mint no-underline hover:underline">สัญญาอนุญาต</Link>
                </div>
                <Button
                  as="link"
                  href={`/quote/?font=${font.slug}&designer_slug=${font.designer_slug ?? ""}`}
                  size="lg"
                  className="w-full"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  ขอใบเสนอราคา
                </Button>
              </div>

            </div>
          </div>

          {/* RELATED FONTS */}
          {related.length > 0 && (
            <div>
              <AdBanner slot="1401819374" className="-mx-5 mb-6" />
              <div className="text-[15px] font-semibold text-navy mb-4">
                ฟอนต์ที่คุณน่าจะสนใจ
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {related.map((f) => (
                  <FontCard key={f.id} font={f} />
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* SPECIMEN LIGHTBOX */}
      {specimenOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[100]"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={() => setSpecimenOpen(false)}
          />

          {/* Modal — 80vw, 90vh, centered */}
          <div
            className="fixed z-[101] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden"
            style={{
              width: "80vw",
              maxWidth: 1100,
              height: "90vh",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Fixed header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[0.5px] border-border flex-shrink-0 gap-4">
              <div className="min-w-0">
                <div className="text-[15px] font-semibold text-navy">ตัวอย่างฟอนต์เพิ่มเติม</div>
                <div className="text-[12px] text-[#aaa] mt-0.5">{font.name}{font.name_th ? ` — ${font.name_th}` : ""}</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setSpecimenOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-bg border-none cursor-pointer text-[#aaa] hover:text-navy bg-transparent transition-colors"
                  aria-label="ปิด"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
              {font.specimen_files?.map((url, i) => (
                <iframe
                  key={i}
                  src={url}
                  title={`Specimen ${i + 1}`}
                  className="w-full rounded-lg border border-[0.5px] border-border"
                  style={{ height: "75vh" }}
                />
              ))}
            </div>
          </div>
        </>
      )}

      <Footer />
    </>
  );
}
