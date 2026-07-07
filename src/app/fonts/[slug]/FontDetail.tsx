"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import FontCard, { Font } from "@/components/FontCard";
import AdBanner from "@/components/AdBanner";
import { supabase } from "@/lib/supabase";

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

export default function FontDetail() {
  const params = useParams();
  // slug starts empty — set from window.location.pathname on mount
  // (Firebase Hosting rewrites /fonts/[slug] → /fonts/_/, so useParams gives "_")
  const [font, setFont] = useState<Font | null>(null);
  const [related, setRelated] = useState<Font[]>([]);
  const [loading, setLoading] = useState(true);
  const [licensing, setLicensing] = useState({ small: 3500, large: 7000, extra: 20000 });
  const [promotion, setPromotion] = useState<{ discount_percent: number; sale_end: string; active: boolean } | null>(null);

  const resolvedSlug = (() => {
    const paramSlug = typeof params?.slug === "string" ? params.slug : "";
    if (paramSlug && paramSlug !== "_") return paramSlug;
    if (typeof window !== "undefined") {
      const parts = window.location.pathname.split("/").filter(Boolean);
      return parts[parts.length - 1] || "";
    }
    return "";
  })();
  const [slug, setSlug] = useState(resolvedSlug);

  useEffect(() => {
    if (resolvedSlug && resolvedSlug !== slug) setSlug(resolvedSlug);
  }, [resolvedSlug]);
  const [slideIdx, setSlideIdx] = useState(0);
  const [selectedWeight, setSelectedWeight] = useState("");
  const [fontSize, setFontSize] = useState("36");
  const [testerInput, setTesterInput] = useState("");
  const [specimenOpen, setSpecimenOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!slug) return;
    async function load() {
      setLoading(true);
      try {
        const [{ data: fontRows }, { data: allRows }, { data: settings }] = await Promise.all([
          supabase.from("fonts").select("*").eq("slug", slug).eq("is_active", true).limit(1),
          supabase.from("fonts").select("*").eq("is_active", true),
          supabase.from("settings").select("key, value").in("key", ["licensing", "promotion"]),
        ]);

        if (!fontRows?.length) { setLoading(false); return; }

        const data = fontRows[0] as Font;
        setFont(data);

        const others = ((allRows ?? []) as Font[]).filter((f) => f.slug !== slug);
        setRelated([...others].sort(() => Math.random() - 0.5).slice(0, 4));

        const files = data.full_font_files?.length ? data.full_font_files : data.free_font_files || [];
        const weights = getUniqueWeights(files);
        if (weights.length) setSelectedWeight(weights[0]);

        for (const row of (settings ?? []) as { key: string; value: Record<string, unknown> }[]) {
          const v = row.value;
          if (row.key === "licensing") {
            setLicensing({ small: (v.small as number) ?? 3500, large: (v.large as number) ?? 7000, extra: (v.extra as number) ?? 20000 });
          } else if (row.key === "promotion") {
            setPromotion({ discount_percent: (v.discount_percent as number) ?? 0, sale_end: (v.sale_end as string) ?? "", active: !!(v.active) });
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

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

  // Inject @font-face — free fonts use files directly; paid fonts use obfuscated files
  useEffect(() => {
    if (!font?.slug) return;

    const isFree = font.is_free === true;
    const previewFiles = isFree
      ? (font.free_font_files ?? font.full_font_files ?? [])
      : (font.obfuscated_font_files ?? []);
    if (!previewFiles.length) return;

    const family = `preview-${font.slug}`;
    const faces = previewFiles.map((url) => {
      const ext = decodeURIComponent(url.split("?")[0]).split(".").pop()?.toLowerCase() || "woff2";
      const fmt = ext === "otf" ? "opentype" : ext === "ttf" ? "truetype" : ext;
      const urlForWeight = isFree ? url : url.replace(/-obf\.(ttf|otf)(\?|$)/i, ".$1$2");
      const w = weightToCss(parseWeight(urlForWeight));
      return `@font-face { font-family: "${family}"; font-weight: ${w}; src: url("${url}") format("${fmt}"); font-display: block; }`;
    }).join("\n");

    const style = document.createElement("style");
    style.id = `preview-font-${font.slug}`;
    style.textContent = faces;
    document.head.appendChild(style);
    return () => { document.getElementById(`preview-font-${font.slug}`)?.remove(); };
  }, [font?.slug, font?.is_free]);

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

  const fontFiles = font.full_font_files?.length
    ? font.full_font_files
    : font.free_font_files || [];
  const weights = getUniqueWeights(fontFiles);
  const formats = getFormats(fontFiles);
  const styleCount = fontFiles.filter(
    (u) => !u.toLowerCase().endsWith(".zip")
  ).length;

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
            style={{ aspectRatio: "16/7" }}
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
                          ? "w-5 h-[3px] bg-mint"
                          : "w-[5px] h-[3px] bg-white/30"
                      }`}
                      aria-label={`รูป ${i + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* TYPE TESTER */}
          {/* Font face is injected via <style> tag when font data loads — see useEffect below */}
          <div className="bg-white border border-[0.5px] border-border rounded-xl p-5 mb-5">
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <span className="text-[15px] font-semibold text-navy">ทดสอบฟอนต์</span>
              <div className="flex gap-2">
                <select
                  value={fontSize}
                  onChange={(e) => setFontSize(e.target.value)}
                  className="text-[13px] px-3 py-1.5 border border-[0.5px] border-[#ddd] rounded-[8px] bg-white text-navy outline-none cursor-pointer"
                >
                  {["18", "24", "36", "48", "64"].map((s) => (
                    <option key={s} value={s}>{s}px</option>
                  ))}
                </select>
                {weights.length > 0 && (
                  <select
                    value={selectedWeight}
                    onChange={(e) => setSelectedWeight(e.target.value)}
                    className="text-[13px] px-3 py-1.5 border border-[0.5px] border-[#ddd] rounded-[8px] bg-white text-navy outline-none cursor-pointer"
                  >
                    {weights.map((w) => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div className="relative w-full h-[140px]">
              {/* Display layer: encoded text rendered with obfuscated font */}
              <div
                aria-hidden
                className="absolute inset-0 bg-bg rounded-lg px-4 py-3 border border-[0.5px] border-border pointer-events-none whitespace-pre-wrap break-words overflow-hidden"
                style={{
                  fontSize: `${fontSize}px`,
                  lineHeight: 1.45,
                  fontFamily: font ? `"preview-${font.slug}", sans-serif` : undefined,
                  fontWeight: weightToCss(selectedWeight),
                  color: testerInput ? "var(--color-navy, #2B1B3D)" : "#bbb",
                }}
              >
                {testerInput
                  ? ((!font?.is_free && font?.obfuscated_map)
                      ? [...testerInput].map((ch) => font.obfuscated_map![ch] ?? ch).join("")
                      : testerInput)
                  : "พิมพ์ทดสอบได้ที่นี่"}
              </div>
              {/* Input layer: same font applied so cursor aligns with display */}
              <textarea
                value={testerInput}
                onChange={(e) => setTesterInput(e.target.value)}
                spellCheck={false}
                className="absolute inset-0 w-full h-full resize-none bg-transparent outline-none rounded-lg px-4 py-3 border border-transparent"
                style={{
                  fontSize: `${fontSize}px`,
                  lineHeight: 1.45,
                  color: "transparent",
                  caretColor: "var(--color-navy, #2B1B3D)",
                }}
              />
            </div>
          </div>

          {/* 2-COLUMN */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">

            {/* LEFT: Font Info */}
            <div className="bg-white border border-[0.5px] border-border rounded-xl p-5">
              <div className="mb-4">
                <div className="text-[26px] font-semibold text-navy leading-snug">
                  {mainTitle}
                </div>
                {subTitle && (
                  <div className="text-[14px] text-[#aaa] mt-1">{subTitle}</div>
                )}
              </div>

              <div className="h-[0.5px] bg-border mb-3.5" />

              <table className="w-full text-[14px] border-collapse">
                <tbody>
                  <tr>
                    <td className="py-1 text-[#888] w-[45%]">น้ำหนัก</td>
                    <td className="py-1 font-medium text-navy text-right">
                      {weights.length || "—"}{weights.length ? " weights" : ""}
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
                    <td className="py-1 text-[#888]">ผู้ออกแบบ</td>
                    <td className="py-1 font-medium text-navy text-right">
                      {font.designer_name || "ธรรมดาสตูดิโอ"}
                    </td>
                  </tr>
                </tbody>
              </table>

              {(font.description_th || font.tags?.length) && (
                <div className="h-[0.5px] bg-border my-3.5" />
              )}

              {font.description_th && (
                <p className="text-[14px] text-[#555] leading-[1.55]">
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
                  <a
                    href={font.free_font_files?.[0] || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-2.5 text-center bg-navy text-white rounded-[9px] text-[15px] font-semibold no-underline hover:bg-mint hover:text-navy transition-colors"
                  >
                    ดาวน์โหลดฟรี
                  </a>
                ) : (
                  <button className="w-full py-2.5 bg-navy text-white rounded-[9px] text-[15px] font-semibold border-none cursor-pointer hover:bg-mint hover:text-navy transition-colors">
                    ซื้อฟอนต์นี้
                  </button>
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
                  {[
                    { name: "บริษัทขนาดเล็ก / กลาง", desc: "ผู้ใช้งานไม่เกิน 10 เครื่อง", price: licensing.small },
                    { name: "บริษัทใหญ่ / Ad Agency", desc: "ไม่จำกัดจำนวนเครื่อง", price: licensing.large },
                  ].map((tier) => (
                    <div key={tier.name} className="border border-[0.5px] border-border rounded-[8px] p-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[14px] font-medium text-navy">{tier.name}</span>
                        <span className="text-[14px] font-semibold text-navy ml-3 shrink-0">฿{tier.price.toLocaleString()}</span>
                      </div>
                      <div className="text-[12px] text-[#aaa] mt-0.5">{tier.desc}</div>
                    </div>
                  ))}
                  <div className="border border-[0.5px] border-border rounded-[8px] p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[14px] font-medium text-navy">ใช้งานเพิ่มเติม ตาม ข้อ (3) ใน สัญญาอนุญาต</span>
                      <span className="text-[14px] font-semibold text-navy ml-3 shrink-0">฿{licensing.extra.toLocaleString()}</span>
                    </div>
                    <div className="text-[12px] text-[#aaa] mt-0.5">
                      ดูรายละเอียด{" "}
                      <Link href="/agreement/" className="text-mint no-underline hover:underline">สัญญาอนุญาต</Link>
                    </div>
                  </div>
                </div>
                <Link
                  href={`/quote/?font=${font.slug}`}
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-navy border border-[0.5px] border-navy rounded-[9px] text-[15px] text-white no-underline hover:bg-mint hover:border-mint hover:text-navy transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  ขอใบเสนอราคา
                </Link>
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
