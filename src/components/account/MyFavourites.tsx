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
import Button from "@/components/ui/Button";
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
    <section className="mt-10">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="font-heading text-h2 text-black">ฟอนต์ที่บันทึกไว้</h2>
        {fonts.length > 0 && <span className="font-body text-body-sm text-grey-600">{fonts.length} ฟอนต์</span>}
      </div>

      {!hasActiveSub && (
        <div className="bg-surface px-4 py-3.5 mb-4 flex items-center justify-between gap-3">
          <p className="font-body text-body-sm text-grey-800 leading-relaxed">
            สมัคร subscription เพื่อ activate ฟอนต์ที่บันทึกไว้ผ่านแอปบนเครื่องของคุณ
          </p>
          <Button as="link" href="/subscribe/" size="sm" className="flex-shrink-0">
            ดูแผนบริการ
          </Button>
        </div>
      )}

      {!loaded ? (
        <p className="font-body text-body-sm text-grey-600">กำลังโหลด…</p>
      ) : fonts.length === 0 ? (
        <div className="bg-surface p-8 text-center">
          <p className="font-body text-body text-grey-800 mb-1">ยังไม่มีฟอนต์ที่บันทึกไว้</p>
          <p className="font-body text-body-sm text-grey-600">
            กดรูปหัวใจบนฟอนต์ที่ชอบ เพื่อบันทึกไว้ดูภายหลังและใช้งานผ่านแอป
          </p>
          <Link href="/fonts/" className="inline-block mt-3 font-body text-body-sm text-mint-text no-underline hover:underline">
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
