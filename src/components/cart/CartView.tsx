"use client";

/**
 * ตะกร้าจริง — รายการฟอนต์ที่เลือกไว้ + ปุ่มชำระเงินครั้งเดียวจบ
 *
 * ราคาที่โชว์ที่นี่คำนวณด้วย `effectiveSale()` ตัวเดียวกับหน้าฟอนต์และ checkout
 * ฝั่ง server — และ **ราคาที่เก็บเงินจริงคิดใหม่ฝั่ง server เสมอ** ที่นี่ส่งไปแค่
 * รายการ font_id (ดู handleCheckoutRequest)
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useCart, type CartFont } from "@/context/CartContext";
import { effectiveSale } from "@/lib/sale";
import { cartPriceOf, fmtBaht } from "@/lib/revenue";
import { designerLicensePdfMap, LICENSE_LABEL } from "@/lib/license";
import Button from "@/components/ui/Button";
import LicenseLink from "@/components/LicenseLink";

export default function CartView() {
  const { items, fonts, loadingFonts, remove, ready } = useCart();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  /** designer_id → URL สัญญาฉบับของเขา (เฉพาะคนที่ไม่ได้ใช้ฉบับกลาง) */
  const [licensePdfs, setLicensePdfs] = useState<Record<string, string>>({});

  const total = fonts.reduce((sum, f) => sum + cartPriceOf(f), 0);

  // ฟอนต์ที่หายไป (ถูกถอดออกจากเว็บ/ปิดขาย) — ยังค้างใน localStorage ต้องบอกผู้ใช้
  const missing = ready && !loadingFonts ? items.length - fonts.length : 0;

  const { user } = useAuth();

  // สัญญาอนุญาตของแต่ละร้านในตะกร้า — ยิงรวมทีเดียวด้วย .in() ไม่ยิงต่อฟอนต์
  // (แพตเทิร์นเดียวกับ MyDownloads) · ใบเดียวมีได้หลายร้าน จึงชี้ฉบับกลางอย่างเดียวไม่ได้
  // ลูกค้าต้องเห็นฉบับที่ผูกพันกับฟอนต์ที่ตัวเองกำลังจะซื้อจริง
  useEffect(() => {
    const ownerIds = [...new Set(fonts.map((f) => f.owner_id).filter((v): v is string => !!v))];
    if (ownerIds.length === 0) {
      setLicensePdfs({});
      return;
    }
    let active = true;
    supabase
      .from("designer_license_config")
      .select("designer_id, use_default, license_pdf_url")
      .in("designer_id", ownerIds)
      .then(({ data }) => {
        // อ่านไม่ได้ = ถือว่าทุกร้านใช้ฉบับกลาง (ลิงก์ฉบับกลางยังอยู่เสมอ)
        if (active) setLicensePdfs(designerLicensePdfMap(data));
      });
    return () => {
      active = false;
    };
  }, [fonts]);

  const checkout = useCallback(async () => {
    if (!fonts.length || paying) return;
    setPaying(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ font_ids: fonts.map((f) => f.id), cancel_path: "/cart/" }),
      });
      const data = (await res.json()) as { ok?: boolean; url?: string };
      if (data.ok && data.url) {
        window.location.href = data.url;
        return; // คง loading ไว้ระหว่าง browser พาไป Stripe
      }
      setError("เริ่มการชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } catch {
      setError("เริ่มการชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    }
    setPaying(false);
  }, [fonts, paying]);

  if (!ready || loadingFonts) {
    return <p className="font-body text-body text-grey-600">กำลังโหลด…</p>;
  }

  if (!fonts.length) {
    return (
      <div className="text-center py-10">
        <p className="font-body text-body text-grey-600">ยังไม่มีฟอนต์ในตะกร้า</p>
        <div className="mt-6">
          <Button as="link" href="/fonts/" size="lg">
            ดูฟอนต์ทั้งหมด
          </Button>
        </div>
      </div>
    );
  }

  // แยกฟอนต์ในตะกร้าเป็นสองพวก: ร้านที่ใช้สัญญาฉบับของตัวเอง (โชว์ทีละร้าน ไม่ซ้ำ
  // เรียงตามลำดับในตะกร้า) กับที่เหลือซึ่งอยู่ใต้ฉบับกลางของเว็บ
  const customLicenseShops: { id: string; name: string; url: string }[] = [];
  const seenShops = new Set<string>();
  let hasDefaultLicenseFont = false;
  for (const f of fonts) {
    const url = f.owner_id ? licensePdfs[f.owner_id] : undefined;
    if (!f.owner_id || !url) {
      hasDefaultLicenseFont = true;
      continue;
    }
    if (seenShops.has(f.owner_id)) continue;
    seenShops.add(f.owner_id);
    customLicenseShops.push({
      id: f.owner_id,
      name: f.designer_profiles?.business_name || "ผู้ออกแบบ",
      url,
    });
  }

  return (
    <div className="max-w-[720px] mx-auto">
      <div className="flex flex-col gap-2">
        {fonts.map((f) => {
          const eff = effectiveSale(f);
          const designerSlug = f.designer_profiles?.designer_slug;
          const name = f.name || f.name_th || f.slug;
          return (
            <div key={f.id} className="bg-surface flex items-center gap-3 px-4 py-3">
              {f.cover_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.cover_image_url} alt="" className="w-16 h-10 object-cover flex-shrink-0" />
              ) : (
                <div className="w-16 h-10 bg-grey-200 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                {designerSlug ? (
                  <Link href={`/fonts/${designerSlug}/${f.slug}/`} className="font-body text-body text-black no-underline hover:link-accent truncate block">
                    {name}
                  </Link>
                ) : (
                  <span className="font-body text-body text-black truncate block">{name}</span>
                )}
                <span className="font-body text-footnote text-grey-600">
                  {f.designer_profiles?.business_name || "—"} · {LICENSE_LABEL.personal}
                </span>
              </div>
              <div className="text-right flex-shrink-0">
                {eff.active ? (
                  <>
                    <span className="font-body text-footnote text-grey-600 line-through mr-2">{fmtBaht(f.price ?? 0)}</span>
                    <span className="font-body text-body text-black">{fmtBaht(eff.salePrice)}</span>
                  </>
                ) : (
                  <span className="font-body text-body text-black">{fmtBaht(f.price ?? 0)}</span>
                )}
              </div>
              <button
                onClick={() => remove(f.id)}
                aria-label={`เอา ${name} ออกจากตะกร้า`}
                className="text-grey-600 hover:text-danger-dark bg-transparent border-none cursor-pointer text-[16px] leading-none flex-shrink-0 transition-colors duration-150 ease-base"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {missing > 0 && (
        <p className="font-body text-body-sm text-grey-600 mt-3">
          มี {missing} ฟอนต์ในตะกร้าที่ไม่เปิดขายแล้ว จึงไม่ถูกนำมาคิดเงิน
        </p>
      )}

      <div className="flex items-center justify-between mt-6 pt-4 border-t border-grey-200">
        <span className="font-body text-body text-black">รวม {fonts.length} ฟอนต์</span>
        {/* เดิมเป็น text-h3 ซึ่งไม่มีใน type scale = คลาสตาย ยอดรวมจึงได้ขนาด/น้ำหนักที่สืบทอดมา
            (Tailwind ไม่ error เมื่อคลาสไม่มีจริง) — h2 คือ step ที่ใกล้เจตนาที่สุด */}
        <span className="font-ui text-h2 text-black">{fmtBaht(total)}</span>
      </div>

      {/* บรรทัดละเรื่อง เรียงจากเรื่องของผู้ซื้อ → สัญญาฉบับกลาง → สัญญารายร้าน
          แต่ละบรรทัดขึ้นเฉพาะเมื่อเกี่ยวข้อง gap-1 คุมระยะแทน mt- รายบรรทัด
          จะได้ไม่ต้องรู้ว่าบรรทัดไหนโผล่เป็นตัวแรก
          · ลิงก์เปิดแท็บใหม่ — คนกำลังจะจ่ายเงิน ไม่ควรถูกพาออกจากตะกร้าไปอ่านสัญญา */}
      <div className="flex flex-col gap-1 mt-2 font-body text-footnote text-grey-600">
        {!user && <p>ซื้อโดยไม่ต้องสมัครสมาชิกได้ ลิงก์ดาวน์โหลดจะส่งไปทางอีเมล</p>}

        {hasDefaultLicenseFont && (
          <p>
            กรุณาศึกษา{" "}
            <Link href="/agreement/" target="_blank" rel="noopener noreferrer" className="link-accent">
              สัญญาอนุญาต
            </Link>{" "}
            ก่อนสั่งซื้อฟอนต์
          </p>
        )}

        {customLicenseShops.map((shop) => (
          <p key={shop.id}>
            ฟอนต์ของ {shop.name} ใช้สัญญาอนุญาตของผู้ออกแบบ —{" "}
            <LicenseLink pdfUrl={shop.url} className="link-accent font-body text-footnote hover:underline" />
          </p>
        ))}
      </div>

      <div className="mt-5">
        <Button onClick={checkout} disabled={paying} size="lg" className="w-full">
          {paying ? "กำลังพาไปหน้าชำระเงิน…" : "ชำระเงิน"}
        </Button>
      </div>

      {error && <p className="font-body text-body-sm text-danger-dark mt-3">{error}</p>}
    </div>
  );
}
