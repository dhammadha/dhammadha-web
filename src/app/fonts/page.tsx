"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { Font } from "@/components/FontCard";
import FontGrid from "@/components/FontGrid";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";
import { isSaleActive } from "@/lib/sale";

// 9 แถว × 4 คอลัมน์ (เดสก์ท็อป) ต่อหน้า — FontGrid แทรก ad คั่นทุก 3 แถวให้เอง (เจ้าของ 2026-07-20)
const PAGE_SIZE = 36;
const CATEGORIES = ["serif", "sans-serif", "display", "handwriting", "monospace"];

/**
 * Nav/Footer อยู่นอก Suspense โดยตั้งใจ — `useSearchParams` บังคับให้ต้องมี
 * Suspense boundary และ `output: "export"` จะ prerender **fallback** ลง static HTML
 * ถ้าเอาทั้งหน้าไปไว้ข้างใน HTML ที่ได้จะว่างเปล่าทั้งหน้า
 * (เนื้อหาฟอนต์ fetch ฝั่ง client อยู่แล้ว ไม่ได้อยู่ใน static HTML ตั้งแต่แรก)
 */
export default function AllFontsPage() {
  return (
    <>
      <Nav />
      <Suspense fallback={<div className="bg-white min-h-screen" />}>
        <AllFontsContent />
      </Suspense>
      <Footer />
    </>
  );
}

type PriceFilter = "all" | "free" | "sale";

// label "all" เดิมคือ "ราคา" (ชื่อหัว dropdown) — ตอนนี้เป็นปุ่มในแถวจึงต้องอ่านออกเดี่ยว ๆ
const PRICE_OPTIONS: { value: PriceFilter; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "free", label: "ฟรี" },
  { value: "sale", label: "ลดราคา" },
];

// ไอคอนแว่นขยาย 18×18 — ทรงเดียวกับ search ใน Nav.tsx เพื่อไม่ให้สองที่หลุดจากกันทางสายตา
const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.4" />
    <path d="M12 12l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

function AllFontsContent() {
  const searchParams = useSearchParams();
  const [fonts, setFonts] = useState<Font[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Filters
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("all");

  // รับหมวดหมู่จาก URL — ให้ submenu ใน Nav ลิงก์เข้ามาได้ (/fonts/?category=serif)
  // ค่าที่ไม่รู้จักตกเป็น "all" กัน ?category=อะไรก็ไม่รู้ ทำให้กริดว่างเปล่า
  const urlCategory = searchParams.get("category");
  const categoryFromUrl = urlCategory && CATEGORIES.includes(urlCategory) ? urlCategory : "all";

  // รับคำค้นจาก URL — ป้ายแท็กในหน้า font detail ลิงก์เข้ามา (/fonts/?q=retro)
  // แท็กไม่มีรายการตายตัวให้ตรวจเหมือน category จึงรับค่าอะไรก็ได้
  // (ตัวกรองเป็น substring match ค่าที่ไม่มีจริงก็แค่ได้ผลลัพธ์ว่าง ไม่พัง)
  const searchFromUrl = searchParams.get("q") ?? "";

  // pattern ที่ React แนะนำสำหรับ "ปรับ state เมื่อ input เปลี่ยน" — set ตอน render
  // ไม่ใช่ใน useEffect (ถ้าใช้ effect จะเพิ่ม react-hooks/set-state-in-effect
  // ซึ่งโปรเจกต์นี้มีอยู่ 73 จุดแล้ว ไม่ควรเพิ่มอีก)
  // จำเป็นต้องเป็น state ไม่ใช่ค่า derived ล้วน เพราะ dropdown ในหน้านี้ต้องเปลี่ยนมันได้เอง
  // โดยไม่ต้องแตะ URL — แต่พอ URL เปลี่ยน (กด submenu) ให้ URL ชนะ
  const [category, setCategory] = useState<string>(categoryFromUrl);
  const [prevUrlCategory, setPrevUrlCategory] = useState(categoryFromUrl);
  if (prevUrlCategory !== categoryFromUrl) {
    setPrevUrlCategory(categoryFromUrl);
    setCategory(categoryFromUrl);
  }

  // ช่องค้นหาใช้ pattern เดียวกับ category — พิมพ์เองได้ แต่พอ URL เปลี่ยนให้ URL ชนะ
  const [search, setSearch] = useState(searchFromUrl);
  const [prevUrlSearch, setPrevUrlSearch] = useState(searchFromUrl);
  if (prevUrlSearch !== searchFromUrl) {
    setPrevUrlSearch(searchFromUrl);
    setSearch(searchFromUrl);
  }

  useEffect(() => {
    setLoading(true);
    supabase
      .from("fonts")
      // embed ผ่าน view designer_profiles ไม่ใช่ users (ดู 0054 — anon อ่าน users ไม่ได้แล้ว)
      .select("*, designer_profiles!owner_id(designer_slug, business_name)")
      .eq("is_active", true)
      .not("published_at", "is", null)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error) {
          type RawFont = { designer_profiles?: { designer_slug?: string; business_name?: string } | null } & Record<string, unknown>;
          const flat = ((data ?? []) as unknown as RawFont[]).map((r) => ({ ...r, designer_slug: r.designer_profiles?.designer_slug ?? undefined, designer_business_name: r.designer_profiles?.business_name ?? undefined, designer_profiles: undefined }));
          setFonts(flat as unknown as Font[]);
        }
        setLoading(false);
      });
  }, []);

  // Union of hardcoded categories + any distinct legacy category values found in data
  const categoryOptions = useMemo(() => {
    const found = new Set<string>(CATEGORIES);
    fonts.forEach((f) => {
      if (f.category) found.add(f.category);
    });
    return Array.from(found);
  }, [fonts]);

  const filteredFonts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return fonts.filter((f) => {
      if (q) {
        const nameMatch = (f.name || "").toLowerCase().includes(q);
        const nameThMatch = (f.name_th || "").toLowerCase().includes(q);
        const tagMatch = (f.tags || []).some((t) => t.toLowerCase().includes(q));
        // ค้นหาด้วยชื่อ designer ได้ด้วย (แทน dropdown designer ที่เอาออกไปแล้ว)
        const designerMatch = (f.designer_business_name || "").toLowerCase().includes(q);
        if (!nameMatch && !nameThMatch && !tagMatch && !designerMatch) return false;
      }
      if (category !== "all" && f.category !== category) return false;
      if (priceFilter === "free" && !f.is_free) return false;
      if (priceFilter === "sale" && !isSaleActive(f)) return false;
      return true;
    });
  }, [fonts, search, category, priceFilter]);

  // Reset to page 1 whenever a filter changes
  useEffect(() => {
    setPage(1);
  }, [search, category, priceFilter]);

  const hasActiveFilters = !!search || category !== "all" || priceFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setCategory("all");
    setPriceFilter("all");
  };

  const totalPages = Math.ceil(filteredFonts.length / PAGE_SIZE);
  const pageFonts = filteredFonts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <div className="bg-white min-h-screen">
        <Container className="pt-10 pb-8">
          <div className="flex items-baseline justify-between mb-4">
            <h1 className="font-heading text-h1 text-black">ฟอนต์ทั้งหมด</h1>
            {!loading && (
              <span className="font-body text-body-sm text-grey-600">{fonts.length} ฟอนต์</span>
            )}
          </div>

          {/* Filter bar — ปุ่มเรียงเป็นแถว (เจ้าของสั่ง 2026-07-18 แทน dropdown เดิม)
              active/inactive แยกด้วย "พื้นสี" ไม่ใช่เส้นขอบ: primary = mint · outline = surface (§4.0)
              flex-wrap ไม่ scroll — กันไม่ให้เกิด horizontal scroll ที่ 375px */}
          {!loading && fonts.length > 0 && (
            <div className="flex flex-col gap-3 mb-5">
              {/* Search */}
              <div className="relative w-full sm:w-72">
                <Input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ค้นหาฟอนต์…"
                  aria-label="ค้นหาฟอนต์"
                  icon={<SearchIcon />}
                  // เว้นที่ให้ปุ่ม × ตอนมีคำค้น — ทับ pr-3 ที่ Input ใส่มากับ icon
                  // ปลอดภัยแม้ cn() จะไม่ merge tailwind (§13.6) เพราะเป็น utility ตระกูลเดียวกัน
                  // Tailwind ปล่อย padding ไล่จากค่าน้อยไปมาก → pr-9 อยู่หลัง pr-3 ในสไตล์ชีตเสมอ
                  // (ยืนยันด้วย getComputedStyle: 36px)
                  className={search ? "pr-9" : undefined}
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-grey-600 hover:text-black bg-transparent border-none cursor-pointer text-base leading-none p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                    aria-label="ล้างคำค้นหา"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* หมวดหมู่ */}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={category === "all" ? "primary" : "outline"}
                  onClick={() => setCategory("all")}
                >
                  ทุกหมวดหมู่
                </Button>
                {categoryOptions.map((c) => (
                  <Button
                    key={c}
                    size="sm"
                    variant={category === c ? "primary" : "outline"}
                    onClick={() => setCategory(c)}
                    className="capitalize"
                  >
                    {c}
                  </Button>
                ))}
              </div>

              {/* ราคา */}
              <div className="flex flex-wrap items-center gap-2">
                {PRICE_OPTIONS.map((p) => (
                  <Button
                    key={p.value}
                    size="sm"
                    variant={priceFilter === p.value ? "primary" : "outline"}
                    onClick={() => setPriceFilter(p.value)}
                  >
                    {p.label}
                  </Button>
                ))}

                {hasActiveFilters && (
                  <Button size="sm" variant="ghost" onClick={clearFilters}>
                    ล้างตัวกรอง
                  </Button>
                )}

                <span className="font-body text-body-sm text-grey-600 sm:ml-auto">
                  พบ {filteredFonts.length} ฟอนต์
                </span>
              </div>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="bg-surface aspect-[4/3] animate-pulse" />
              ))}
            </div>
          ) : fonts.length === 0 ? (
            <div className="text-center font-body text-body-sm text-grey-600 py-20">ยังไม่มีฟอนต์ในระบบ</div>
          ) : filteredFonts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <span className="font-body text-body-sm text-grey-600">ไม่พบฟอนต์ที่ตรงกับตัวกรอง</span>
              <Button variant="outline" onClick={clearFilters}>
                ล้างตัวกรอง
              </Button>
            </div>
          ) : (
            <FontGrid fonts={pageFonts} />
          )}

          {/* Pagination — เหลี่ยม ไม่มีเส้นขอบ แยกสถานะด้วยพื้นสี (§4.0/§4.1) */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => { setPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                disabled={page === 1}
                className="w-9 h-9 flex items-center justify-center bg-surface text-grey-600 hover:bg-black hover:text-white disabled:bg-grey-200 disabled:text-grey-400 disabled:cursor-not-allowed disabled:hover:bg-grey-200 disabled:hover:text-grey-400 transition-colors duration-150 ease-base cursor-pointer border-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                aria-label="หน้าก่อนหน้า"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  aria-current={p === page ? "page" : undefined}
                  className={`w-9 h-9 font-ui text-ui transition-colors duration-150 ease-base cursor-pointer border-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${
                    p === page
                      ? "bg-black text-white"
                      : "bg-surface text-grey-600 hover:bg-black hover:text-white"
                  }`}
                >
                  {p}
                </button>
              ))}

              <button
                onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                disabled={page === totalPages}
                className="w-9 h-9 flex items-center justify-center bg-surface text-grey-600 hover:bg-black hover:text-white disabled:bg-grey-200 disabled:text-grey-400 disabled:cursor-not-allowed disabled:hover:bg-grey-200 disabled:hover:text-grey-400 transition-colors duration-150 ease-base cursor-pointer border-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                aria-label="หน้าถัดไป"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          )}

          {/* Current page indicator */}
          {totalPages > 1 && (
            <div className="text-center mt-3 font-body text-body-sm text-grey-600">
              หน้า {page} จาก {totalPages}
            </div>
          )}
        </Container>
      </div>
    </>
  );
}
