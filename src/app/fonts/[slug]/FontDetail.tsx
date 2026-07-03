"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import FontCard, { Font } from "@/components/FontCard";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

function parseWeight(url: string): string {
  const decoded = decodeURIComponent(url.split("?")[0]);
  const filename = decoded.split("/").pop() || "";
  const base = filename.replace(/\.[^.]+$/, "");
  const parts = base.split("-");
  return parts.length > 1 ? parts[parts.length - 1] : "Regular";
}

function getUniqueWeights(urls: string[]): string[] {
  return [...new Set(urls.map(parseWeight))];
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
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const [font, setFont] = useState<Font | null>(null);
  const [related, setRelated] = useState<Font[]>([]);
  const [loading, setLoading] = useState(true);
  const [slideIdx, setSlideIdx] = useState(0);
  const [selectedWeight, setSelectedWeight] = useState("");
  const [fontSize, setFontSize] = useState("36");
  const [specimenOpen, setSpecimenOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(
          query(collection(db, "fonts"), where("slug", "==", slug), where("is_active", "==", true))
        );
        if (snap.empty) { setLoading(false); return; }

        const data = { id: snap.docs[0].id, ...snap.docs[0].data() } as Font;
        setFont(data);

        const allSnap = await getDocs(
          query(collection(db, "fonts"), where("is_active", "==", true))
        );
        const others = allSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Font)
          .filter((f) => f.slug !== slug);
        setRelated([...others].sort(() => Math.random() - 0.5).slice(0, 4));

        const files = data.full_font_files?.length
          ? data.full_font_files
          : data.free_font_files || [];
        const weights = getUniqueWeights(files);
        if (weights.length) setSelectedWeight(weights[0]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

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
          <div className="bg-white border border-[0.5px] border-border rounded-xl p-5 mb-5">
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <span className="text-[14px] font-semibold text-navy">
                ทดสอบฟอนต์
              </span>
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
            <div
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              className="w-full min-h-[80px] flex items-center bg-bg rounded-lg px-4 py-3 outline-none text-[#bbb] border border-[0.5px] border-border"
              style={{ fontSize: `${fontSize}px`, lineHeight: 1.45 }}
              onFocus={(e) => {
                if (e.currentTarget.textContent === "พิมพ์ทดสอบได้ที่นี่") {
                  e.currentTarget.textContent = "";
                  e.currentTarget.style.color = "var(--color-navy, #2B1B3D)";
                }
              }}
              onBlur={(e) => {
                if (!e.currentTarget.textContent?.trim()) {
                  e.currentTarget.textContent = "พิมพ์ทดสอบได้ที่นี่";
                  e.currentTarget.style.color = "";
                }
              }}
            >
              พิมพ์ทดสอบได้ที่นี่
            </div>
          </div>

          {/* 2-COLUMN */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">

            {/* LEFT: Font Info */}
            <div className="bg-white border border-[0.5px] border-border rounded-xl p-5">
              <div className="mb-4">
                <div className="text-[22px] font-semibold text-navy leading-snug">
                  {mainTitle}
                </div>
                {subTitle && (
                  <div className="text-[13px] text-[#aaa] mt-1">{subTitle}</div>
                )}
              </div>

              <div className="h-[0.5px] bg-border mb-3.5" />

              <table className="w-full text-[13px] border-collapse">
                <tbody>
                  <tr>
                    <td className="py-1.5 text-[#888] w-[45%]">น้ำหนัก</td>
                    <td className="py-1.5 font-medium text-navy text-right">
                      {weights.length || "—"}{weights.length ? " weights" : ""}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-[#888]">สไตล์</td>
                    <td className="py-1.5 font-medium text-navy text-right">
                      {styleCount || "—"}{styleCount ? " styles" : ""}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-[#888]">Font Format</td>
                    <td className="py-1.5 font-medium text-navy text-right">
                      {formats}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-[#888]">ผู้ออกแบบ</td>
                    <td className="py-1.5 font-medium text-navy text-right">
                      {font.designer_name || "ธรรมดาสตูดิโอ"}
                    </td>
                  </tr>
                </tbody>
              </table>

              {(font.description_th || font.tags?.length) && (
                <div className="h-[0.5px] bg-border my-3.5" />
              )}

              {font.description_th && (
                <p className="text-[13px] text-[#555] leading-[1.75]">
                  {font.description_th}
                </p>
              )}

              {font.tags && font.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {font.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-bg border border-[0.5px] border-border text-[#888]"
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
                    ดู Font Specimen
                  </button>
                </>
              )}
            </div>

            {/* RIGHT: Purchase */}
            <div className="bg-white border border-[0.5px] border-border rounded-xl p-5 flex flex-col gap-3.5">

              {/* Personal tier */}
              <div>
                <div className="text-[11px] font-semibold tracking-[0.06em] uppercase text-[#aaa] mb-2">
                  บุคคลทั่วไป
                </div>
                <div className="border border-[0.5px] border-border rounded-[8px] p-3 mb-2.5">
                  <div className="text-[11px] text-[#aaa] mb-1">
                    สิทธิการใช้งานสำหรับ
                  </div>
                  <div className="text-[13px] font-medium text-navy">
                    ผู้ใช้งานทั่วไป นิสิต นักศึกษา นักออกแบบอิสระ
                  </div>
                  <div className="flex justify-end mt-2.5">
                    {font.is_free ? (
                      <span className="text-[14px] font-semibold text-[#0a8a84]">
                        ฟรี
                      </span>
                    ) : font.is_sale ? (
                      <div className="flex items-baseline gap-2">
                        <span className="text-[15px] font-semibold text-navy">
                          ฿{(font.sale_price ?? 0).toLocaleString()}
                        </span>
                        <span className="text-[12px] text-[#bbb] line-through">
                          ฿{(font.price ?? 0).toLocaleString()}
                        </span>
                      </div>
                    ) : font.price ? (
                      <span className="text-[15px] font-semibold text-navy">
                        ฿{font.price.toLocaleString()}
                      </span>
                    ) : null}
                  </div>
                </div>

                {font.is_free ? (
                  <a
                    href={font.free_font_files?.[0] || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-2.5 text-center bg-mint text-navy rounded-[9px] text-[14px] font-semibold no-underline hover:bg-[#4bbdb7] transition-colors"
                  >
                    ดาวน์โหลดฟรี
                  </a>
                ) : (
                  <button className="w-full py-2.5 bg-mint text-navy rounded-[9px] text-[14px] font-semibold border-none cursor-pointer hover:bg-[#4bbdb7] transition-colors">
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
                <div className="bg-mint-light border border-[0.5px] border-mint-mid rounded-[8px] px-3.5 py-3">
                  <div className="text-[12px] font-semibold text-[#0a8a84] mb-1">
                    รวมอยู่ใน Subscription
                  </div>
                  <div className="text-[12px] text-[#0a8a84]">
                    เข้าถึงฟอนต์ทุกตัวด้วยแพลนรายเดือน
                  </div>
                  <Link
                    href="/coming-soon/"
                    className="text-[12px] text-[#0a8a84] no-underline block mt-1.5"
                  >
                    ดูแผนบริการ →
                  </Link>
                </div>
              )}

              <div className="h-[0.5px] bg-border" />

              {/* Org tiers */}
              <div>
                <div className="text-[11px] font-semibold tracking-[0.06em] uppercase text-[#aaa] mb-2">
                  ห้างร้าน องค์กร บริษัท
                </div>
                <div className="flex flex-col gap-2 mb-2.5">
                  {[
                    {
                      name: "บริษัทขนาดเล็ก / กลาง",
                      desc: "ผู้ใช้งานไม่เกิน 10 เครื่อง",
                      price: "฿3,500",
                    },
                    {
                      name: "บริษัทใหญ่ / Ad Agency",
                      desc: "ไม่จำกัดจำนวนเครื่อง",
                      price: "฿7,000",
                    },
                    {
                      name: "ใช้งานเพิ่มเติม (ข้อ 3)",
                      desc: "ตามสัญญาอนุญาต ข้อ 3",
                      price: "฿20,000",
                    },
                  ].map((tier) => (
                    <div
                      key={tier.name}
                      className="border border-[0.5px] border-border rounded-[8px] p-3"
                    >
                      <div className="flex justify-between items-baseline">
                        <span className="text-[13px] font-medium text-navy">
                          {tier.name}
                        </span>
                        <span className="text-[13px] font-semibold text-navy">
                          {tier.price}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#aaa] mt-0.5">
                        {tier.desc}
                      </div>
                    </div>
                  ))}
                </div>
                <Link
                  href="/quote/"
                  className="flex items-center justify-center gap-2 w-full py-2.5 border border-[0.5px] border-[#ddd] rounded-[9px] text-[14px] text-navy no-underline hover:border-navy transition-colors"
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

      {/* SPECIMEN SLIDE PANEL */}
      <div
        className={`fixed inset-0 z-[100] transition-opacity duration-300 ${specimenOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        style={{ background: "rgba(0,0,0,0.4)" }}
        onClick={() => setSpecimenOpen(false)}
      />
      <div
        className={`fixed top-0 right-0 bottom-0 z-[101] flex flex-col bg-white border-l border-[0.5px] border-border transition-transform duration-300 ${specimenOpen ? "translate-x-0" : "translate-x-full"}`}
        style={{ width: 440, maxWidth: "90vw" }}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[0.5px] border-border flex-shrink-0">
          <div>
            <div className="text-[14px] font-semibold text-navy">
              Font Specimen
            </div>
            <div className="text-[12px] text-[#aaa] mt-0.5">{font.name}</div>
          </div>
          <button
            onClick={() => setSpecimenOpen(false)}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-bg border-none cursor-pointer text-[#aaa] hover:text-navy bg-transparent transition-colors"
            aria-label="ปิด"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {font.specimen_files?.map((url, i) => (
            <iframe
              key={i}
              src={url}
              title={`Specimen ${i + 1}`}
              className="w-full rounded-lg border border-[0.5px] border-border"
              style={{ height: 560 }}
            />
          ))}
        </div>
      </div>

      <Footer />
    </>
  );
}
