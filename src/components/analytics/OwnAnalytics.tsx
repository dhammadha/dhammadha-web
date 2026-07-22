"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { fetchAllRows } from "@/lib/fetch-all";
import { monthLabel } from "@/lib/revenue";

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

function isInMonth(iso: string, year: number, month: number): boolean {
  const d = new Date(iso);
  return d.getFullYear() === year && d.getMonth() + 1 === month;
}

// filter เดือน/ปี — pattern เดียวกับ OwnRevenue.tsx (DESIGN.md §18.2)
function recentMonths(count: number): { year: number; month: number; key: string }[] {
  const out: { year: number; month: number; key: string }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    out.push({ year, month, key: `${year}-${String(month).padStart(2, "0")}` });
  }
  return out;
}

export default function OwnAnalytics() {
  const { user } = useAuth();
  const [fonts, setFonts] = useState<FontLite[]>([]);
  const [events, setEvents] = useState<EventLite[]>([]);
  const [downloadLogs, setDownloadLogs] = useState<DownloadLogLite[]>([]);
  const [loading, setLoading] = useState(true);

  const months = recentMonths(12);
  const [monthKey, setMonthKey] = useState(months[0].key);
  const sel = months.find((m) => m.key === monthKey) ?? months[0];

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

  const fontStats: FontStat[] = useMemo(() => {
    return fonts
      .map((font) => {
        const fontEvents = events.filter((e) => e.font_id === font.id);
        const fontDownloads = downloadLogs.filter((d) => d.font_id === font.id);
        const viewsAll = fontEvents.filter((e) => e.kind === "view").length;
        const viewsMonth = fontEvents.filter((e) => e.kind === "view" && isInMonth(e.created_at, sel.year, sel.month)).length;
        const freeDownloadsAll = fontEvents.filter((e) => e.kind === "free_download").length;
        const paidDownloadsAll = fontDownloads.length;
        return { font, viewsMonth, viewsAll, freeDownloadsAll, paidDownloadsAll };
      })
      .sort((a, b) => b.viewsAll - a.viewsAll);
  }, [fonts, events, downloadLogs, sel.year, sel.month]);

  const stats = useMemo(() => {
    const viewsMonth = events.filter((e) => e.kind === "view" && isInMonth(e.created_at, sel.year, sel.month)).length;
    const freeDownloadsMonth = events.filter((e) => e.kind === "free_download" && isInMonth(e.created_at, sel.year, sel.month)).length;
    const paidDownloadsMonth = downloadLogs.filter((d) => isInMonth(d.created_at, sel.year, sel.month)).length;
    const viewsAll = events.filter((e) => e.kind === "view").length;
    return { viewsMonth, freeDownloadsMonth, paidDownloadsMonth, viewsAll };
  }, [events, downloadLogs, sel.year, sel.month]);

  const cell = (n: number) => (n > 0 ? n.toLocaleString("th-TH") : <span className="text-grey-600">—</span>);

  return (
    <div className="p-6 max-w-[1200px]">
      <div className="mb-1">
        <h1 className="font-heading text-h2 text-black">สถิติ</h1>
      </div>
      <p className="font-body text-footnote text-grey-600 mb-4 leading-relaxed">
        ยอดเข้าชม/ยอดดาวน์โหลดของฟอนต์ที่คุณเป็นเจ้าของเท่านั้น
      </p>

      {/* Month selector — pattern เดียวกับหน้ารายได้ */}
      <div className="flex items-center gap-2 mb-4">
        <label className="font-body font-bold text-body-sm text-grey-600">เดือน</label>
        <select
          value={monthKey}
          onChange={(e) => setMonthKey(e.target.value)}
          className="px-3 py-2 h-[36px] bg-surface font-body text-body-sm text-black outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black transition-colors duration-150 ease-base"
        >
          {months.map((m) => (
            <option key={m.key} value={m.key}>{monthLabel(m.year, m.month)}</option>
          ))}
        </select>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-surface p-4">
          <div className="font-heading text-h2 text-black leading-none mb-1">{stats.viewsMonth.toLocaleString("th-TH")}</div>
          <div className="font-body text-footnote text-grey-600">ยอดเข้าชม</div>
        </div>
        <div className="bg-surface p-4">
          <div className="font-heading text-h2 text-black leading-none mb-1">{stats.freeDownloadsMonth.toLocaleString("th-TH")}</div>
          <div className="font-body text-footnote text-grey-600">โหลดฟรี</div>
        </div>
        <div className="bg-surface p-4">
          <div className="font-heading text-h2 text-black leading-none mb-1">{stats.paidDownloadsMonth.toLocaleString("th-TH")}</div>
          <div className="font-body text-footnote text-grey-600">โหลดไฟล์ซื้อ</div>
        </div>
        <div className="bg-surface p-4">
          <div className="font-heading text-h2 text-mint-text leading-none mb-1">{stats.viewsAll.toLocaleString("th-TH")}</div>
          <div className="font-body text-footnote text-grey-600">ยอดเข้าชมรวมทั้งหมด</div>
        </div>
      </div>

      {/* Per-font table */}
      {loading ? (
        <div className="bg-surface flex items-center justify-center py-12 font-body text-body-sm text-grey-600">
          กำลังโหลด…
        </div>
      ) : fontStats.length === 0 ? (
        <div className="bg-surface p-12 flex flex-col items-center justify-center text-center gap-3">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="text-grey-400">
            <path d="M5 30l8-10 8 6 8-14 8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5 35h30" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <div className="font-ui text-ui text-black">ยังไม่มีฟอนต์</div>
          <div className="font-body text-body-sm text-grey-600 max-w-[380px] leading-relaxed">
            เพิ่มฟอนต์แรกของคุณเพื่อเริ่มเก็บสถิติยอดเข้าชมและยอดโหลด
          </div>
        </div>
      ) : (
        <div className="bg-surface overflow-hidden">
          <div className="grid grid-cols-[2fr_100px_100px_100px_100px] gap-3 px-4 py-2.5 bg-white font-heading text-badge text-grey-600 tracking-[0.04em]">
            <div>ฟอนต์</div><div>เข้าชมเดือนที่เลือก</div><div>เข้าชมทั้งหมด</div><div>โหลดฟรี</div><div>โหลดซื้อ</div>
          </div>
          {fontStats.map(({ font, viewsMonth, viewsAll, freeDownloadsAll, paidDownloadsAll }) => (
            <div key={font.id} className="grid grid-cols-[2fr_100px_100px_100px_100px] gap-3 px-4 py-3 items-center">
              <div>
                <div className="font-ui text-ui text-black">{font.name_th ?? font.name ?? "—"}</div>
                {!font.published_at && (
                  <span className="inline-block mt-1 text-badge font-heading px-2 py-0.5 bg-warning text-black">
                    ยังไม่เผยแพร่
                  </span>
                )}
              </div>
              <div className="font-body text-footnote text-black">{cell(viewsMonth)}</div>
              <div className="font-body text-footnote text-black">{cell(viewsAll)}</div>
              <div className="font-body text-footnote text-black">{cell(freeDownloadsAll)}</div>
              <div className="font-body text-footnote text-black">{cell(paidDownloadsAll)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
