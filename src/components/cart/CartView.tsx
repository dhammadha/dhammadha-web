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
import { useCart } from "@/context/CartContext";
import { mergeShopPromos } from "@/lib/shop-promo";
import { effectiveSale } from "@/lib/sale";
import { fmtBaht } from "@/lib/revenue";
import Button from "@/components/ui/Button";

type CartFont = {
  id: string;
  slug: string;
  name: string | null;
  name_th: string | null;
  price: number | null;
  sale_price: number | null;
  sale_end: string | null;
  is_sale: boolean;
  is_free: boolean;
  discount_percent: number | null;
  sale_label: string | null;
  cover_image_url: string | null;
  owner_id: string | null;
  designer_profiles?: { designer_slug?: string | null; business_name?: string | null } | null;
  shop_discount_percent?: number | null;
  shop_sale_end?: string | null;
};

export default function CartView() {
  const { items, remove, ready } = useCart();
  const [fonts, setFonts] = useState<CartFont[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ready) return;
    if (items.length === 0) {
      setFonts([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    supabase
      .from("fonts")
      .select(
        "id, slug, name, name_th, price, sale_price, sale_end, is_sale, is_free, discount_percent, sale_label, cover_image_url, owner_id, designer_profiles!owner_id(designer_slug, business_name)"
      )
      .in("id", items)
      .eq("is_active", true)
      .not("published_at", "is", null)
      .then(async ({ data }) => {
        if (!active) return;
        const withPromo = await mergeShopPromos((data ?? []) as unknown as CartFont[]);
        if (!active) return;
        // เรียงตามลำดับที่หยิบใส่ตะกร้า
        setFonts(items.map((id) => withPromo.find((f) => f.id === id)).filter((f): f is CartFont => !!f));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [items, ready]);

  const priceOf = (f: CartFont) => {
    const eff = effectiveSale(f);
    return eff.active && eff.salePrice > 0 ? eff.salePrice : f.price ?? 0;
  };
  const total = fonts.reduce((sum, f) => sum + priceOf(f), 0);

  // ฟอนต์ที่หายไป (ถูกถอดออกจากเว็บ/ปิดขาย) — ยังค้างใน localStorage ต้องบอกผู้ใช้
  const missing = ready && !loading ? items.length - fonts.length : 0;

  const { user } = useAuth();

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

  if (!ready || loading) {
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
                  <Link href={`/fonts/${designerSlug}/${f.slug}/`} className="font-body text-body text-black no-underline hover:text-mint-text truncate block">
                    {name}
                  </Link>
                ) : (
                  <span className="font-body text-body text-black truncate block">{name}</span>
                )}
                <span className="font-body text-footnote text-grey-600">
                  โดย {f.designer_profiles?.business_name || "—"} · สิทธิ์บุคคลทั่วไป
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

      <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
        <span className="font-body text-body text-black">รวม {fonts.length} ฟอนต์</span>
        <span className="font-heading text-h3 text-black">{fmtBaht(total)}</span>
      </div>

      <p className="font-body text-footnote text-grey-600 mt-2">
        กดชำระเงินแล้วจะมีให้ติ๊กยอมรับ{" "}
        <Link href="/agreement/" className="text-mint-text">สัญญาอนุญาต</Link>{" "}
        ก่อนจ่ายเงิน · ไฟล์ที่ได้จะถูกประทับข้อมูลสิทธิ์ของผู้ซื้อ
        {!user && " · ซื้อโดยไม่ต้องสมัครสมาชิกได้ ลิงก์ดาวน์โหลดจะส่งไปทางอีเมล"}
      </p>

      <div className="mt-5">
        <Button onClick={checkout} disabled={paying} size="lg" className="w-full">
          {paying ? "กำลังพาไปหน้าชำระเงิน…" : "ชำระเงิน"}
        </Button>
      </div>

      {error && <p className="font-body text-body-sm text-danger-dark mt-3">{error}</p>}
    </div>
  );
}
