"use client";

// รายได้ของ designer เอง — ใช้ร่วมทั้ง /designer/revenue และ /admin/revenue
// 4 กล่องกดได้ (Retail Font / Subscription / รายได้รวม / ยอดค้างโอน) — ค่า = ส่วนแบ่งของตัวเอง
// ตาม filter ช่วงเวลา · การจ่ายจริงเป็นรายไตรมาส (ดู payouts / หน้า admin Payouts)

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { fetchAllRows } from "@/lib/fetch-all";
import {
  buildFontSales,
  aggregateFontSales,
  monthsInPeriod,
  orderInPeriod,
  periodOptions,
  monthLabel,
  fmtBaht,
  type FontSale,
  type FontSaleAgg,
  type OrderLite,
  type PayoutRow,
  type Period,
} from "@/lib/revenue";
import {
  buildSubMonthStatement,
  designerSlice,
  type MonthData,
  type FontShare,
} from "@/lib/subscription-revenue";

type FontMeta = { id: string; name: string | null; slug: string | null; cover_image_url: string | null; price: number | null };
type Box = "retail" | "subscription" | "gross" | "pending";

// ส่วนแบ่ง subscription รายเดือนของ designer (ใช้สร้างทั้งยอดกล่องและ detail)
type SubMonth = { year: number; month: number; total: number; fonts: FontShare[] };

const RETAIL_GRID = "grid grid-cols-[44px_2fr_100px_100px_120px_110px] gap-3";
const COMBINED_RETAIL_GRID = "grid grid-cols-[2fr_100px_120px_110px] gap-3";
const SUB_GRID = "grid grid-cols-[2fr_1fr_1fr_1fr] gap-3";

function fmtBahtOrDash(n: number) {
  return n > 0 ? fmtBaht(n) : "—";
}

export default function OwnRevenue() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderLite[]>([]);
  const [fonts, setFonts] = useState<Record<string, FontMeta>>({});
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);

  const options = useMemo(() => periodOptions(), []);
  const [periodKeyStr, setPeriodKeyStr] = useState(options[0].key);
  const period: Period = (options.find((o) => o.key === periodKeyStr) ?? options[0]).period;

  const [box, setBox] = useState<Box>("retail");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // subscription รายเดือน cache ต่อ month key — RPC เป็นรายเดือน วนตามช่วงที่เลือก
  const [subCache, setSubCache] = useState<Record<string, SubMonth>>({});
  const [subLoading, setSubLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [orderRes, fontRes, payoutRes] = await Promise.all([
      fetchAllRows<OrderLite>(async (from, to) => {
        const { data, error } = await supabase
          .from("orders")
          .select("id, order_no, designer_id, total_amount, status, paid_at, created_at, source, platform_amount, designer_amount, items, customer_name, customer_email, company_name")
          .eq("designer_id", user.id)
          .order("created_at", { ascending: false })
          .range(from, to);
        return { data: data as unknown as OrderLite[] | null, error };
      }),
      supabase.from("fonts").select("id, name, slug, cover_image_url, price").eq("owner_id", user.id),
      supabase.from("payouts").select("*").eq("designer_id", user.id).order("paid_at", { ascending: false }),
    ]);
    setOrders(orderRes.rows);
    const map: Record<string, FontMeta> = {};
    for (const f of (fontRes.data as FontMeta[] | null) ?? []) map[f.id] = f;
    setFonts(map);
    setPayouts((payoutRes.data as PayoutRow[] | null) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // โหลด subscription ของเดือนที่ยังไม่ cache ในช่วงที่เลือก
  useEffect(() => {
    if (!user) return;
    const months = monthsInPeriod(period);
    const missing = months.filter((m) => !(`${m.year}-${m.month}` in subCache));
    if (missing.length === 0) return;
    let cancelled = false;
    setSubLoading(true);
    (async () => {
      const results = await Promise.all(
        missing.map(async (m) => {
          const { data, error } = await supabase.rpc("subscription_month_data", { p_year: m.year, p_month: m.month });
          if (error || !data) return { ...m, total: 0, fonts: [] as FontShare[] };
          const slice = designerSlice(buildSubMonthStatement(data as unknown as MonthData), user.id);
          return { ...m, total: slice?.total ?? 0, fonts: slice?.fonts ?? [] };
        })
      );
      if (cancelled) return;
      setSubCache((prev) => {
        const next = { ...prev };
        for (const r of results) next[`${r.year}-${r.month}`] = r;
        return next;
      });
      setSubLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, periodKeyStr]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── ยอดรวมของช่วงที่เลือก ────────────────────────────────────────────────
  const periodOrders = useMemo(() => orders.filter((o) => o.status === "paid" && orderInPeriod(o, period)), [orders, periodKeyStr]); // eslint-disable-line react-hooks/exhaustive-deps
  const fontSales = useMemo(() => buildFontSales(periodOrders), [periodOrders]);

  const fontSalesAgg = useMemo(() => aggregateFontSales(fontSales), [fontSales]);
  const b2cGross = useMemo(() => periodOrders.filter((o) => o.source === "checkout").reduce((s, o) => s + o.total_amount, 0), [periodOrders]);
  const b2cShare = useMemo(() => fontSales.reduce((s, f) => s + f.designerShare, 0), [fontSales]);

  const subMonths = useMemo(() => monthsInPeriod(period).map((m) => subCache[`${m.year}-${m.month}`]).filter(Boolean) as SubMonth[], [subCache, periodKeyStr]); // eslint-disable-line react-hooks/exhaustive-deps
  const subTotal = useMemo(() => subMonths.reduce((s, m) => s + m.total, 0), [subMonths]);

  const netTotal = b2cShare + subTotal; // ส่วนแบ่งรวมของช่วง (Retail + Subscription)

  // ยอดค้างโอน = ยอดสะสมทั้งหมดที่ยังไม่โอน (all-time) — เงินที่ค้างไม่หายไปไหน
  // ไม่ขึ้นกับ filter ช่วงเวลา (กล่อง 1-3 เปลี่ยนตาม filter แต่ยอดค้างโอน = ยอดจริงที่ค้าง ณ ตอนนี้)
  // หมายเหตุ: คิดจาก Retail เท่านั้น (sub=0) — เพิ่ม subscription เมื่อ Phase 4.1 live
  const retailShareAllTime = useMemo(
    () => orders
      .filter((o) => o.status === "paid" && o.source === "checkout")
      .reduce((s, o) => s + (o.designer_amount ?? o.total_amount * 0.75), 0),
    [orders]
  );
  const paidAllTime = useMemo(() => payouts.reduce((s, p) => s + p.amount, 0), [payouts]);
  const outstanding = Math.max(0, retailShareAllTime - paidAllTime);
  // ประวัติการโอนทั้งหมด (all-time) เรียงล่าสุด→เก่าสุด
  const allPayouts = useMemo(
    () => [...payouts].sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime()),
    [payouts]
  );

  // รวม subscription รายฟอนต์ข้ามเดือน (สำหรับ detail กล่อง Subscription)
  const subFonts = useMemo(() => {
    const map = new Map<string, { name: string | null; equal: number; stream: number; total: number }>();
    for (const m of subMonths) {
      for (const f of m.fonts) {
        let row = map.get(f.fontId);
        if (!row) { row = { name: f.name, equal: 0, stream: 0, total: 0 }; map.set(f.fontId, row); }
        row.equal += f.equalAmount;
        row.stream += f.streamAmount;
        row.total += f.total;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [subMonths]);

  const toggle = (k: string) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(k)) next.delete(k); else next.add(k);
    return next;
  });

  // กล่อง 1-3 = ส่วนแบ่งของตัวเอง (ไม่ใช่ยอดขาย gross) · กล่อง 4 = ยอดค้างโอน (mint)
  const BOXES: { key: Box; label: string; value: number; mint?: boolean }[] = [
    { key: "retail", label: "รายได้ Retail Font", value: b2cShare },
    { key: "subscription", label: "รายได้ Subscription", value: subTotal },
    { key: "gross", label: "รายได้รวม", value: netTotal },
    { key: "pending", label: "ยอดค้างโอน", value: outstanding, mint: true },
  ];

  return (
    <div className="p-6 max-w-[1200px]">
      <div className="mb-1">
        <h1 className="font-heading text-h2 text-black">รายได้</h1>
        <p className="font-body text-body-sm text-grey-600 mt-0.5">สรุปยอดขายและรายได้รายเดือน</p>
        <p className="font-body text-body-sm text-grey-600 mt-0.5">
          จ่ายส่วนแบ่งทุก 3 เดือน (รายไตรมาส) — โอนในเดือนมกราคม เมษายน กรกฎาคม และตุลาคม
        </p>
      </div>

      {/* Period filter */}
      <div className="flex items-center gap-2 mt-4 mb-4">
        <label className="font-body font-bold text-body-sm text-grey-600">ช่วงเวลา</label>
        <select
          value={periodKeyStr}
          onChange={(e) => { setPeriodKeyStr(e.target.value); setExpanded(new Set()); }}
          className="px-3 py-2 h-[38px] bg-surface font-body text-body-sm text-black outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black transition-colors duration-150 ease-base"
        >
          {options.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
        {subLoading && <span className="font-body text-footnote text-grey-600">กำลังโหลด subscription…</span>}
      </div>

      {loading ? (
        <div className="bg-surface flex items-center justify-center py-16 font-body text-body-sm text-grey-600">กำลังโหลด…</div>
      ) : (
        <>
          {/* 4 กล่องกดได้ */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {BOXES.map((b) => (
              <button
                key={b.key}
                onClick={() => setBox(b.key)}
                className={`text-left p-4 border-none cursor-pointer transition-colors duration-150 ease-base ${box === b.key ? "bg-mint" : "bg-surface hover:bg-grey-200"}`}
              >
                {/* mint = สีปกติของกล่องยอดค้างโอน · พอกดเลือก (พื้น mint) เปลี่ยนเป็นดำให้อ่านออก */}
                <div className={`font-heading text-h2 leading-none mb-1 ${b.mint && box !== b.key ? "text-mint-text" : "text-black"}`}>{fmtBaht(b.value)}</div>
                <div className="font-body text-footnote text-grey-600">{b.label}</div>
              </button>
            ))}
          </div>

          {/* Detail */}
          {box === "retail" && <RetailDetail sales={fontSales} fonts={fonts} />}
          {box === "subscription" && <SubscriptionDetail fonts={subFonts} />}
          {box === "gross" && (
            <CombinedDetail
              retailSales={fontSalesAgg}
              retailShare={b2cShare}
              retailGross={b2cGross}
              subMonths={subMonths}
              subTotal={subTotal}
              expanded={expanded}
              toggle={toggle}
            />
          )}
          {box === "pending" && <PayoutHistory payouts={allPayouts} />}
        </>
      )}
    </div>
  );
}

function EmptyRow({ text = "ไม่มีข้อมูลในช่วงนี้" }: { text?: string }) {
  return <div className="flex items-center justify-center py-12 font-body text-body-sm text-grey-600">{text}</div>;
}

// กล่อง Retail Font — ตารางรายฟอนต์ แยกตามจุดราคา (รูป + ชื่อ en / ราคา / จำนวนขาย / ยอดรวม / ส่วนแบ่ง)
function RetailDetail({ sales, fonts }: { sales: FontSale[]; fonts: Record<string, FontMeta> }) {
  return (
    <div className="bg-surface overflow-hidden">
      <div className={`${RETAIL_GRID} px-4 py-2.5 bg-white font-heading text-badge text-grey-600 tracking-[0.04em]`}>
        <div /><div>ฟอนต์</div><div>ราคา</div><div>จำนวนที่ขาย</div><div>ยอดรวมทั้งหมด</div><div>ส่วนแบ่ง</div>
      </div>
      {sales.length === 0 ? <EmptyRow /> : sales.map((s) => {
        const f = fonts[s.fontId];
        return (
          <div key={`${s.fontId}:${s.price}`} className={`${RETAIL_GRID} px-4 py-3 items-center hover:bg-grey-200 transition-colors duration-150 ease-base`}>
            <div>
              {f?.cover_image_url
                ? <img src={f.cover_image_url} alt={f.name ?? ""} className="w-9 h-[20px] object-cover" />
                : <div className="w-9 h-[20px] bg-grey-200" />}
            </div>
            <div className="font-ui text-ui text-black truncate">{f?.name ?? s.name ?? "—"}</div>
            <div className="font-body text-body-sm text-grey-600">{fmtBaht(s.price)}</div>
            <div className="font-body text-body-sm text-grey-600">{s.qty}</div>
            <div className="font-body text-body-sm text-black">{fmtBaht(s.total)}</div>
            <div className="font-ui text-ui text-black">{fmtBaht(s.designerShare)}</div>
          </div>
        );
      })}
    </div>
  );
}

// กล่อง Subscription — ตารางรายฟอนต์ subscription ในช่วง
function SubscriptionDetail({ fonts }: { fonts: { name: string | null; equal: number; stream: number; total: number }[] }) {
  return (
    <div className="bg-surface overflow-hidden">
      <div className={`${SUB_GRID} px-4 py-2.5 bg-white font-heading text-badge text-grey-600 tracking-[0.04em]`}>
        <div>ฟอนต์</div><div>แบ่งเท่ากัน</div><div>ตามการใช้งาน</div><div>รายได้รวม</div>
      </div>
      {fonts.length === 0 ? <EmptyRow /> : fonts.map((f, i) => (
        <div key={i} className={`${SUB_GRID} px-4 py-3 items-center font-body text-body-sm`}>
          <div className="text-black truncate">{f.name ?? "—"}</div>
          <div className="text-grey-600">{fmtBaht(f.equal)}</div>
          <div className="text-grey-600">{fmtBaht(f.stream)}</div>
          <div className="font-ui text-ui text-black">{fmtBaht(f.total)}</div>
        </div>
      ))}
    </div>
  );
}

// กล่อง ยอดค้างโอน — ประวัติการโอนเงินของช่วงที่เลือก (ล่าสุด→เก่าสุด)
function PayoutHistory({ payouts }: { payouts: PayoutRow[] }) {
  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="bg-surface overflow-hidden">
      <div className="grid grid-cols-[1fr_140px] gap-3 px-4 py-2.5 bg-white font-heading text-badge text-grey-600 tracking-[0.04em]">
        <div>วันที่เว็บโอน</div><div>จำนวนเงิน</div>
      </div>
      {payouts.length === 0 ? <EmptyRow text="ยังไม่มีข้อมูล" /> : payouts.map((p) => (
        <div key={p.id} className="grid grid-cols-[1fr_140px] gap-3 px-4 py-3 items-center">
          <div className="font-body text-body-sm text-black">
            {fmtDate(p.paid_at)}
            {p.note && <span className="font-body text-footnote text-grey-600"> · {p.note}</span>}
          </div>
          <div className="font-ui text-ui text-black">{fmtBaht(p.amount)}</div>
        </div>
      ))}
    </div>
  );
}

// กล่อง รายได้ทั้งหมด / ส่วนแบ่งทั้งหมด — 2 แถวกดขยาย
function CombinedDetail({
  retailSales, retailShare, retailGross, subMonths, subTotal, expanded, toggle,
}: {
  retailSales: FontSaleAgg[];
  retailShare: number;
  retailGross: number;
  subMonths: SubMonth[];
  subTotal: number;
  expanded: Set<string>;
  toggle: (k: string) => void;
}) {
  const retailOpen = expanded.has("c-retail");
  const subOpen = expanded.has("c-sub");
  return (
    <div className="bg-surface overflow-hidden flex flex-col">
      {/* Retail Font row */}
      <button onClick={() => toggle("c-retail")} className="flex items-center justify-between gap-3 px-4 py-3.5 bg-transparent border-none cursor-pointer hover:bg-grey-200 transition-colors duration-150 ease-base text-left">
        <div className="flex items-center gap-2.5">
          <Chevron open={retailOpen} />
          <span className="font-ui text-ui text-black">Retail Font</span>
        </div>
        <div className="flex items-baseline gap-4">
          <span className="font-body text-footnote text-grey-600">ยอดขาย {fmtBahtOrDash(retailGross)}</span>
          <span className="font-ui text-ui text-mint-text">ส่วนแบ่ง {fmtBaht(retailShare)}</span>
        </div>
      </button>
      {retailOpen && (
        <div className="bg-white/60">
          <div className={`${COMBINED_RETAIL_GRID} px-4 py-2 font-heading text-badge text-grey-600 tracking-[0.04em]`}>
            <div>ฟอนต์</div><div>ขายกี่ครั้ง</div><div>ยอดรวม</div><div>ส่วนแบ่ง</div>
          </div>
          {retailSales.length === 0 ? <EmptyRow /> : retailSales.map((s) => (
            <div key={s.fontId} className={`${COMBINED_RETAIL_GRID} px-4 py-2.5 items-center font-body text-body-sm`}>
              <div className="text-black truncate">{s.name ?? "—"}</div>
              <div className="text-grey-600">{s.qty}</div>
              <div className="text-black">{fmtBaht(s.total)}</div>
              <div className="text-mint-text">{fmtBaht(s.designerShare)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Subscription row — แจกแจงรายเดือน ไม่แจกแจงฟอนต์ */}
      <button onClick={() => toggle("c-sub")} className="flex items-center justify-between gap-3 px-4 py-3.5 bg-transparent border-none cursor-pointer hover:bg-grey-200 transition-colors duration-150 ease-base text-left">
        <div className="flex items-center gap-2.5">
          <Chevron open={subOpen} />
          <span className="font-ui text-ui text-black">Subscription</span>
        </div>
        <span className="font-ui text-ui text-mint-text">ส่วนแบ่ง {fmtBaht(subTotal)}</span>
      </button>
      {subOpen && (
        <div className="bg-white/60">
          <div className="grid grid-cols-[2fr_1fr] gap-3 px-4 py-2 font-heading text-badge text-grey-600 tracking-[0.04em]">
            <div>เดือน</div><div>ส่วนแบ่ง</div>
          </div>
          {subMonths.filter((m) => m.total > 0).length === 0 ? <EmptyRow /> : subMonths.filter((m) => m.total > 0).map((m) => (
            <div key={`${m.year}-${m.month}`} className="grid grid-cols-[2fr_1fr] gap-3 px-4 py-2.5 items-center font-body text-body-sm">
              <div className="text-black">{monthLabel(m.year, m.month)}</div>
              <div className="text-mint-text">{fmtBaht(m.total)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`text-grey-400 transition-transform duration-150 ease-base ${open ? "rotate-90" : ""}`}>
      <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
