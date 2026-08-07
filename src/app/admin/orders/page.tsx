"use client";

// รายการคำสั่งซื้อทั้งหมด (admin) — 2 แท็บ Retail Font / Subscription + filter ช่วงเวลา
// admin อ่าน orders/subscriptions/users ได้ทั้งหมดผ่าน RLS

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchAllRows } from "@/lib/fetch-all";
import Modal from "@/components/ui/Modal";
import {
  orderInPeriod,
  periodOptions,
  quarterOfMonth,
  fmtBaht,
  type OrderLite,
  type Period,
} from "@/lib/revenue";

type Tab = "retail" | "subscription";

type SubRow = {
  id: string;
  user_id: string;
  provider: string;
  status: string;
  price_amount: number;
  current_period_end: string;
  created_at: string;
};

type UserInfo = { id: string; name: string | null; business_name: string | null; email: string | null };

/** 1 แถว = 1 ครั้งที่กดดาวน์โหลด (Edge Function download-font เขียนทุกครั้ง ไม่มี dedupe) */
type LogRow = {
  entitlement_id: string;
  font_id: string | null;
  file_path: string | null;
  ip: string | null;
  created_at: string;
};

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

// ประวัติดาวน์โหลดต้องมีเวลาด้วย ใช้ยืนยันกับลูกค้าตอนมีข้อพิพาท
function fmtDateTime(s: string) {
  return new Date(s).toLocaleString("th-TH", {
    day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

const RETAIL_GRID = "grid grid-cols-[110px_140px_1fr_110px_170px] gap-3";
const SUB_GRID = "grid grid-cols-[110px_120px_1.2fr_1.4fr_120px] gap-3";
// รายการฟอนต์ในออเดอร์ (แถวที่กางออกมา) — หัวตารางกับแถวข้อมูลต้องใช้ตัวเดียวกัน
const ITEM_GRID = "grid grid-cols-[1.6fr_1.2fr_100px_150px_120px] gap-3";
const LOG_GRID = "grid grid-cols-[1.2fr_1.6fr_150px_130px] gap-3";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderLite[]>([]);
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [users, setUsers] = useState<Record<string, UserInfo>>({});
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<Tab>("retail");
  const options = useMemo(() => periodOptions(), []);
  const [periodKeyStr, setPeriodKeyStr] = useState(options[0].key);
  const period: Period = (options.find((o) => o.key === periodKeyStr) ?? options[0]).period;
  const [openId, setOpenId] = useState<string | null>(null);
  /** order_id → ประวัติการดาวน์โหลดของฟอนต์ในใบนั้น (ล่าสุดขึ้นก่อน) */
  const [logsByOrder, setLogsByOrder] = useState<Record<string, LogRow[]>>({});
  const [logOrder, setLogOrder] = useState<OrderLite | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [orderRes, subRes] = await Promise.all([
      fetchAllRows<OrderLite>(async (from, to) => {
        const { data, error } = await supabase
          .from("orders")
          // order_items: ใบที่ซื้อข้ามร้านมี designer คนละคนต่อรายการ (orders.designer_id เป็น null)
          .select("id, order_no, designer_id, total_amount, status, paid_at, created_at, source, platform_amount, designer_amount, items, customer_name, customer_email, company_name, order_items(font_id, designer_id, name, price, platform_amount, designer_amount)")
          .order("created_at", { ascending: false })
          .range(from, to);
        return { data: data as unknown as OrderLite[] | null, error };
      }),
      supabase.from("subscriptions").select("id, user_id, provider, status, price_amount, current_period_end, created_at").order("created_at", { ascending: false }),
    ]);
    const allOrders = orderRes.rows;
    const allSubs = (subRes.data as SubRow[] | null) ?? [];
    setOrders(allOrders);
    setSubs(allSubs);

    // users map สำหรับชื่อ designer (ต่อ order) + ชื่อ/อีเมลสมาชิก (ต่อ subscription)
    const ids = Array.from(new Set([
      ...allOrders.map((o) => o.designer_id).filter((x): x is string => !!x),
      ...allOrders.flatMap((o) => (o.order_items ?? []).map((i) => i.designer_id)).filter((x): x is string => !!x),
      ...allSubs.map((s) => s.user_id),
    ]));
    if (ids.length > 0) {
      const { data: userData } = await supabase.from("users").select("id, name, business_name, email").in("id", ids);
      const map: Record<string, UserInfo> = {};
      for (const u of (userData as UserInfo[] | null) ?? []) map[u.id] = u;
      setUsers(map);
    }
    setLoading(false);

    // ประวัติดาวน์โหลด — download_logs ผูกกับ entitlement ไม่ได้ผูกกับ order ตรง ๆ
    // จึงต้องเดินผ่าน entitlements ก่อน (admin อ่านได้ทั้งสองตารางผ่าน RLS)
    // โหลดหลังจบ setLoading เพราะเป็นข้อมูลเสริม ไม่ควรถ่วงตารางหลัก
    const orderIds = allOrders.map((o) => o.id);
    if (orderIds.length === 0) return;
    const entRes = await fetchAllRows<{ id: string; order_id: string | null }>(async (from, to) => {
      const { data, error } = await supabase
        .from("entitlements")
        .select("id, order_id")
        .in("order_id", orderIds)
        .range(from, to);
      return { data: data as { id: string; order_id: string | null }[] | null, error };
    });
    const orderOfEnt: Record<string, string> = {};
    for (const e of entRes.rows) if (e.order_id) orderOfEnt[e.id] = e.order_id;
    const entIds = Object.keys(orderOfEnt);
    if (entIds.length === 0) return;

    const logRes = await fetchAllRows<LogRow>(async (from, to) => {
      const { data, error } = await supabase
        .from("download_logs")
        .select("entitlement_id, font_id, file_path, ip, created_at")
        .in("entitlement_id", entIds)
        .order("created_at", { ascending: false })
        .range(from, to);
      return { data: data as LogRow[] | null, error };
    });
    const byOrder: Record<string, LogRow[]> = {};
    for (const l of logRes.rows) {
      const oid = orderOfEnt[l.entitlement_id];
      if (!oid) continue;
      (byOrder[oid] ??= []).push(l);
    }
    setLogsByOrder(byOrder);
  }, []);

  useEffect(() => { load(); }, [load]);

  const designerName = (id: string | null) => {
    if (!id) return "—";
    const u = users[id];
    return u?.business_name ?? u?.name ?? id.slice(0, 8);
  };

  /**
   * ชื่อนักออกแบบของ "รายการหนึ่งบรรทัด" — ต้องดูจาก order_items เพราะใบที่ซื้อ
   * ข้ามร้านจะมี orders.designer_id เป็น null (ของหลายคน) ถ้าดูจากระดับใบจะขึ้น —
   * ใบเก่าก่อนมี order_items ค่อย fallback ไปที่ designer ระดับใบ
   */
  const itemDesignerName = (o: OrderLite, fontId?: string) => {
    const match = (o.order_items ?? []).find((i) => i.font_id === fontId);
    return designerName(match?.designer_id ?? o.designer_id);
  };

  /** ชื่อฟอนต์จาก font_id ที่ log เก็บไว้ — ดูใน order_items ก่อน แล้วค่อย items (ใบเก่า) */
  const logFontName = (o: OrderLite, fontId: string | null) => {
    if (!fontId) return "—";
    const fromItems = (o.order_items ?? []).find((i) => i.font_id === fontId)?.name;
    if (fromItems) return fromItems;
    return (o.items ?? []).find((i) => i.font_id === fontId)?.name ?? "—";
  };

  /**
   * ราคา/ส่วนแบ่งของรายการหนึ่งบรรทัด — ยึด order_items เป็นหลักเพราะเป็นยอดที่
   * บันทึกไว้ ณ เวลาขาย · ใบเก่าก่อนมี order_items ค่อยคำนวณย้อนจากราคาใน items
   * (Retail หัก 25% · ใบจากใบเสนอราคาเงินเข้านักออกแบบเต็ม เว็บไม่หัก)
   */
  const itemShare = (o: OrderLite, fontId?: string, price?: number) => {
    const match = (o.order_items ?? []).find((i) => i.font_id === fontId);
    if (match) {
      return {
        price: match.price,
        designer: match.designer_amount ?? 0,
        platform: match.platform_amount ?? 0,
      };
    }
    const p = price ?? 0;
    if (o.source !== "checkout") return { price: p, designer: p, platform: 0 };
    const platform = Math.round(p * 0.25 * 100) / 100;
    return { price: p, designer: p - platform, platform };
  };

  const retailOrders = useMemo(
    () => orders
      .filter((o) => o.status === "paid" && o.source === "checkout" && orderInPeriod(o, period))
      .sort((a, b) => new Date(b.paid_at ?? b.created_at).getTime() - new Date(a.paid_at ?? a.created_at).getTime()),
    [orders, periodKeyStr] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const periodSubs = useMemo(() => {
    return subs
      .filter((s) => {
        if (period.type === "all") return true;
        const d = new Date(s.created_at);
        const y = d.getFullYear(), m = d.getMonth() + 1;
        return period.type === "year" ? y === period.year : y === period.year && quarterOfMonth(m) === period.quarter;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [subs, periodKeyStr]); // eslint-disable-line react-hooks/exhaustive-deps

  const tabCount = { retail: retailOrders.length, subscription: periodSubs.length };

  return (
    <div className="p-6 max-w-[1200px]">
      <div className="mb-4">
        <h1 className="font-heading text-h2 text-black">Orders</h1>
        <p className="font-body text-body-sm text-grey-600 mt-0.5">รายการคำสั่งซื้อทั้งหมด</p>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 md:w-[420px] gap-3 mb-4">
        {([["retail", "Retail Font"], ["subscription", "Subscription"]] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setTab(key); setOpenId(null); }}
            className={`text-left p-4 border-none cursor-pointer transition-colors duration-150 ease-base ${tab === key ? "bg-page" : "bg-surface hover:bg-grey-200"}`}
          >
            <div className="font-heading text-h2 text-black leading-none mb-1">{tabCount[key]}</div>
            <div className="font-body text-footnote text-grey-600">{label}</div>
          </button>
        ))}
      </div>

      {/* Period filter */}
      <div className="flex items-center gap-2 mb-4">
        <label className="font-body font-bold text-body-sm text-grey-600">ช่วงเวลา</label>
        <select
          value={periodKeyStr}
          onChange={(e) => { setPeriodKeyStr(e.target.value); setOpenId(null); }}
          className="px-3 py-2 h-[38px] bg-surface font-body text-body-sm text-black outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black transition-colors duration-150 ease-base"
        >
          {options.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="bg-surface py-16 flex items-center justify-center font-body text-body-sm text-grey-600">กำลังโหลด…</div>
      ) : tab === "retail" ? (
        <div className="bg-surface overflow-hidden">
          <div className={`${RETAIL_GRID} px-4 py-2.5 bg-page font-heading text-badge text-grey-600 tracking-[0.04em]`}>
            <div>วันที่</div><div>หมายเลขออเดอร์</div><div>ผู้ซื้อ</div><div>ยอดเงิน</div><div>ประวัติดาวน์โหลด</div>
          </div>
          {retailOrders.length === 0 ? (
            <div className="flex items-center justify-center py-12 font-body text-body-sm text-grey-600">ยังไม่มีข้อมูล</div>
          ) : retailOrders.map((o) => {
            const open = openId === o.id;
            return (
              <Fragment key={o.id}>
                <div
                  onClick={() => setOpenId(open ? null : o.id)}
                  className={`${RETAIL_GRID} px-4 py-3 items-center cursor-pointer transition-colors duration-150 ease-base ${open ? "bg-page" : "hover:bg-grey-200"}`}
                >
                  <div className="font-body text-body-sm text-grey-600">{fmtDate(o.paid_at ?? o.created_at)}</div>
                  <div className="font-body text-body-sm text-black">{o.order_no}</div>
                  <div className="font-body text-body-sm text-grey-600 truncate">{o.customer_name || o.customer_email || "—"}</div>
                  <div className="font-ui text-ui text-black">{fmtBaht(o.total_amount)}</div>
                  {/* ทั้งแถวเป็นตัวกาง/หุบรายการฟอนต์ → ปุ่มนี้ต้องกันคลิกทะลุ */}
                  {(logsByOrder[o.id]?.length ?? 0) === 0 ? (
                    <div className="font-body text-body-sm text-grey-600">ยังไม่มีการดาวน์โหลด</div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setLogOrder(o); }}
                      className="font-body text-body-sm link-accent bg-transparent border-none p-0 text-left cursor-pointer hover:underline"
                    >
                      ดูประวัติการดาวน์โหลด ({logsByOrder[o.id].length})
                    </button>
                  )}
                </div>
                {open && (
                  <div className="bg-page px-4 py-3">
                    <div className={`${ITEM_GRID} px-3 pb-1.5 font-heading text-badge text-grey-600 tracking-[0.04em]`}>
                      <div>ฟอนต์</div>
                      <div>ดีไซน์เนอร์</div>
                      <div className="text-right">ราคา</div>
                      <div className="text-right">ส่วนแบ่งดีไซน์เนอร์</div>
                      <div className="text-right">ส่วนแบ่งเว็บ</div>
                    </div>
                    <div className="flex flex-col gap-1">
                      {(o.items ?? []).map((it, i) => {
                        const share = itemShare(o, it.font_id, it.price);
                        return (
                          <div key={i} className={`${ITEM_GRID} font-body text-body-sm bg-surface px-3 py-2`}>
                            <span className="text-black truncate">{it.name}</span>
                            <span className="text-grey-600 truncate">{itemDesignerName(o, it.font_id)}</span>
                            <span className="text-black text-right">{fmtBaht(share.price)}</span>
                            <span className="text-black text-right">{fmtBaht(share.designer)}</span>
                            <span className="text-grey-600 text-right">{fmtBaht(share.platform)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      ) : (
        <div className="bg-surface overflow-hidden">
          <div className={`${SUB_GRID} px-4 py-2.5 bg-page font-heading text-badge text-grey-600 tracking-[0.04em]`}>
            <div>วันที่</div><div>หมายเลข</div><div>สมาชิก</div><div>อีเมล</div><div>วันหมดอายุ</div>
          </div>
          {periodSubs.length === 0 ? (
            <div className="flex items-center justify-center py-12 font-body text-body-sm text-grey-600">ยังไม่มีข้อมูล</div>
          ) : periodSubs.map((s) => {
            const u = users[s.user_id];
            return (
              <div key={s.id} className={`${SUB_GRID} px-4 py-3 items-center`}>
                <div className="font-body text-body-sm text-grey-600">{fmtDate(s.created_at)}</div>
                <div className="font-body text-footnote text-grey-600">{s.id.slice(0, 8)}</div>
                <div className="font-body text-body-sm text-black truncate">{u?.business_name ?? u?.name ?? "—"}</div>
                <div className="font-body text-body-sm text-grey-600 truncate">{u?.email ?? "—"}</div>
                <div className="font-body text-body-sm text-grey-600">{fmtDate(s.current_period_end)}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* ประวัติการดาวน์โหลดของใบเดียว — ทุกครั้งที่กดโหลด (ไฟล์เดิมซ้ำได้) ล่าสุดขึ้นก่อน */}
      <Modal
        open={!!logOrder}
        onClose={() => setLogOrder(null)}
        title={`ประวัติการดาวน์โหลด · ${logOrder?.order_no ?? ""}`}
        className="w-[90vw] max-w-[860px]"
      >
        <div className="p-5 overflow-y-auto max-h-[70vh]">
          <div className={`${LOG_GRID} px-3 pb-1.5 font-heading text-badge text-grey-600 tracking-[0.04em]`}>
            <div>ฟอนต์</div><div>ไฟล์</div><div>วันที่ - เวลา</div><div>IP</div>
          </div>
          <div className="flex flex-col gap-1">
            {(logOrder ? logsByOrder[logOrder.id] ?? [] : []).map((l, i) => (
              <div key={i} className={`${LOG_GRID} font-body text-body-sm bg-surface px-3 py-2`}>
                <span className="text-black truncate">{logFontName(logOrder!, l.font_id)}</span>
                <span className="text-grey-800 truncate">{l.file_path?.split("/").pop() ?? "—"}</span>
                <span className="text-grey-600">{fmtDateTime(l.created_at)}</span>
                <span className="text-grey-600">{l.ip ?? "—"}</span>
              </div>
            ))}
          </div>
          <p className="font-body text-footnote text-grey-600 mt-3">
            บันทึกทุกครั้งที่กดดาวน์โหลด — ไฟล์เดียวกันโหลดซ้ำจะขึ้นหลายบรรทัด ·
            ไม่รวมไฟล์ Demo และฟอนต์ฟรี ซึ่งดาวน์โหลดได้โดยไม่ต้องมีสิทธิ์
          </p>
        </div>
      </Modal>
    </div>
  );
}
