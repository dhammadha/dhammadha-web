"use client";

import { useEffect, useMemo, useState } from "react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import FontCard, { Font } from "@/components/FontCard";
import AdBanner from "@/components/AdBanner";
import { supabase } from "@/lib/supabase";

const PAGE_SIZE = 16;
const CATEGORIES = ["serif", "sans-serif", "display", "handwriting", "monospace"];

type PriceFilter = "all" | "free" | "sale" | "paid";

const PRICE_OPTIONS: { value: PriceFilter; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "free", label: "ฟรี" },
  { value: "sale", label: "ลดราคา" },
  { value: "paid", label: "ขาย" },
];

export default function AllFontsPage() {
  const [fonts, setFonts] = useState<Font[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Filters
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("all");
  const [designerSlug, setDesignerSlug] = useState<string>("all");

  useEffect(() => {
    setLoading(true);
    supabase
      .from("fonts")
      .select("*, users!owner_id(designer_slug, business_name)")
      .eq("is_active", true)
      .not("published_at", "is", null)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error) {
          type RawFont = { users?: { designer_slug?: string; business_name?: string } | null } & Record<string, unknown>;
          const flat = ((data ?? []) as unknown as RawFont[]).map((r) => ({ ...r, designer_slug: r.users?.designer_slug ?? undefined, designer_business_name: r.users?.business_name ?? undefined, users: undefined }));
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

  // Distinct designers from fetched fonts
  const designerOptions = useMemo(() => {
    const map = new Map<string, string>();
    fonts.forEach((f) => {
      if (f.designer_slug) {
        map.set(f.designer_slug, f.designer_business_name || f.designer_slug);
      }
    });
    return Array.from(map.entries()).map(([slug, label]) => ({ slug, label }));
  }, [fonts]);

  const filteredFonts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return fonts.filter((f) => {
      if (q) {
        const nameMatch = (f.name || "").toLowerCase().includes(q);
        const nameThMatch = (f.name_th || "").toLowerCase().includes(q);
        const tagMatch = (f.tags || []).some((t) => t.toLowerCase().includes(q));
        if (!nameMatch && !nameThMatch && !tagMatch) return false;
      }
      if (category !== "all" && f.category !== category) return false;
      if (priceFilter === "free" && !f.is_free) return false;
      if (priceFilter === "sale" && !f.is_sale) return false;
      if (priceFilter === "paid" && f.is_free) return false;
      if (designerSlug !== "all" && f.designer_slug !== designerSlug) return false;
      return true;
    });
  }, [fonts, search, category, priceFilter, designerSlug]);

  // Reset to page 1 whenever a filter changes
  useEffect(() => {
    setPage(1);
  }, [search, category, priceFilter, designerSlug]);

  const hasActiveFilters = !!search || category !== "all" || priceFilter !== "all" || designerSlug !== "all";

  const clearFilters = () => {
    setSearch("");
    setCategory("all");
    setPriceFilter("all");
    setDesignerSlug("all");
  };

  const totalPages = Math.ceil(filteredFonts.length / PAGE_SIZE);
  const pageFonts = filteredFonts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <Nav />
      <div className="bg-white min-h-screen">
        <div className="max-w-site mx-auto px-8 py-8">
          <div className="flex items-baseline justify-between mb-5">
            <h1 className="text-[32px] font-semibold text-navy">ฟอนต์ทั้งหมด</h1>
            {!loading && (
              <span className="text-[13px] text-[#aaa]">{fonts.length} ฟอนต์</span>
            )}
          </div>

          {/* Filter bar */}
          {!loading && fonts.length > 0 && (
            <div className="bg-white rounded-xl border border-border p-4 mb-5 flex flex-col gap-3.5">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                {/* Search */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-transparent bg-[#f8f8f6] focus-within:border-mint transition-colors md:w-[240px]">
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="text-[#aaa] flex-shrink-0">
                    <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M10.5 10.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="ค้นหาฟอนต์…"
                    className="bg-transparent border-none outline-none text-[13px] text-[#333] placeholder-[#bbb] w-full font-[inherit]"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="text-[#bbb] hover:text-[#888] bg-transparent border-none cursor-pointer text-base leading-none p-0"
                      aria-label="ล้างคำค้นหา"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Designer select */}
                <select
                  value={designerSlug}
                  onChange={(e) => setDesignerSlug(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-border bg-white text-[13px] text-[#444] outline-none cursor-pointer md:w-[180px]"
                >
                  <option value="all">ทุก designer</option>
                  {designerOptions.map((d) => (
                    <option key={d.slug} value={d.slug}>
                      {d.label}
                    </option>
                  ))}
                </select>

                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="md:ml-auto inline-flex items-center justify-center gap-1.5 text-[13px] font-medium text-navy bg-transparent border border-transparent rounded-[9px] px-3 py-2 hover:bg-[#f5f5f2] transition-colors cursor-pointer"
                  >
                    ล้างตัวกรอง
                  </button>
                )}
              </div>

              {/* Category chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[12px] text-[#aaa] mr-1">หมวดหมู่:</span>
                <button
                  onClick={() => setCategory("all")}
                  className={`text-[13px] px-3 py-1.5 rounded-full border transition-colors capitalize ${
                    category === "all"
                      ? "bg-navy text-white border-navy"
                      : "border-[0.5px] border-[#ddd] text-[#666] hover:border-navy hover:text-navy bg-white"
                  }`}
                >
                  ทั้งหมด
                </button>
                {categoryOptions.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`text-[13px] px-3 py-1.5 rounded-full border transition-colors capitalize ${
                      category === c
                        ? "bg-navy text-white border-navy"
                        : "border-[0.5px] border-[#ddd] text-[#666] hover:border-navy hover:text-navy bg-white"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              {/* Price chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[12px] text-[#aaa] mr-1">ราคา:</span>
                {PRICE_OPTIONS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPriceFilter(p.value)}
                    className={`text-[13px] px-3 py-1.5 rounded-full border transition-colors ${
                      priceFilter === p.value
                        ? "bg-navy text-white border-navy"
                        : "border-[0.5px] border-[#ddd] text-[#666] hover:border-navy hover:text-navy bg-white"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="text-[12px] text-[#888]">พบ {filteredFonts.length} ฟอนต์</div>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="bg-[#f5f5f2] rounded-lg aspect-[4/3] animate-pulse" />
              ))}
            </div>
          ) : fonts.length === 0 ? (
            <div className="text-center text-[#aaa] py-20 text-[13px]">ยังไม่มีฟอนต์ในระบบ</div>
          ) : filteredFonts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-[13px] text-[#aaa]">
              <span>ไม่พบฟอนต์ที่ตรงกับตัวกรอง</span>
              <button
                onClick={clearFilters}
                className="inline-flex items-center justify-center gap-2 font-semibold rounded-[9px] border transition-colors cursor-pointer no-underline px-4 py-2 text-[13px] bg-transparent text-navy border-navy hover:bg-navy hover:text-white"
              >
                ล้างตัวกรอง
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {pageFonts.slice(0, 8).map((f) => (
                  <FontCard key={f.id} font={f} />
                ))}
              </div>
              {pageFonts.length > 8 && (
                <>
                  <AdBanner slot="1401819374" className="my-4 -mx-8" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {pageFonts.slice(8).map((f) => (
                      <FontCard key={f.id} font={f} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => { setPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                disabled={page === 1}
                className="w-9 h-9 rounded-full border border-[0.5px] border-[#ddd] flex items-center justify-center text-[#888] hover:border-navy hover:text-navy disabled:opacity-30 disabled:cursor-not-allowed transition-colors bg-white"
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
                  className={`w-9 h-9 rounded-full border text-[13px] font-medium transition-colors ${
                    p === page
                      ? "bg-navy text-white border-navy"
                      : "border-[0.5px] border-[#ddd] text-[#888] hover:border-navy hover:text-navy bg-white"
                  }`}
                >
                  {p}
                </button>
              ))}

              <button
                onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                disabled={page === totalPages}
                className="w-9 h-9 rounded-full border border-[0.5px] border-[#ddd] flex items-center justify-center text-[#888] hover:border-navy hover:text-navy disabled:opacity-30 disabled:cursor-not-allowed transition-colors bg-white"
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
            <div className="text-center mt-3 text-[12px] text-[#bbb]">
              หน้า {page} จาก {totalPages}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}
