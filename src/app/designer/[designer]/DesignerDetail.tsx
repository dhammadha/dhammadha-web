"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { Font } from "@/components/FontCard";
import FontGrid from "@/components/FontGrid";
import CoverCarousel from "@/components/CoverCarousel";
import Container from "@/components/ui/Container";
import { supabase } from "@/lib/supabase";
import { effectiveSale } from "@/lib/sale";
import { mergeShopPromos } from "@/lib/shop-promo";
import LicenseLink from "@/components/LicenseLink";
import { designerLicensePdf } from "@/lib/license";

// pool สไลด์ = 4 ฟอนต์ (เจ้าของกำหนด 2026-07-18 · เดิม 3)
// logic สไลด์ทั้งหมดอยู่ใน CoverCarousel — หน้านี้แค่คัด pool ส่งเข้าไป (เหมือนหน้าแรก)
const SLIDER_SIZE = 4;

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

// ฟอนต์ลดราคาขึ้นก่อน (สุ่มในกลุ่ม) แล้วเติมด้วยฟอนต์อื่นของ designer (สุ่ม) ตัดเหลือ SLIDER_SIZE
function buildSliderPool(fonts: Font[]): Font[] {
  const sale = shuffle(fonts.filter((f) => effectiveSale(f).active));
  const others = shuffle(fonts.filter((f) => !effectiveSale(f).active));
  return [...sale, ...others].slice(0, SLIDER_SIZE);
}

export default function DesignerDetail() {
  const params = useParams();
  const designerSlug = typeof params?.designer === "string" ? params.designer : "";

  const [designerName, setDesignerName] = useState("");
  const [fonts, setFonts] = useState<Font[]>([]);
  const [sliderPool, setSliderPool] = useState<Font[]>([]);
  const [loading, setLoading] = useState(true);
  /** สัญญาฉบับของดีไซน์เนอร์คนนี้ — null = ใช้ฉบับกลาง (เกณฑ์อยู่ที่ designerLicensePdf) */
  const [licensePdf, setLicensePdf] = useState<string | null>(null);

  useEffect(() => {
    if (!designerSlug) return;
    (async () => {
      setLoading(true);
      // designer_profiles (view สาธารณะ) แทนการ select ตรงจาก users — ตั้งแต่ 0054
      // authenticated ที่ login แล้วอ่านแถว designer อื่นจาก users ตรง ๆ ไม่ได้อีกต่อไป
      const { data: userData } = await supabase
        .from("designer_profiles")
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
      setLicensePdf(designerLicensePdf(licenseData));

      const { data: fontData } = await supabase
        .from("fonts")
        .select("*")
        .eq("owner_id", userData.id)
        .eq("is_active", true)
        .not("published_at", "is", null)
        .order("created_at", { ascending: false });

      const flat = ((fontData ?? []) as Font[]).map((f) => ({
        ...f,
        designer_slug: designerSlug,
        designer_business_name: userData.business_name || userData.name || "",
      }));
      const allFonts = await mergeShopPromos(flat);

      setFonts(allFonts);
      setSliderPool(buildSliderPool(allFonts));
      setLoading(false);
    })();
  }, [designerSlug]);

  if (loading) {
    return (
      <>
        <Nav />
        <div className="min-h-screen flex items-center justify-center">
          <span className="font-body text-body text-grey-600">กำลังโหลด...</span>
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
          <div className="font-ui text-h2 text-black">ไม่พบ designer นี้</div>
          <Link href="/fonts/" className="font-body text-body link-accent no-underline hover:underline">← ดูฟอนต์ทั้งหมด</Link>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Nav />
      <div className="bg-page min-h-screen">
        <Container className="pt-10 pb-5">
          <p className="font-body text-body-sm text-grey-600 mb-1">
            <Link href="/fonts/" className="text-grey-600 no-underline hover:link-accent transition-colors">ฟอนต์ทั้งหมด</Link>
            {" / "}นักออกแบบ
          </p>
          <h1 className="font-heading text-h1 text-black">{designerName}</h1>
          <div className="flex items-center gap-4 mt-1">
            <p className="font-body text-body-sm text-grey-600">{fonts.length} ฟอนต์</p>
            <LicenseLink
              pdfUrl={licensePdf}
              className="font-body text-body-sm link-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            >
              สัญญาอนุญาต →
            </LicenseLink>
          </div>
        </Container>

        {/* สไลด์ full-bleed ตัวเดียวกับหน้าแรก — วางนอก Container ให้ทะลุขอบจอ */}
        <CoverCarousel fonts={sliderPool} loading={loading} />

        <Container className="pt-5 pb-8">
          <h2 className="font-heading text-h1 text-black mb-3.5">ฟอนต์ทั้งหมด</h2>
          <FontGrid fonts={fonts} />
        </Container>
      </div>
      <Footer />
    </>
  );
}
