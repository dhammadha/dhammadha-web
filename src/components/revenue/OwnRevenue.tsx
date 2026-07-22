"use client";

// รายได้ของตัวเอง (B2C/B2B) — ใช้ร่วมกันทั้งหน้า designer (/designer/revenue)
// และหน้า admin (/admin/revenue แสดงรายได้ของ admin เอง ถ้ามี order ผูกกับ admin)
// มี month dropdown เลือกดูทีละเดือน (เหมือน SubscriptionRevenue ด้านล่าง)

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { fetchAllRows } from "@/lib/fetch-all";
import SubscriptionRevenue from "@/components/revenue/SubscriptionRevenue";
import { licenseLabel, parseDesignerTiers, type LicenseTier } from "@/lib/license";
import {
  buildMonthlyStatements,
  monthLabel,
  fmtBaht,
  type OrderLite,
  type PayoutRow,
  type MonthStatement,
} from "@/lib/revenue";

// คอลัมน์ตารางออเดอร์ — หัวตารางกับแถวต้องใช้ template เดียวกันเสมอ (ช่องแรก = chevron)
const ORDER_GRID = "grid grid-cols-[10px_90px_1fr_1fr_100px_90px] gap-3";

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

// B2B เงินเข้า designer ตรงในนามบริษัท → ชื่อบริษัทคือตัวระบุหลัก ส่วน B2C ซื้อในนามบุคคล
function buyerName(o: OrderLite): string {
  return (o.source === "checkout"
    ? o.customer_name ?? o.company_name
    : o.company_name ?? o.customer_name) ?? "";
}

function payoutStatus(stmt: MonthStatement): { label: string; cls: string } {
  if (stmt.payout) {
    return { label: `จ่ายแล้ว · ${fmtDate(stmt.payout.paid_at)}`, cls: "bg-success text-white" };
  }
  if (stmt.designerAmount > 0) {
    return { label: "รอโอนจากเว็บ", cls: "bg-warning text-black" };
  }
  return { label: "ไม่มียอดต้องโอน", cls: "bg-surface text-grey-600" };
}

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

export default function OwnRevenue() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderLite[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [customTiers, setCustomTiers] = useState<LicenseTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const months = recentMonths(12);
  const [monthKey, setMonthKey] = useState(months[0].key);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    // fetchAllRows: กันเพดาน 1000 แถว/request ของ PostgREST ตัดยอดเงินขาดเงียบ ๆ
    const [orderRes, payoutRes, licRes] = await Promise.all([
      fetchAllRows<OrderLite>(async (from, to) => {
        const { data, error } = await supabase
          .from("orders")
          .select("id, order_no, designer_id, total_amount, status, paid_at, created_at, source, platform_amount, designer_amount, items, customer_name, customer_email, company_name")
          .eq("designer_id", user.id)
          .order("created_at", { ascending: false })
          .range(from, to);
        return { data: data as unknown as OrderLite[] | null, error };
      }),
      fetchAllRows<PayoutRow>((from, to) =>
        supabase.from("payouts").select("*").eq("designer_id", user.id).order("created_at").range(from, to)
      ),
      supabase.from("designer_license_config").select("*").eq("designer_id", user.id).maybeSingle(),
    ]);
    setOrders(orderRes.rows);
    setPayouts(payoutRes.rows);
    setCustomTiers(licRes.data && !licRes.data.use_default ? parseDesignerTiers(licRes.data.tiers) : []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const statements = useMemo(() => buildMonthlyStatements(orders, payouts), [orders, payouts]);

  const stmt = statements.find((s) => s.key === monthKey) ?? null;

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const status = stmt ? payoutStatus(stmt) : null;
  const isOpen = stmt ? expanded.has(stmt.key) : false;

  return (
    <div className="p-6 max-w-[1200px]">
      <div className="mb-1">
        <h1 className="font-heading text-h2 text-black">รายได้</h1>
        <p className="font-body text-body-sm text-grey-600 mt-0.5">สรุปยอดขายและรายได้รายเดือน</p>
      </div>

      {/* Month selector */}
      <div className="flex items-center gap-2 mt-4 mb-4">
        <label className="font-body text-body-sm text-grey-600">เดือน</label>
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

      {loading ? (
        <div className="bg-surface flex items-center justify-center py-12 font-body text-body-sm text-grey-600">
          กำลังโหลด…
        </div>
      ) : statements.length === 0 ? (
        <div className="bg-surface p-12 flex flex-col items-center justify-center text-center gap-3">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="text-grey-400">
            <path d="M5 30l8-10 8 6 8-14 8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5 35h30" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <div className="font-ui text-ui text-black">ยังไม่มีรายได้</div>
          <div className="font-body text-body-sm text-grey-600 max-w-[380px] leading-relaxed">
            รายได้จะเริ่มแสดงที่นี่เมื่อมีลูกค้าซื้อฟอนต์ของคุณผ่านหน้าเว็บ (B2C) หรือปิดงานผ่านใบเสนอราคา (B2B)
          </div>
        </div>
      ) : !stmt ? (
        <div className="bg-surface p-12 flex flex-col items-center justify-center text-center gap-3">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="text-grey-400">
            <path d="M5 30l8-10 8 6 8-14 8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5 35h30" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <div className="font-ui text-ui text-black">ยังไม่มีข้อมูลรายได้ในเดือนนี้</div>
        </div>
      ) : (
        <>
          {/* Stat tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-surface p-4">
              <div className="font-heading text-h2 text-black leading-none mb-1">{fmtBaht(stmt.b2cTotal)}</div>
              <div className="font-body text-footnote text-grey-600">ยอดขายผ่านเว็บ</div>
            </div>
            <div className="bg-surface p-4">
              <div className="font-heading text-h2 text-mint-text leading-none mb-1">{fmtBaht(stmt.designerAmount)}</div>
              <div className="font-body text-footnote text-grey-600">ส่วนแบ่งที่จะได้รับ (75%)</div>
            </div>
            <div className="bg-surface p-4">
              <div className="font-heading text-h2 text-black leading-none mb-1">{fmtBaht(stmt.b2bTotal)}</div>
              <div className="font-body text-footnote text-grey-600">ยอด B2B (รับตรง)</div>
            </div>
            <div className="bg-surface p-4">
              {status ? (
                <span className={`inline-block text-badge font-heading px-2 py-1 ${status.cls}`}>{status.label}</span>
              ) : (
                <span className="font-body text-body-sm text-grey-600">—</span>
              )}
              <div className="font-body text-footnote text-grey-600 mt-1.5">สถานะเดือนนี้</div>
            </div>
          </div>

          {/* Selected month statement */}
          <div className="bg-surface overflow-hidden">
            <div
              onClick={() => toggle(stmt.key)}
              className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-grey-200 transition-colors duration-150 ease-base"
            >
              <div className="flex items-center gap-3">
                <svg
                  width="10" height="10" viewBox="0 0 10 10" fill="none"
                  className={`text-grey-400 transition-transform duration-150 ease-base ${isOpen ? "rotate-90" : ""}`}
                >
                  <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div className="font-ui text-ui text-black">{monthLabel(stmt.year, stmt.month)}</div>
              </div>
              {status && <span className={`text-badge font-heading px-2.5 py-1 ${status.cls}`}>{status.label}</span>}
            </div>

            <div className="grid grid-cols-2 gap-3 px-5 pb-4">
              <div className="bg-white p-3">
                <div className="font-body text-footnote text-grey-600 mb-1">ขายผ่านเว็บ (B2C) · {stmt.b2cCount} ออเดอร์</div>
                <div className="font-ui text-ui text-black">{fmtBaht(stmt.b2cTotal)}</div>
                <div className="font-body text-footnote text-mint-text mt-0.5">ส่วนแบ่งของคุณ {fmtBaht(stmt.designerAmount)}</div>
              </div>
              <div className="bg-white p-3">
                <div className="font-body text-footnote text-grey-600 mb-1">B2B · {stmt.b2bCount} ออเดอร์</div>
                <div className="font-ui text-ui text-black">{fmtBaht(stmt.b2bTotal)}</div>
              </div>
            </div>

            {stmt.payout?.note && (
              <div className="px-5 pb-4 -mt-2 font-body text-footnote text-grey-600">หมายเหตุการโอน: {stmt.payout.note}</div>
            )}

            {isOpen && (
              <div>
                <div className={`${ORDER_GRID} px-5 py-2 bg-white font-heading text-badge text-grey-600 tracking-[0.04em]`}>
                  <div /><div>วันที่</div><div>เลขที่ออเดอร์</div><div>ฟอนต์</div><div>ยอด</div><div>ประเภท</div>
                </div>
                {stmt.orders.map((o) => {
                  const orderOpen = expanded.has(o.id);
                  const items = (o.items ?? []).filter((it) => it.name);
                  return (
                    <div key={o.id}>
                      <div
                        onClick={() => toggle(o.id)}
                        className={`${ORDER_GRID} px-5 py-2.5 items-center cursor-pointer hover:bg-grey-200 transition-colors duration-150 ease-base`}
                      >
                        <svg
                          width="10" height="10" viewBox="0 0 10 10" fill="none"
                          className={`text-grey-400 transition-transform duration-150 ease-base ${orderOpen ? "rotate-90" : ""}`}
                        >
                          <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <div className="font-body text-footnote text-grey-600">{fmtDate(o.paid_at ?? o.created_at)}</div>
                        <div className="font-body text-footnote text-black truncate">{o.order_no}</div>
                        <div className="font-body text-footnote text-grey-600 truncate">
                          {items.map((it) => it.name).join(", ") || "—"}
                        </div>
                        <div className="font-body text-footnote text-black">{fmtBaht(o.total_amount)}</div>
                        <div>
                          <span className={`text-badge font-heading px-1.5 py-0.5 ${o.source === "checkout" ? "bg-mint text-black" : "bg-surface text-grey-600"}`}>
                            {o.source === "checkout" ? "ขายผ่านเว็บ" : "B2B"}
                          </span>
                        </div>
                      </div>

                      {orderOpen && (
                        <div className="bg-grey-200 px-5 py-3 pl-[38px] grid gap-2 font-body text-footnote">
                          <div className="flex gap-2">
                            <span className="text-grey-600 w-[70px] shrink-0">ผู้ซื้อ</span>
                            <span className="text-black">{buyerName(o) || "—"}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-grey-600 w-[70px] shrink-0">อีเมล</span>
                            <span className="text-black break-all">{o.customer_email || "—"}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-grey-600 w-[70px] shrink-0">License</span>
                            <span className="text-black">
                              {items.length ? (
                                items.map((it, i) => (
                                  <div key={i}>
                                    {it.name} · {licenseLabel(it.license_type, customTiers) || "—"}
                                  </div>
                                ))
                              ) : (
                                "—"
                              )}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      <SubscriptionRevenue mode="designer" />
    </div>
  );
}
