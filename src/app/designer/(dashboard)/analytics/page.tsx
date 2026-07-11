"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { fetchAllRows } from "@/lib/fetch-all";

type FontLite = {
  id: string;
  name: string | null;
  name_th: string | null;
  slug: string;
  is_free: boolean;
  published_at: string | null;
  is_active: boolean;
};

type EventLite = {
  font_id: string;
  kind: "view" | "free_download";
  created_at: string;
};

type DownloadLogLite = {
  font_id: string;
  created_at: string;
};

type FontStat = {
  font: FontLite;
  viewsMonth: number;
  viewsAll: number;
  freeDownloadsAll: number;
  paidDownloadsAll: number;
};

function isThisMonth(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export default function DesignerAnalyticsPage() {
  const { user } = useAuth();
  const [fonts, setFonts] = useState<FontLite[]>([]);
  const [events, setEvents] = useState<EventLite[]>([]);
  const [downloadLogs, setDownloadLogs] = useState<DownloadLogLite[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: fontData } = await supabase
      .from("fonts")
      .select("id, name, name_th, slug, is_free, published_at, is_active")
      .eq("owner_id", user.id);
    const fontList = (fontData as FontLite[]) ?? [];
    setFonts(fontList);

    // กรองด้วย font_id ของตัวเองเสมอ — ไม่พึ่ง RLS อย่างเดียว เพราะ admin
    // เปิดหน้านี้ได้เหมือนกันและ RLS ให้ admin เห็นทุกแถว (ตัวเลข tiles จะ
    // กลายเป็นของทั้งระบบ ไม่ตรงกับตารางด้านล่างที่กรองตาม owner แล้ว)
    // + ใช้ fetchAllRows กันเพดาน 1000 แถวของ PostgREST นับขาดเงียบ ๆ
    const ids = fontList.map((f) => f.id);
    if (ids.length === 0) {
      setEvents([]);
      setDownloadLogs([]);
      setLoading(false);
      return;
    }

    const [ev, dl] = await Promise.all([
      fetchAllRows<EventLite>(async (from, to) => {
        const { data, error } = await supabase
          .from("font_events")
          .select("font_id, kind, created_at")
          .in("font_id", ids)
          .order("id")
          .range(from, to);
        return { data: data as unknown as EventLite[] | null, error };
      }),
      fetchAllRows<DownloadLogLite>(async (from, to) => {
        const { data, error } = await supabase
          .from("download_logs")
          .select("font_id, created_at")
          .in("font_id", ids)
          .order("id")
          .range(from, to);
        return { data: data as unknown as DownloadLogLite[] | null, error };
      }),
    ]);
    setEvents(ev.rows);
    setDownloadLogs(dl.rows);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const now = new Date();

  const fontStats: FontStat[] = useMemo(() => {
    return fonts
      .map((font) => {
        const fontEvents = events.filter((e) => e.font_id === font.id);
        const fontDownloads = downloadLogs.filter((d) => d.font_id === font.id);
        const viewsAll = fontEvents.filter((e) => e.kind === "view").length;
        const viewsMonth = fontEvents.filter((e) => e.kind === "view" && isThisMonth(e.created_at, now)).length;
        const freeDownloadsAll = fontEvents.filter((e) => e.kind === "free_download").length;
        const paidDownloadsAll = fontDownloads.length;
        return { font, viewsMonth, viewsAll, freeDownloadsAll, paidDownloadsAll };
      })
      .sort((a, b) => b.viewsAll - a.viewsAll);
  }, [fonts, events, downloadLogs]);

  const stats = useMemo(() => {
    const viewsMonth = events.filter((e) => e.kind === "view" && isThisMonth(e.created_at, now)).length;
    const freeDownloadsMonth = events.filter((e) => e.kind === "free_download" && isThisMonth(e.created_at, now)).length;
    const paidDownloadsMonth = downloadLogs.filter((d) => isThisMonth(d.created_at, now)).length;
    const viewsAll = events.filter((e) => e.kind === "view").length;
    return { viewsMonth, freeDownloadsMonth, paidDownloadsMonth, viewsAll };
  }, [events, downloadLogs]);

  const cell = (n: number) => (n > 0 ? n.toLocaleString("th-TH") : <span className="text-[#ddd]">—</span>);

  return (
    <div className="p-6 max-w-[1000px]">
      <div className="mb-1">
        <h1 className="text-[20px] font-semibold text-navy">สถิติ</h1>
      </div>
      <p className="text-[12px] text-[#888] mb-6 leading-relaxed">
        ยอดเข้าชม/ยอดโหลดของฟอนต์คุณเท่านั้น — เริ่มเก็บข้อมูลตั้งแต่ฟีเจอร์นี้เปิดใช้
        (ยอดก่อนหน้านี้ไม่มีข้อมูลย้อนหลัง)
      </p>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-2xl border border-border p-4">
          <div className="text-[22px] font-semibold leading-none mb-1 text-navy">{stats.viewsMonth.toLocaleString("th-TH")}</div>
          <div className="text-[12px] text-[#aaa]">ยอดเข้าชม (เดือนนี้)</div>
        </div>
        <div className="bg-white rounded-2xl border border-border p-4">
          <div className="text-[22px] font-semibold leading-none mb-1 text-mint">{stats.freeDownloadsMonth.toLocaleString("th-TH")}</div>
          <div className="text-[12px] text-[#aaa]">โหลดฟรี (เดือนนี้)</div>
        </div>
        <div className="bg-white rounded-2xl border border-border p-4">
          <div className="text-[22px] font-semibold leading-none mb-1 text-navy">{stats.paidDownloadsMonth.toLocaleString("th-TH")}</div>
          <div className="text-[12px] text-[#aaa]">โหลดไฟล์ซื้อ (เดือนนี้)</div>
        </div>
        <div className="bg-white rounded-2xl border border-border p-4">
          <div className="text-[22px] font-semibold leading-none mb-1 text-navy">{stats.viewsAll.toLocaleString("th-TH")}</div>
          <div className="text-[12px] text-[#aaa]">ยอดเข้าชมรวมทั้งหมด</div>
        </div>
      </div>

      {/* Per-font table */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-border flex items-center justify-center py-12 text-[#aaa] text-[14px]">
          กำลังโหลด…
        </div>
      ) : fontStats.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border p-12 flex flex-col items-center justify-center text-center gap-3">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="text-[#ddd]">
            <path d="M5 30l8-10 8 6 8-14 8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5 35h30" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <div className="text-[15px] font-medium text-navy">ยังไม่มีฟอนต์</div>
          <div className="text-[13px] text-[#aaa] max-w-[380px] leading-relaxed">
            เพิ่มฟอนต์แรกของคุณเพื่อเริ่มเก็บสถิติยอดเข้าชมและยอดโหลด
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="grid grid-cols-[2fr_100px_100px_100px_100px] gap-3 px-4 py-2.5 bg-[#f8f8f6] text-[11px] font-semibold text-[#aaa] tracking-[0.04em] border-b border-border">
            <div>ฟอนต์</div><div>เข้าชมเดือนนี้</div><div>เข้าชมทั้งหมด</div><div>โหลดฟรี</div><div>โหลดซื้อ</div>
          </div>
          {fontStats.map(({ font, viewsMonth, viewsAll, freeDownloadsAll, paidDownloadsAll }) => (
            <div key={font.id} className="grid grid-cols-[2fr_100px_100px_100px_100px] gap-3 px-4 py-3 border-b border-[#f8f8f8] last:border-0 items-center">
              <div>
                <div className="text-[14px] font-semibold text-navy">{font.name_th ?? font.name ?? "—"}</div>
                {!font.published_at && (
                  <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-600">
                    ยังไม่เผยแพร่
                  </span>
                )}
              </div>
              <div className="text-[13px] text-navy">{cell(viewsMonth)}</div>
              <div className="text-[13px] text-navy">{cell(viewsAll)}</div>
              <div className="text-[13px] text-navy">{cell(freeDownloadsAll)}</div>
              <div className="text-[13px] text-navy">{cell(paidDownloadsAll)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
