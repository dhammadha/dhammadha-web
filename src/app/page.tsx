"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import FontCard, { Font, isNew } from "@/components/FontCard";

// ── Helpers ──────────────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

const SLIDER_SIZE = 8;
const VISIBLE = 3;

function buildSliderPool(fonts: Font[]): Font[] {
  const sale = fonts.filter((f) => f.is_sale);
  const others = shuffle(fonts.filter((f) => !f.is_sale));
  return [...sale, ...others].slice(0, SLIDER_SIZE);
}

// ── Page ─────────────────────────────────────────────────────────────────────
const GRID_SHOW = 11;

export default function HomePage() {
  const [fonts, setFonts] = useState<Font[]>([]);
  const [sliderPool, setSliderPool] = useState<Font[]>([]);
  const [slide, setSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const q = query(
          collection(db, "fonts"),
          where("is_active", "==", true),
          orderBy("created_at", "desc")
        );
        const snap = await getDocs(q);
        const active = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Font[];
        setFonts(active);
        setSliderPool(buildSliderPool(active));

      } catch (e) {
        console.error("Firestore error:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const n = sliderPool.length;

  useEffect(() => {
    if (!n) return;
    timerRef.current = setInterval(() => {
      setSlide((s) => (s + 1) % n);
    }, 4000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [n]);

  const sliderVisible = n > 0
    ? [0, 1, 2].map((i) => sliderPool[(slide + i) % n])
    : [];
  const gridFonts = fonts.slice(0, GRID_SHOW);
  const remaining = fonts.length - GRID_SHOW;

  function moveSlide(dir: number) {
    if (!n) return;
    setSlide((s) => (s + dir + n) % n);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => setSlide((s) => (s + 1) % n), 4000);
    }
  }

  return (
    <>
      <Nav />

      {/* HERO */}
      <section className="bg-white">
        <div className="max-w-site mx-auto px-8 pt-14 pb-12">
          <h1 className="text-[46px] font-semibold text-navy leading-[1.1] tracking-[-1px] mb-3.5">
            ฟอนต์ไทย<br />ที่ <em className="text-mint not-italic">ออกแบบ</em> อย่างพิถีพิถัน
          </h1>
          <p className="text-[15px] text-[#666] leading-[1.65] max-w-[480px] mb-7">
            คลังฟอนต์ภาษาไทยคุณภาพสูง สำหรับนักออกแบบ แบรนด์ และครีเอเตอร์ไทย
          </p>
          <div className="flex gap-2.5">
            <Link
              href="/#fonts"
              className="px-[22px] py-2.5 bg-white text-navy border border-[0.25px] border-[#ddd] rounded-[6px] text-[14px] font-medium no-underline hover:bg-navy hover:text-white hover:border-navy transition-all"
            >
              ดูฟอนต์ทั้งหมด
            </Link>
            <Link
              href="/#pricing"
              className="px-[18px] py-2.5 bg-white text-navy border border-[0.25px] border-[#ddd] rounded-[6px] text-[14px] font-medium no-underline hover:bg-navy hover:text-white hover:border-navy transition-all"
            >
              ราคาและแผนบริการ
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURED SLIDER */}
      <div className="bg-bg">
        <div className="max-w-site mx-auto px-8 py-6">
          <div className="flex justify-between items-center mb-3.5">
            <span className="text-[32px] font-semibold text-navy">คัดสรรพิเศษ</span>
          </div>
          <div className="relative px-8">
            <button
              onClick={() => moveSlide(-1)}
              className="absolute left-0 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-[22px] text-[#bbb] hover:text-navy transition-colors p-2 z-10"
              aria-label="ก่อนหน้า"
            >
              ‹
            </button>

            {loading ? (
              <div className="grid grid-cols-3 gap-5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="bg-white rounded-lg aspect-video animate-pulse" />
                ))}
              </div>
            ) : sliderPool.length === 0 ? (
              <div className="text-center text-[#aaa] py-10 text-[13px]">ยังไม่มีฟอนต์ในระบบ</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                {sliderVisible.map((f) => (
                  <FontCard key={f.id} font={f} />
                ))}
              </div>
            )}

            <button
              onClick={() => moveSlide(1)}
              className="absolute right-0 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-[22px] text-[#bbb] hover:text-navy transition-colors p-2 z-10"
              aria-label="ถัดไป"
            >
              ›
            </button>
          </div>

          {n > 1 && (
            <div className="flex gap-1.5 justify-center mt-3.5">
              {Array.from({ length: n }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setSlide(i)}
                  className={`w-[7px] h-[7px] rounded-full border-none cursor-pointer transition-colors ${
                    i === slide ? "bg-navy" : "bg-[#ddd]"
                  }`}
                  aria-label={`ตำแหน่ง ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="h-6 bg-white" />

      {/* FONT GRID */}
      <div id="fonts" className="bg-white">
        <div className="max-w-site mx-auto px-8 py-6">
          <div className="flex justify-between items-center mb-3.5">
            <span className="text-[32px] font-semibold text-navy">ฟอนต์ล่าสุด</span>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="bg-[#f5f5f2] rounded-lg aspect-[4/3] animate-pulse" />
              ))}
            </div>
          ) : fonts.length === 0 ? (
            <div className="text-center text-[#aaa] py-10 text-[13px]">ยังไม่มีฟอนต์ในระบบ</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {gridFonts.map((f) => (
                <FontCard key={f.id} font={f} />
              ))}
              {remaining > 0 && (
                <div className="flex flex-col items-center justify-center gap-1 bg-[#f0f0ec] border border-dashed border-[#ccc] rounded-lg cursor-pointer hover:border-[#999] transition-colors p-6">
                  <span className="text-[26px] font-semibold text-navy">+{remaining}</span>
                  <span className="text-[11px] text-[#aaa]">ฟอนต์อื่น ๆ</span>
                  <span className="text-[11px] text-mint mt-0.5">ดูทั้งหมด →</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* PRICING */}
      <section id="pricing" className="bg-bg">
        <div className="max-w-site mx-auto px-8 py-7">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[32px] font-semibold text-navy">ราคาและแผนบริการ</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div className="p-5 border border-[0.25px] border-[#ddd] rounded-[10px] bg-white flex flex-col">
              <span className="self-start text-[10px] bg-mint-light text-[#0a8a84] px-2.5 py-0.5 rounded-full border border-[0.5px] border-mint-mid mb-2.5">
                ซื้อครั้งเดียว
              </span>
              <div className="text-[26px] font-semibold text-navy leading-[1.2]">ซื้อรายฟอนต์</div>
              <div className="text-[26px] font-semibold text-navy leading-[1.2]">ราคาแตกต่างกัน</div>
              <div className="text-[12px] text-[#aaa] mt-2.5 mb-2.5">/ ชุดฟอนต์</div>
              <div className="text-[12px] text-[#666] leading-[1.65] flex-1">
                ดาวน์โหลดไฟล์ฟอนต์ได้ทันทีหลังชำระเงิน
              </div>
              <Link
                href="/#fonts"
                className="mt-4 block w-full py-2.5 text-center rounded-[6px] text-[14px] font-medium text-navy border border-[0.25px] border-[#ddd] no-underline hover:bg-navy hover:text-white hover:border-navy transition-all"
              >
                ดูฟอนต์ทั้งหมด
              </Link>
            </div>
            <div className="p-5 border border-[0.25px] border-[#ddd] rounded-[10px] bg-white flex flex-col">
              <span className="self-start text-[10px] bg-mint-light text-[#0a8a84] px-2.5 py-0.5 rounded-full border border-[0.5px] border-mint-mid mb-2.5">
                แนะนำ · ประหยัดกว่า
              </span>
              <div className="text-[26px] font-semibold text-navy leading-[1.2]">Subscription รายเดือน</div>
              <div className="text-[26px] font-semibold text-navy leading-[1.2]">฿XXX</div>
              <div className="text-[12px] text-[#aaa] mt-2.5 mb-2.5">/ เดือน · ยกเลิกได้ทุกเมื่อ</div>
              <div className="text-[12px] text-[#666] leading-[1.65] flex-1">
                เข้าถึงฟอนต์ทุกชุดในคลัง ใช้งานง่ายผ่าน Desktop App
              </div>
              <Link
                href="/coming-soon/"
                className="mt-4 block w-full py-2.5 text-center rounded-[6px] text-[14px] font-medium text-navy border border-[0.25px] border-[#ddd] no-underline hover:bg-navy hover:text-white hover:border-navy transition-all"
              >
                สมัครฟรี · เริ่มใช้ได้เลยทันที
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ADSENSE placeholder */}
      <div className="bg-[#ebe9e4] border-y border-[#e0ddd6]">
        <div className="max-w-site mx-auto px-8 py-2.5 flex items-center justify-center gap-2.5">
          <span className="text-[9px] text-[#bbb] tracking-[0.07em] uppercase shrink-0">ADS</span>
          <div className="bg-[#dddbd4] rounded h-[60px] flex items-center justify-center text-[11px] text-[#bbb] flex-1 max-w-[728px]">
            AdSense 728×90 Leaderboard
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}
