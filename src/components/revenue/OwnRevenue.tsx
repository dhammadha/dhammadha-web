"use client";

// รายได้ของตัวเอง (B2C/B2B) — ใช้ร่วมกันทั้งหน้า designer (/designer/revenue)
// และหน้า admin (/admin/revenue แสดงรายได้ของ admin เอง ถ้ามี order ผูกกับ admin)
// มี month dropdown เลือกดูทีละเดือน (เหมือน SubscriptionRevenue ด้านล่าง)

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { fetchAllRows } from "@/lib/fetch-all";
import SubscriptionRevenue from "@/components/revenue/SubscriptionRevenue";
import {
  buildMonthlyStatements,
  monthLabel,
  fmtBaht,
  type OrderLite,
  type PayoutRow,
  type MonthStatement,
} from "@/lib/revenue";

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

function payoutStatus(stmt: MonthStatement): { label: string; cls: string } {
  if (stmt.payout) {
    return { label: `จ่ายแล้ว · ${fmtDate(stmt.payout.paid_at)}`, cls: "bg-green-50 text-green-600" };
  }
  if (stmt.designerAmount > 0) {
    return { label: "รอโอนจากเว็บ", cls: "bg-amber-50 text-amber-600" };
  }
  return { label: "ไม่มียอดต้องโอน", cls: "bg-[#f5f5f2] text-[#aaa]" };
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
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const months = recentMonths(12);
  const [monthKey, setMonthKey] = useState(months[0].key);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    // fetchAllRows: กันเพดาน 1000 แถว/request ของ PostgREST ตัดยอดเงินขาดเงียบ ๆ
    const [orderRes, payoutRes] = await Promise.all([
      fetchAllRows<OrderLite>(async (from, to) => {
        const { data, error } = await supabase
          .from("orders")
          .select("id, order_no, designer_id, total_amount, status, paid_at, created_at, source, platform_amount, designer_amount, items")
          .eq("designer_id", user.id)
          .order("created_at", { ascending: false })
          .range(from, to);
        return { data: data as unknown as OrderLite[] | null, error };
      }),
      fetchAllRows<PayoutRow>((from, to) =>
        supabase.from("payouts").select("*").eq("designer_id", user.id).order("created_at").range(from, to)
      ),
    ]);
    setOrders(orderRes.rows);
    setPayouts(payoutRes.rows);
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
    <div className="p-6 max-w-[900px]">
      <div className="mb-1">
        <h1 className="text-[20px] font-semibold text-navy">รายได้</h1>
        <p className="text-[13px] text-[#aaa] mt-0.5">สรุปยอดขายและรายได้รายเดือน</p>
      </div>

      {/* Month selector */}
      <div className="flex items-center gap-2 mt-4 mb-4">
        <label className="text-[12px] font-medium text-[#666]">เดือน</label>
        <select
          value={monthKey}
          onChange={(e) => setMonthKey(e.target.value)}
          className="px-3 py-2 h-[36px] rounded-xl border border-border bg-[#fafaf8] text-[13px] text-navy outline-none focus:border-mint transition-all font-[inherit]"
        >
          {months.map((m) => (
            <option key={m.key} value={m.key}>{monthLabel(m.year, m.month)}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-border flex items-center justify-center py-12 text-[#aaa] text-[14px]">
          กำลังโหลด…
        </div>
      ) : statements.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border p-12 flex flex-col items-center justify-center text-center gap-3">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="text-[#ddd]">
            <path d="M5 30l8-10 8 6 8-14 8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5 35h30" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <div className="text-[15px] font-medium text-navy">ยังไม่มีรายได้</div>
          <div className="text-[13px] text-[#aaa] max-w-[380px] leading-relaxed">
            รายได้จะเริ่มแสดงที่นี่เมื่อมีลูกค้าซื้อฟอนต์ของคุณผ่านหน้าเว็บ (B2C) หรือปิดงานผ่านใบเสนอราคา (B2B)
          </div>
        </div>
      ) : !stmt ? (
        <div className="bg-white rounded-2xl border border-border p-12 flex flex-col items-center justify-center text-center gap-3">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="text-[#ddd]">
            <path d="M5 30l8-10 8 6 8-14 8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5 35h30" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <div className="text-[15px] font-medium text-navy">ยังไม่มีข้อมูลรายได้ในเดือนนี้</div>
        </div>
      ) : (
        <>
          {/* Stat tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-white rounded-2xl border border-border p-4">
              <div className="text-[22px] font-semibold leading-none mb-1 text-navy">{fmtBaht(stmt.b2cTotal)}</div>
              <div className="text-[12px] text-[#aaa]">ยอดขายผ่านเว็บ</div>
            </div>
            <div className="bg-white rounded-2xl border border-border p-4">
              <div className="text-[22px] font-semibold leading-none mb-1 text-mint">{fmtBaht(stmt.designerAmount)}</div>
              <div className="text-[12px] text-[#aaa]">ส่วนแบ่งที่จะได้รับ (75%)</div>
            </div>
            <div className="bg-white rounded-2xl border border-border p-4">
              <div className="text-[22px] font-semibold leading-none mb-1 text-navy">{fmtBaht(stmt.b2bTotal)}</div>
              <div className="text-[12px] text-[#aaa]">ยอด B2B (รับตรง)</div>
            </div>
            <div className="bg-white rounded-2xl border border-border p-4">
              {status ? (
                <span className={`inline-block text-[11px] px-2 py-1 rounded-full font-medium ${status.cls}`}>{status.label}</span>
              ) : (
                <span className="text-[13px] text-[#ccc]">—</span>
              )}
              <div className="text-[12px] text-[#aaa] mt-1.5">สถานะเดือนนี้</div>
            </div>
          </div>

          {/* Selected month statement */}
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div
              onClick={() => toggle(stmt.key)}
              className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-[#fafaf8] transition-colors"
            >
              <div className="flex items-center gap-3">
                <svg
                  width="10" height="10" viewBox="0 0 10 10" fill="none"
                  className={`text-[#bbb] transition-transform ${isOpen ? "rotate-90" : ""}`}
                >
                  <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div className="text-[14px] font-semibold text-navy">{monthLabel(stmt.year, stmt.month)}</div>
              </div>
              {status && <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${status.cls}`}>{status.label}</span>}
            </div>

            <div className="grid grid-cols-2 gap-3 px-5 pb-4">
              <div className="bg-[#f8f8f6] rounded-xl p-3">
                <div className="text-[11px] text-[#aaa] mb-1">ขายผ่านเว็บ (B2C) · {stmt.b2cCount} ออเดอร์</div>
                <div className="text-[15px] font-semibold text-navy">{fmtBaht(stmt.b2cTotal)}</div>
                <div className="text-[11px] text-mint mt-0.5">ส่วนแบ่งของคุณ {fmtBaht(stmt.designerAmount)}</div>
              </div>
              <div className="bg-[#f8f8f6] rounded-xl p-3">
                <div className="text-[11px] text-[#aaa] mb-1">B2B · {stmt.b2bCount} ออเดอร์</div>
                <div className="text-[15px] font-semibold text-navy">{fmtBaht(stmt.b2bTotal)}</div>
              </div>
            </div>

            {stmt.payout?.note && (
              <div className="px-5 pb-4 -mt-2 text-[11px] text-[#888]">หมายเหตุการโอน: {stmt.payout.note}</div>
            )}

            {isOpen && (
              <div className="border-t border-border">
                <div className="grid grid-cols-[90px_1fr_1fr_100px_90px] gap-3 px-5 py-2 bg-[#f8f8f6] text-[11px] font-semibold text-[#aaa] tracking-[0.04em]">
                  <div>วันที่</div><div>เลขที่ออเดอร์</div><div>ฟอนต์</div><div>ยอด</div><div>ประเภท</div>
                </div>
                {stmt.orders.map((o) => (
                  <div key={o.id} className="grid grid-cols-[90px_1fr_1fr_100px_90px] gap-3 px-5 py-2.5 border-b border-[#f8f8f8] last:border-0 items-center">
                    <div className="text-[12px] text-[#888]">{fmtDate(o.paid_at ?? o.created_at)}</div>
                    <div className="text-[12px] text-navy font-medium truncate">{o.order_no}</div>
                    <div className="text-[12px] text-[#666] truncate">
                      {(o.items ?? []).map((it) => it.name).filter(Boolean).join(", ") || "—"}
                    </div>
                    <div className="text-[12px] font-medium text-navy">{fmtBaht(o.total_amount)}</div>
                    <div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${o.source === "checkout" ? "bg-green-50 text-green-600" : "bg-blue-50 text-blue-600"}`}>
                        {o.source === "checkout" ? "ขายผ่านเว็บ" : "B2B"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <SubscriptionRevenue mode="designer" />
    </div>
  );
}
