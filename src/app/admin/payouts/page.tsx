"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import Button from "@/components/Button";
import { fetchAllRows } from "@/lib/fetch-all";
import SubscriptionRevenue from "@/components/revenue/SubscriptionRevenue";
import {
  buildMonthlyStatements,
  groupOrdersByDesigner,
  monthLabel,
  fmtBaht,
  type OrderLite,
  type PayoutRow,
  type MonthStatement,
} from "@/lib/revenue";

type BankInfo = { bank_name?: string; branch?: string; account_name?: string; account_number?: string };

type DesignerInfo = {
  id: string;
  name: string | null;
  business_name: string | null;
  designer_slug: string | null;
  bank: BankInfo | null;
};

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

function fmtDateFull(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
}

function displayName(d: DesignerInfo | undefined, fallbackId: string) {
  if (fallbackId === STUDIO_KEY) return "สตูดิโอ (ไม่ระบุ designer)";
  if (!d) return fallbackId;
  return d.business_name ?? d.name ?? fallbackId;
}

// order ที่ designer_id เป็น null (เช่น quote ที่ admin สร้างเองโดยไม่ผูก designer
// หรือฟอนต์ที่ owner_id หาย) — ไม่มีใครให้โอน แต่ยอดต้องไม่หายจากหน้ารายงาน
const STUDIO_KEY = "__studio__";

const ORDERS_SELECT =
  "id, order_no, designer_id, total_amount, status, paid_at, created_at, source, platform_amount, designer_amount, items";

export default function AdminPayoutsPage() {
  const [orders, setOrders] = useState<OrderLite[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [designers, setDesigners] = useState<Record<string, DesignerInfo>>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [selectedDesignerId, setSelectedDesignerId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [saving, setSaving] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const loadAll = useCallback(async () => {
    setLoading(true);
    // fetchAllRows: กันเพดาน 1000 แถว/request ของ PostgREST ตัดยอดเงินขาดเงียบ ๆ
    const [orderRes, payoutRes, { data: designerData }] = await Promise.all([
      fetchAllRows<OrderLite>(async (from, to) => {
        const { data, error } = await supabase
          .from("orders")
          .select(ORDERS_SELECT)
          .order("created_at", { ascending: false })
          .range(from, to);
        return { data: data as unknown as OrderLite[] | null, error };
      }),
      fetchAllRows<PayoutRow>((from, to) =>
        supabase.from("payouts").select("*").order("created_at").range(from, to)
      ),
      supabase.from("users").select("id, name, business_name, designer_slug, bank").eq("role", "designer"),
    ]);

    if (orderRes.error || payoutRes.error) {
      const err = (orderRes.error ?? payoutRes.error) as { message?: string } | null;
      showToast("โหลดข้อมูลไม่สำเร็จ: " + (err?.message ?? "unknown error"));
      setLoading(false);
      return;
    }

    const allOrders = orderRes.rows;
    const allPayouts = payoutRes.rows;
    const designerMap: Record<string, DesignerInfo> = {};
    for (const d of (designerData as unknown as DesignerInfo[]) ?? []) {
      designerMap[d.id] = { ...d, bank: (d.bank as unknown as BankInfo) ?? null };
    }

    // orders/payouts belonging to a designer_id not in the designer list (e.g. admin's
    // own storefront orders, or a payout for a user later demoted) —
    // fetch those users rows individually so every statement row still has a display name.
    const missingIds = Array.from(
      new Set(
        [...allOrders.map((o) => o.designer_id), ...allPayouts.map((p) => p.designer_id)]
          .filter((id): id is string => !!id && !designerMap[id])
      )
    );
    if (missingIds.length > 0) {
      const { data: fallbackUsers } = await supabase
        .from("users")
        .select("id, name, business_name, designer_slug, bank")
        .in("id", missingIds);
      for (const d of (fallbackUsers as unknown as DesignerInfo[]) ?? []) {
        designerMap[d.id] = { ...d, bank: (d.bank as unknown as BankInfo) ?? null };
      }
    }

    setOrders(allOrders);
    setPayouts(allPayouts);
    setDesigners(designerMap);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // statements per designer, built only from that designer's own orders + payouts (per lib contract)
  const statementsByDesigner = useMemo(() => {
    const grouped = groupOrdersByDesigner(orders);
    const map = new Map<string, MonthStatement[]>();
    for (const [designerId, designerOrders] of grouped) {
      const designerPayouts = payouts.filter((p) => p.designer_id === designerId);
      map.set(designerId, buildMonthlyStatements(designerOrders, designerPayouts));
    }
    // designer ที่มี payout บันทึกไว้แต่ไม่มี order paid เหลืออยู่เลย (เช่น order
    // ถูกยกเลิกทีหลัง) — ยังต้องเห็นและยกเลิกการบันทึกได้ ไม่งั้นค้างใน DB ตลอด
    for (const p of payouts) {
      if (!map.has(p.designer_id)) {
        map.set(
          p.designer_id,
          buildMonthlyStatements([], payouts.filter((x) => x.designer_id === p.designer_id))
        );
      }
    }
    // ยอดของ order ที่ไม่ผูก designer (ยอดสตูดิโอเอง) — โชว์เป็นแถวแยก ไม่มี payout
    const studioOrders = orders.filter((o) => !o.designer_id);
    if (studioOrders.length > 0) {
      map.set(STUDIO_KEY, buildMonthlyStatements(studioOrders, []));
    }
    return map;
  }, [orders, payouts]);

  // union of all month keys that have any data, newest first
  const monthKeys = useMemo(() => {
    const keys = new Map<string, { year: number; month: number }>();
    for (const statements of statementsByDesigner.values()) {
      for (const s of statements) keys.set(s.key, { year: s.year, month: s.month });
    }
    return Array.from(keys.entries())
      .sort((a, b) => (a[1].year !== b[1].year ? b[1].year - a[1].year : b[1].month - a[1].month))
      .map(([key, ym]) => ({ key, ...ym }));
  }, [statementsByDesigner]);

  useEffect(() => {
    if (!selectedMonthKey && monthKeys.length > 0) setSelectedMonthKey(monthKeys[0].key);
  }, [monthKeys, selectedMonthKey]);

  // current-month stat tiles across all designers
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentStats = useMemo(() => {
    let b2cTotal = 0, platformAmount = 0, pendingDesignerAmount = 0, b2bTotal = 0;
    for (const [designerId, statements] of statementsByDesigner) {
      const s = statements.find((st) => st.year === currentYear && st.month === currentMonth);
      if (!s) continue;
      b2cTotal += s.b2cTotal;
      platformAmount += s.platformAmount;
      b2bTotal += s.b2bTotal;
      // "ค้างโอน" = เฉพาะเดือนที่ยังไม่บันทึกจ่าย และไม่นับยอดสตูดิโอ (ไม่มีใครให้โอน)
      if (designerId !== STUDIO_KEY && !s.payout) pendingDesignerAmount += s.designerAmount;
    }
    return { b2cTotal, platformAmount, pendingDesignerAmount, b2bTotal };
  }, [statementsByDesigner, currentYear, currentMonth]);

  // rows for the selected month
  type Row = { designerId: string; statement: MonthStatement };
  const monthRows: Row[] = useMemo(() => {
    if (!selectedMonthKey) return [];
    const rows: Row[] = [];
    for (const [designerId, statements] of statementsByDesigner) {
      const s = statements.find((st) => st.key === selectedMonthKey);
      // รวมเดือนที่มี payout บันทึกไว้ด้วยแม้ยอดเป็นศูนย์ — ไม่งั้น payout กำพร้า
      // (order ถูกยกเลิกหลังบันทึกจ่าย) จะมองไม่เห็น/ยกเลิกไม่ได้จากหน้านี้
      if (s && (s.b2cTotal > 0 || s.b2bTotal > 0 || s.payout)) rows.push({ designerId, statement: s });
    }
    return rows;
  }, [statementsByDesigner, selectedMonthKey]);

  const selectedRow = monthRows.find((r) => r.designerId === selectedDesignerId) ?? null;

  useEffect(() => {
    if (selectedRow) {
      setPayAmount(String(selectedRow.statement.designerAmount || ""));
      setPayNote("");
    }
  }, [selectedRow?.designerId, selectedRow?.statement.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const markPaid = async () => {
    if (!selectedRow) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) { showToast("กรุณาระบุจำนวนเงิน"); return; }
    setSaving(true);
    const { error } = await supabase.from("payouts").insert({
      designer_id: selectedRow.designerId,
      period_year: selectedRow.statement.year,
      period_month: selectedRow.statement.month,
      amount,
      note: payNote || null,
    } as never);
    setSaving(false);
    if (error) {
      if (error.code === "23505") {
        showToast("มีการบันทึกไปแล้ว");
      } else {
        showToast("บันทึกไม่สำเร็จ: " + error.message);
      }
      loadAll();
      return;
    }
    showToast("✓ บันทึกจ่ายแล้ว");
    loadAll();
  };

  const unmarkPaid = async () => {
    if (!selectedRow?.statement.payout) return;
    if (!confirm("ยกเลิกการบันทึกว่าจ่ายแล้ว?")) return;
    const { error } = await supabase.from("payouts").delete().eq("id", selectedRow.statement.payout.id);
    showToast(error ? "ยกเลิกไม่สำเร็จ: " + error.message : "ยกเลิกแล้ว");
    loadAll();
  };

  const selectedDesigner = selectedRow ? designers[selectedRow.designerId] : undefined;
  const isStudio = selectedRow?.designerId === STUDIO_KEY;
  const bank = selectedDesigner?.bank;
  const hasBank = !!(bank && (bank.bank_name || bank.account_number));

  return (
    <div className="p-6 max-w-[1200px]">
      <div className="mb-6">
        <h1 className="text-[20px] font-semibold text-navy">Payouts / จ่ายส่วนแบ่ง</h1>
        <p className="text-[13px] text-[#aaa] mt-0.5">สรุปยอดขายและรายได้แบ่งปันนักออกแบบ</p>
      </div>

      {/* Stat tiles — current month, all designers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatTile label={`ยอดขาย B2C (${monthLabel(currentYear, currentMonth)})`} value={fmtBaht(currentStats.b2cTotal)} />
        <StatTile label="รายได้ของเว็บ" value={fmtBaht(currentStats.platformAmount)} />
        <StatTile label="ค้างโอนให้ designer" value={fmtBaht(currentStats.pendingDesignerAmount)} highlight />
        <StatTile label="ยอด B2B (รับตรง)" value={fmtBaht(currentStats.b2bTotal)} />
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-border py-16 flex items-center justify-center text-[#aaa] text-[14px]">
          กำลังโหลด…
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border p-12 flex flex-col items-center justify-center text-center gap-3">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="text-[#ddd]">
            <path d="M5 30l8-10 8 6 8-14 8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 35h30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div className="text-[15px] font-medium text-navy">ยังไม่มีคำสั่งซื้อ</div>
          <div className="text-[13px] text-[#aaa] max-w-[380px] leading-relaxed">
            เมื่อมีออเดอร์เข้ามา สรุปรายได้และรายการที่ต้องโอนให้ designer จะแสดงที่นี่
          </div>
        </div>
      ) : (
        <>
          {/* Month selector */}
          <div className="flex items-center gap-2 mb-4">
            <label className="text-[12px] font-medium text-[#666]">เดือน</label>
            <select
              value={selectedMonthKey ?? ""}
              onChange={(e) => { setSelectedMonthKey(e.target.value); setSelectedDesignerId(null); }}
              className="px-3 py-2 h-[38px] rounded-xl border border-border bg-[#fafaf8] text-[13px] text-navy outline-none focus:border-mint focus:shadow-[0_0_0_3px_#5ECEC820] transition-all font-[inherit]"
            >
              {monthKeys.map((m) => (
                <option key={m.key} value={m.key}>{monthLabel(m.year, m.month)}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-4 items-start">
            {/* Designer rows for selected month */}
            <div className="flex-1 bg-white rounded-2xl border border-border overflow-hidden">
              <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_70px_110px] gap-3 px-4 py-2.5 bg-[#f8f8f6] text-[11px] font-semibold text-[#aaa] tracking-[0.04em] border-b border-border">
                <div>Designer</div><div>ยอด B2C</div><div>ส่วนแบ่ง designer</div><div>ยอด B2B</div><div>Orders</div><div>สถานะ</div>
              </div>

              {monthRows.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-[#aaa] text-[14px]">ไม่มีข้อมูลในเดือนนี้</div>
              ) : (
                monthRows.map(({ designerId, statement }) => {
                  const d = designers[designerId];
                  const paid = !!statement.payout;
                  const pendingPayout = !paid && statement.designerAmount > 0 && designerId !== STUDIO_KEY;
                  return (
                    <div
                      key={designerId}
                      onClick={() => setSelectedDesignerId(selectedDesignerId === designerId ? null : designerId)}
                      className={`grid grid-cols-[1.4fr_1fr_1fr_1fr_70px_110px] gap-3 px-4 py-3 border-b border-[#f8f8f8] last:border-0 cursor-pointer transition-colors items-center ${selectedDesignerId === designerId ? "bg-mint-light" : "hover:bg-[#fafaf8]"}`}
                    >
                      <div className="text-[13px] text-navy font-medium truncate">{displayName(d, designerId)}</div>
                      <div className="text-[13px] text-[#555]">{fmtBaht(statement.b2cTotal)}</div>
                      <div className="text-[13px] text-navy font-medium">{fmtBaht(statement.designerAmount)}</div>
                      <div className="text-[13px] text-[#555]">{fmtBaht(statement.b2bTotal)}</div>
                      <div className="text-[12px] text-[#888]">{statement.b2cCount + statement.b2bCount}</div>
                      <div>
                        {paid ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">
                            จ่ายแล้ว {statement.payout ? fmtDate(statement.payout.paid_at) : ""}
                          </span>
                        ) : pendingPayout ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">รอโอน</span>
                        ) : (
                          <span className="text-[10px] text-[#ddd]">—</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Detail panel */}
            {selectedRow && (
              <div className="w-[320px] flex-shrink-0 bg-white rounded-2xl border border-border p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <h3 className="text-[15px] font-semibold text-navy">{displayName(selectedDesigner, selectedRow.designerId)}</h3>
                  <button onClick={() => setSelectedDesignerId(null)} className="text-[#aaa] hover:text-navy bg-transparent border-none cursor-pointer text-lg leading-none">✕</button>
                </div>
                <p className="text-[12px] text-[#aaa] -mt-3">{monthLabel(selectedRow.statement.year, selectedRow.statement.month)}</p>

                {/* Bank info — ไม่โชว์สำหรับยอดสตูดิโอ (ไม่มีการโอน) */}
                {!isStudio && (
                <div>
                  <div className="text-[11px] font-semibold text-[#aaa] uppercase tracking-wide mb-1.5">บัญชีธนาคาร (สำหรับโอน)</div>
                  {hasBank ? (
                    <div className="flex flex-col gap-1 text-[13px] bg-[#f8f8f6] rounded-xl px-3 py-2.5">
                      <Row label="ธนาคาร" value={bank?.bank_name} />
                      <Row label="สาขา" value={bank?.branch} />
                      <Row label="ชื่อบัญชี" value={bank?.account_name} />
                      <Row label="เลขที่บัญชี" value={bank?.account_number} />
                    </div>
                  ) : (
                    <div className="text-[12px] text-amber-600 bg-amber-50 rounded-xl px-3 py-2.5">
                      ⚠️ designer ยังไม่กรอกบัญชีธนาคาร
                    </div>
                  )}
                </div>
                )}

                {/* Breakdown */}
                <div className="flex flex-col gap-1.5 text-[13px] border-t border-border pt-3">
                  <Row label="ยอดขาย B2C" value={fmtBaht(selectedRow.statement.b2cTotal)} />
                  <Row label="รายได้ของเว็บ" value={fmtBaht(selectedRow.statement.platformAmount)} />
                  <Row label="ส่วนแบ่ง designer" value={fmtBaht(selectedRow.statement.designerAmount)} />
                  <Row label="ยอด B2B (รับตรง)" value={fmtBaht(selectedRow.statement.b2bTotal)} />
                </div>

                {/* Orders list */}
                <div className="border-t border-border pt-3">
                  <div className="text-[11px] font-semibold text-[#aaa] uppercase tracking-wide mb-1.5">ออเดอร์</div>
                  <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto">
                    {selectedRow.statement.orders.map((o) => (
                      <div key={o.id} className="text-[12px] bg-[#f8f8f6] rounded-lg px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-navy font-medium truncate">{o.order_no}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${o.source === "checkout" ? "bg-mint-light text-[#0a8a84]" : "bg-[#eee] text-[#888]"}`}>
                            {o.source === "checkout" ? "B2C" : "B2B"}
                          </span>
                        </div>
                        <div className="text-[#aaa] text-[11px] mt-0.5">{fmtDate(o.paid_at ?? o.created_at)}</div>
                        <div className="text-[#666] truncate mt-0.5">{(o.items ?? []).map((it) => it.name).join(", ") || "—"}</div>
                        <div className="text-navy font-medium mt-0.5">{fmtBaht(o.total_amount)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payout action */}
                <div className="border-t border-border pt-3 flex flex-col gap-2">
                  {isStudio ? (
                    <div className="text-[12px] text-[#aaa]">ยอดของสตูดิโอเอง (order ไม่ผูก designer) — ไม่มีการโอนส่วนแบ่ง</div>
                  ) : selectedRow.statement.payout ? (
                    <>
                      <div className="text-[13px] text-green-600 bg-green-50 rounded-lg px-3 py-2 flex flex-col gap-0.5">
                        <span>✓ จ่ายแล้ว {fmtBaht(selectedRow.statement.payout.amount)}</span>
                        <span className="text-[11px] text-green-700">{fmtDateFull(selectedRow.statement.payout.paid_at)}</span>
                        {selectedRow.statement.payout.note && (
                          <span className="text-[11px] text-green-700">โน้ต: {selectedRow.statement.payout.note}</span>
                        )}
                      </div>
                      <button onClick={unmarkPaid} className="text-[12px] text-[#aaa] hover:text-red-500 bg-transparent border-none cursor-pointer transition-colors self-start">
                        ยกเลิกการบันทึก
                      </button>
                    </>
                  ) : selectedRow.statement.designerAmount > 0 ? (
                    <>
                      <label className="text-[12px] font-medium text-[#666]">จำนวนเงินที่โอน</label>
                      <input
                        type="number"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        className="w-full px-3 py-2 h-[38px] rounded-xl border border-border bg-[#fafaf8] text-[13px] text-navy outline-none focus:border-mint focus:shadow-[0_0_0_3px_#5ECEC820] transition-all font-[inherit]"
                      />
                      <label className="text-[12px] font-medium text-[#666]">โน้ต / เลขอ้างอิง (ถ้ามี)</label>
                      <input
                        value={payNote}
                        onChange={(e) => setPayNote(e.target.value)}
                        className="w-full px-3 py-2 h-[38px] rounded-xl border border-border bg-[#fafaf8] text-[13px] text-navy outline-none focus:border-mint focus:shadow-[0_0_0_3px_#5ECEC820] transition-all font-[inherit]"
                      />
                      <Button onClick={markPaid} disabled={saving} className="w-full mt-1">
                        {saving ? "กำลังบันทึก…" : "บันทึกจ่ายแล้ว"}
                      </Button>
                    </>
                  ) : (
                    <div className="text-[12px] text-[#aaa]">เดือนนี้มีเฉพาะยอด B2B (รับเงินตรงกับ designer) — ไม่มีรายการต้องโอน</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <SubscriptionRevenue mode="admin" />

      {toast && (
        <div className="fixed bottom-6 right-6 z-[190] px-4 py-3 rounded-xl bg-navy text-white text-[13px] font-medium shadow-lg">{toast}</div>
      )}
    </div>
  );
}

function StatTile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-border p-4">
      <div className={`text-[22px] font-semibold leading-none mb-1 ${highlight ? "text-mint" : "text-navy"}`}>{value}</div>
      <div className="text-[12px] text-[#aaa]">{label}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-[#aaa]">{label}: </span>
      <span className="text-navy">{value}</span>
    </div>
  );
}
