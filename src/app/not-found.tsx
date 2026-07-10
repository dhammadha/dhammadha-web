"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { supabase } from "@/lib/supabase";

export default function NotFound() {
  const pathname = usePathname();
  const router = useRouter();
  // ลิงก์จากเว็บเก่าเป็นรูปแบบ /:slug — ก่อนโชว์ 404 เช็คว่า slug ตรงกับ
  // ฟอนต์ที่เผยแพร่อยู่ไหม ถ้าตรงพาไปหน้าใหม่ /fonts/:designer/:slug
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const segments = (pathname ?? "").split("/").filter(Boolean);
    if (segments.length !== 1) { setChecking(false); return; }
    supabase
      .from("fonts")
      .select("slug, users!owner_id(designer_slug)")
      .eq("slug", segments[0].toLowerCase())
      .eq("is_active", true)
      .not("published_at", "is", null)
      .limit(1)
      .then(({ data }) => {
        const row = data?.[0] as { slug: string; users?: { designer_slug?: string } | null } | undefined;
        if (row?.users?.designer_slug) {
          router.replace(`/fonts/${row.users.designer_slug}/${row.slug}/`);
        } else {
          setChecking(false);
        }
      });
  }, [pathname, router]);

  return (
    <>
      <Nav />
      <div className="min-h-[calc(100vh-112px)] flex items-center justify-center bg-bg px-8 py-16">
        {checking ? (
          <div className="text-[14px] text-[#aaa]">กำลังค้นหา…</div>
        ) : (
          <div className="text-center">
            <div className="text-[80px] font-semibold text-navy leading-none mb-4">404</div>
            <div className="text-[18px] text-[#666] mb-8">ไม่พบหน้าที่คุณต้องการ</div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-[13px] text-[#888] no-underline hover:text-navy transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              กลับหน้าแรก
            </Link>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
}
