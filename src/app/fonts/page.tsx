"use client";

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import FontCard, { Font } from "@/components/FontCard";
import AdBanner from "@/components/AdBanner";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";

const PAGE_SIZE = 16;

export default function AllFontsPage() {
  const [fonts, setFonts] = useState<Font[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "fonts"), where("is_active", "==", true));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const sorted = (snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Font[])
          .sort((a, b) => (b.created_at?.toMillis() ?? 0) - (a.created_at?.toMillis() ?? 0));
        setFonts(sorted);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  const totalPages = Math.ceil(fonts.length / PAGE_SIZE);
  const pageFonts = fonts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="bg-[#f5f5f2] rounded-lg aspect-[4/3] animate-pulse" />
              ))}
            </div>
          ) : fonts.length === 0 ? (
            <div className="text-center text-[#aaa] py-20 text-[13px]">ยังไม่มีฟอนต์ในระบบ</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {pageFonts.map((f) => (
                <FontCard key={f.id} font={f} />
              ))}
            </div>
          )}

          <AdBanner slot="1401819374" className="mt-6 -mx-8" />

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
