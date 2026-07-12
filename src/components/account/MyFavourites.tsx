"use client";

// "ฟอนต์ที่บันทึกไว้" — แสดงในหน้าบัญชี (favourites)
// แสดงแม้ยังไม่สมัคร subscription พร้อมชวนสมัครเพื่อ activate ผ่านแอป
// favourite บนเว็บ = รายการโปรดใน desktop app

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useFavourites } from "@/context/FavouritesContext";
import FontCard, { Font } from "@/components/FontCard";
import { isSubActive, type SubscriptionRow } from "@/lib/subscription";

export default function MyFavourites() {
  const { user } = useAuth();
  const { favourites, loading: favLoading } = useFavourites();
  const [fonts, setFonts] = useState<Font[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [hasActiveSub, setHasActiveSub] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("subscriptions")
      .select("*")
      .eq("status", "active")
      .then(({ data }) => {
        const rows = (data as SubscriptionRow[]) ?? [];
        setHasActiveSub(rows.some((r) => isSubActive(r)));
      });
  }, [user]);

  useEffect(() => {
    if (favLoading) return;
    const ids = Array.from(favourites);
    if (ids.length === 0) {
      setFonts([]);
      setLoaded(true);
      return;
    }
    supabase
      .from("fonts")
      .select("*")
      .in("id", ids)
      .then(({ data }) => {
        setFonts((data as Font[]) ?? []);
        setLoaded(true);
      });
  }, [favourites, favLoading]);

  if (!user) return null;

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-[18px] font-semibold text-navy">ฟอนต์ที่บันทึกไว้</h2>
        {fonts.length > 0 && <span className="text-[13px] text-[#aaa]">{fonts.length} ฟอนต์</span>}
      </div>

      {!hasActiveSub && (
        <div className="bg-mint-light border border-[0.5px] border-mint-mid rounded-[10px] px-4 py-3.5 mb-4 flex items-center justify-between gap-3">
          <p className="text-[13px] text-[#0a8a84] leading-relaxed">
            สมัคร subscription เพื่อ activate ฟอนต์ที่บันทึกไว้ผ่านแอปบนเครื่องของคุณ
          </p>
          <Link
            href="/subscribe/"
            className="flex-shrink-0 text-[13px] font-medium text-[#0a8a84] no-underline bg-white border border-[0.5px] border-mint rounded-[7px] px-3.5 py-1.5 hover:bg-mint hover:text-navy transition-colors"
          >
            ดูแผนบริการ
          </Link>
        </div>
      )}

      {!loaded ? (
        <p className="text-[14px] text-[#aaa]">กำลังโหลด…</p>
      ) : fonts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border p-8 text-center">
          <p className="text-[14px] text-[#888] mb-1">ยังไม่มีฟอนต์ที่บันทึกไว้</p>
          <p className="text-[13px] text-[#aaa]">
            กดรูปหัวใจบนฟอนต์ที่ชอบ เพื่อบันทึกไว้ดูภายหลังและใช้งานผ่านแอป
          </p>
          <Link href="/fonts/" className="inline-block mt-3 text-[13px] text-mint no-underline hover:underline font-medium">
            เลือกดูฟอนต์ →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {fonts.map((f) => (
            <FontCard key={f.id} font={f} />
          ))}
        </div>
      )}
    </section>
  );
}
