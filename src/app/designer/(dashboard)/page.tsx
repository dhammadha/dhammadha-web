"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import Button from "@/components/Button";

type FontRow = {
  id: string;
  name: string | null;
  slug: string;
  is_active: boolean;
  published_at: string | null;
  created_at: string;
  cover_image_url: string | null;
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

export default function DesignerFontsPage() {
  const { user } = useAuth();
  const [fonts, setFonts] = useState<FontRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFonts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("fonts")
      .select("id, name, slug, is_active, published_at, created_at, cover_image_url")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    setFonts((data as FontRow[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadFonts(); }, [loadFonts]);

  const published = fonts.filter((f) => f.published_at);
  const pending = fonts.filter((f) => !f.published_at);

  return (
    <div className="p-6 max-w-[900px]">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[20px] font-semibold text-navy">ฟอนต์ของฉัน</h1>
        <Button as="link" href="/designer/add" size="sm">
          + เพิ่มฟอนต์
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "ฟอนต์ทั้งหมด", value: fonts.length },
          { label: "เผยแพร่แล้ว", value: published.length },
          { label: "รอ Publish", value: pending.length },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-2xl border border-border p-4">
            <div className="text-[12px] text-[#aaa] mb-1">{label}</div>
            <div className="text-[24px] font-semibold text-navy">{value}</div>
          </div>
        ))}
      </div>

      {/* Font list */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <div className="grid grid-cols-[48px_1fr_100px_100px_80px] gap-3 px-4 py-2.5 bg-[#f8f8f6] text-[11px] font-semibold text-[#aaa] tracking-[0.04em] border-b border-border">
          <div></div>
          <div>ชื่อฟอนต์</div>
          <div>สถานะ</div>
          <div>วันที่เพิ่ม</div>
          <div></div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-[#aaa] text-[14px]">กำลังโหลด…</div>
        ) : fonts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <p className="text-[#aaa] text-[14px]">ยังไม่มีฟอนต์</p>
            <Button as="link" href="/designer/add" size="sm">เพิ่มฟอนต์แรก →</Button>
          </div>
        ) : fonts.map((f) => (
          <div key={f.id} className="grid grid-cols-[48px_1fr_100px_100px_80px] gap-3 px-4 py-3 border-b border-[#f8f8f8] last:border-0 items-center">
            <div className="w-10 h-10 rounded-lg bg-[#f5f5f2] overflow-hidden shrink-0">
              {f.cover_image_url && (
                <img src={f.cover_image_url} alt="" className="w-full h-full object-cover" />
              )}
            </div>
            <div>
              <div className="text-[13px] font-medium text-navy">{f.name ?? f.slug}</div>
              <div className="text-[11px] text-[#aaa]">{f.slug}</div>
            </div>
            <div>
              {f.published_at ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">เผยแพร่แล้ว</span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">รอ Publish</span>
              )}
              {!f.is_active && (
                <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-[#f5f5f2] text-[#aaa] font-medium">ซ่อน</span>
              )}
            </div>
            <div className="text-[12px] text-[#aaa]">{fmtDate(f.created_at)}</div>
            <div>
              <Link
                href={`/fonts/${f.slug}`}
                target="_blank"
                className="text-[12px] text-mint no-underline hover:underline"
              >
                ดู →
              </Link>
            </div>
          </div>
        ))}
      </div>

      {pending.length > 0 && (
        <p className="text-[12px] text-[#aaa] mt-4">
          ฟอนต์ที่ยังไม่ได้ Publish จะยังไม่แสดงบนเว็บ — รอ admin อนุมัติ
        </p>
      )}
    </div>
  );
}
