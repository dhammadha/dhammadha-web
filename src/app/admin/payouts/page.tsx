"use client";

import { Fragment, useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/Button";
import { fetchAllRows } from "@/lib/fetch-all";
import SubscriptionRevenue from "@/components/revenue/SubscriptionRevenue";
import { buildSubMonthStatement, type MonthData } from "@/lib/subscription-revenue";
import {
  buildQuarterlyStatements,
  groupOrdersByDesigner,
  quarterLabel,
  quarterOfMonth,
  payoutMonthFor,
  isPayoutDue,
  isPayoutOverdue,
  monthLabel,
  monthsInPeriod,
  periodOptions,
  periodLabel,
  fmtBaht,
  designerShareOf,
  type OrderLite,
  type PayoutRow,
  type Period,
  type QuarterStatement,
} from "@/lib/revenue";

type PayoutStatus = "overdue" | "waiting" | "notdue" | "clear";

type BankInfo = { bank_name?: string; branch?: string; account_name?: string; account_number?: string };

type DesignerInfo = {
  id: string;
  name: string | null;
  business_name: string | null;
  designer_slug: string | null;
  bank: BankInfo | null;
};

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

// คอลัมน์ตารางสรุป — หัวตารางกับแถวต้องใช้ template เดียวกันเสมอ
const SUMMARY_GRID = "grid grid-cols-[1.4fr_1fr_1fr_1fr_1fr_120px] gap-3";

export default function AdminPayoutsPage() {
  const [orders, setOrders] = useState<OrderLite[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [designers, setDesigners] = useState<Record<string, DesignerInfo>>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [selectedDesignerId, setSelectedDesignerId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [saving, setSaving] = useState(false);
  // ส่วนแบ่ง subscription ต่อ designer แยกรายไตรมาส (key `${designerId}:${quarter}`)
  // — โหมดรายปีต้องรู้ค่าต่อไตรมาสเพื่อคำนวณยอดค้างโอน (จ่ายเป็นรายไตรมาส)
  const [subByDQ, setSubByDQ] = useState<Record<string, number>>({});

  const options = useMemo(() => periodOptions(), []);
  const [periodKeyStr, setPeriodKeyStr] = useState(options[0].key);
  const period: Period = (options.find((o) => o.key === periodKeyStr) ?? options[0]).period;
  // โหมดไตรมาสเท่านั้นที่บันทึกการโอนได้ (payouts unique ต่อไตรมาส) — ปี/ทั้งหมด = อ่านอย่างเดียว
  const readOnly = period.type !== "quarter";
  const selectedQuarter = period.type === "quarter" ? { year: period.year, quarter: period.quarter } : null;

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 4000); };

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
    const map = new Map<string, QuarterStatement[]>();
    for (const [designerId, designerOrders] of grouped) {
      const designerPayouts = payouts.filter((p) => p.designer_id === designerId);
      map.set(designerId, buildQuarterlyStatements(designerOrders, designerPayouts));
    }
    // designer ที่มี payout บันทึกไว้แต่ไม่มี order paid เหลืออยู่เลย (เช่น order
    // ถูกยกเลิกทีหลัง) — ยังต้องเห็นและยกเลิกการบันทึกได้ ไม่งั้นค้างใน DB ตลอด
    for (const p of payouts) {
      if (!map.has(p.designer_id)) {
        map.set(
          p.designer_id,
          buildQuarterlyStatements([], payouts.filter((x) => x.designer_id === p.designer_id))
        );
      }
    }
    // ยอดของ order ที่ไม่ผูก designer (ยอดสตูดิโอเอง) — โชว์เป็นแถวแยก ไม่มี payout
    const studioOrders = orders.filter((o) => !o.designer_id);
    if (studioOrders.length > 0) {
      map.set(STUDIO_KEY, buildQuarterlyStatements(studioOrders, []));
    }
    return map;
  }, [orders, payouts]);

  // subscription ต่อ designer ต่อไตรมาส ในช่วงที่เลือก (RPC เป็นรายเดือน วนตามช่วง)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const months = monthsInPeriod(period);
      const results = await Promise.all(
        months.map(async (m) => ({
          quarter: quarterOfMonth(m.month),
          res: await supabase.rpc("subscription_month_data", { p_year: m.year, p_month: m.month }),
        }))
      );
      if (cancelled) return;
      const byDQ: Record<string, number> = {};
      for (const { quarter, res } of results) {
        if (res.error || !res.data) continue;
        const stmt = buildSubMonthStatement(res.data as unknown as MonthData);
        for (const [designerId, slice] of stmt.byDesigner) {
          const k = `${designerId}:${quarter}`;
          byDQ[k] = (byDQ[k] ?? 0) + slice.total;
        }
      }
      setSubByDQ(byDQ);
    })();
    return () => { cancelled = true; };
  }, [periodKeyStr]); // eslint-disable-line react-hooks/exhaustive-deps

  const subForQuarter = useCallback(
    (designerId: string, quarter: number) => (designerId === STUDIO_KEY ? 0 : subByDQ[`${designerId}:${quarter}`] ?? 0),
    [subByDQ]
  );

  // ไตรมาสที่อยู่ในช่วง — quarter=1 ตัว · year=4 ตัว · all=ทุกไตรมาสที่มีข้อมูล
  const quartersInPeriod = useMemo(() => {
    if (period.type === "quarter") return [{ year: period.year, quarter: period.quarter }];
    if (period.type === "year") return [1, 2, 3, 4].map((q) => ({ year: period.year, quarter: q }));
    const set = new Map<string, { year: number; quarter: number }>();
    for (const stmts of statementsByDesigner.values())
      for (const s of stmts) set.set(s.key, { year: s.year, quarter: s.quarter });
    return Array.from(set.values());
  }, [periodKeyStr, statementsByDesigner]); // eslint-disable-line react-hooks/exhaustive-deps

  // สถานะการโอนต่อ designer — คิด "เฉพาะไตรมาสในช่วงที่เลือก" (quartersInPeriod) เท่านั้น
  // ไม่ rollup ข้ามช่วง: ดูไตรมาสไหน สถานะก็ของไตรมาสนั้น · เทียบวันปัจจุบันกับเดือนรอบโอน
  // overdue(ค้างชำระ) > waiting(รอโอน) > notdue(ยังไม่ถึงรอบ) > clear(จ่ายครบ/ไม่มียอด)
  const statusByDesigner = useMemo(() => {
    const now = new Date();
    const rank: Record<PayoutStatus, number> = { clear: 0, notdue: 1, waiting: 2, overdue: 3 };
    const out: Record<string, PayoutStatus> = {};
    for (const [designerId, statements] of statementsByDesigner) {
      if (designerId === STUDIO_KEY) continue;
      let worst: PayoutStatus = "clear";
      for (const q of quartersInPeriod) {
        const s = statements.find((st) => st.year === q.year && st.quarter === q.quarter);
        const earned = (s?.designerAmount ?? 0) + subForQuarter(designerId, q.quarter);
        if (earned <= 0.005) continue;
        if (s?.payout) continue; // ไตรมาสนี้จ่ายแล้ว → clear
        const st: PayoutStatus = isPayoutOverdue(q.year, q.quarter, now) ? "overdue" : isPayoutDue(q.year, q.quarter, now) ? "waiting" : "notdue";
        if (rank[st] > rank[worst]) worst = st;
      }
      out[designerId] = worst;
    }
    return out;
  }, [statementsByDesigner, quartersInPeriod, subForQuarter, payouts]);

  // แถวสรุปของช่วงที่เลือก — aggregate ทุกไตรมาสในช่วง (โหมดปี = 4 ไตรมาส)
  // Row เก็บทั้งยอดรวมของช่วง + statement รายไตรมาส (โหมดไตรมาสใช้ตอนบันทึกโอน)
  type Row = {
    designerId: string;
    b2cTotal: number;
    platformAmount: number;
    designerAmount: number; // ส่วนแบ่ง Retail Font รวมช่วง
    b2bTotal: number;
    subAmount: number; // ส่วนแบ่ง subscription รวมช่วง
    orders: OrderLite[];
    pending: number; // ยอดค้างโอนรวมช่วง (เฉพาะไตรมาสที่ยังไม่บันทึกจ่าย)
    quarterStmt: QuarterStatement | null; // โหมดไตรมาสเท่านั้น
    payout: PayoutRow | null; // โหมดไตรมาสเท่านั้น
  };

  const summaryRows: Row[] = useMemo(() => {
    const rows: Row[] = [];
    const seen = new Set<string>();
    const build = (designerId: string, statements: QuarterStatement[]): Row => {
      let b2cTotal = 0, platformAmount = 0, designerAmount = 0, b2bTotal = 0, subAmount = 0, pending = 0;
      const orders: OrderLite[] = [];
      let quarterStmt: QuarterStatement | null = null;
      for (const q of quartersInPeriod) {
        const s = statements.find((st) => st.year === q.year && st.quarter === q.quarter) ?? null;
        const qSub = subForQuarter(designerId, q.quarter);
        if (s) {
          b2cTotal += s.b2cTotal; platformAmount += s.platformAmount;
          designerAmount += s.designerAmount; b2bTotal += s.b2bTotal;
          orders.push(...s.orders);
        }
        subAmount += qSub;
        if (designerId !== STUDIO_KEY && !s?.payout) pending += (s?.designerAmount ?? 0) + qSub;
        if (period.type === "quarter") quarterStmt = s;
      }
      return { designerId, b2cTotal, platformAmount, designerAmount, b2bTotal, subAmount, orders, pending, quarterStmt, payout: quarterStmt?.payout ?? null };
    };
    for (const [designerId, statements] of statementsByDesigner) {
      const row = build(designerId, statements);
      // แสดงถ้ามียอดขาย/ยอด subscription/มีบันทึกจ่ายในช่วง
      if (row.b2cTotal > 0 || row.b2bTotal > 0 || row.subAmount > 0 || row.payout) {
        rows.push(row);
        seen.add(designerId);
      }
    }
    // designer ที่มี subscription แต่ไม่มี order เลย (ไม่อยู่ใน statementsByDesigner)
    const subDesigners = new Set(Object.keys(subByDQ).map((k) => k.split(":")[0]));
    for (const designerId of subDesigners) {
      if (seen.has(designerId) || designerId === STUDIO_KEY) continue;
      const row = build(designerId, []);
      if (row.subAmount > 0) { rows.push(row); seen.add(designerId); }
    }
    return rows;
  }, [statementsByDesigner, quartersInPeriod, subByDQ, subForQuarter, period.type]);

  // ยอดค้างโอนสะสมทั้งหมด (all-time) ต่อ designer — earned(Retail) − paid ทั้งหมด
  // เงินที่ค้างจากไตรมาสเก่าที่ยังไม่โอนไม่หายไปไหน (sub=0 ยังไม่รวม — เพิ่มเมื่อ Phase 4.1 live)
  const outstandingByDesigner = useMemo(() => {
    const earned = new Map<string, number>();
    for (const o of orders) {
      if (o.status !== "paid" || o.source !== "checkout" || !o.designer_id) continue;
      earned.set(o.designer_id, (earned.get(o.designer_id) ?? 0) + designerShareOf(o));
    }
    const paid = new Map<string, number>();
    for (const p of payouts) paid.set(p.designer_id, (paid.get(p.designer_id) ?? 0) + p.amount);
    const out: Record<string, number> = {};
    for (const [id, amt] of earned) out[id] = Math.max(0, amt - (paid.get(id) ?? 0));
    return out;
  }, [orders, payouts]);
  const totalOutstanding = useMemo(
    () => Object.values(outstandingByDesigner).reduce((s, v) => s + v, 0),
    [outstandingByDesigner]
  );

  // badge แจ้งเตือน "เผื่อตกหล่น" — นับ designer ที่ค้างชำระ/รอโอน แบบรวมทุกไตรมาส (all-time)
  // ไม่ผูกกับช่วงที่เลือก: ดู Q3 อยู่ แต่ Q2 ยังรอโอน/ค้างชำระ ก็ต้องเด้งเตือนทุกหน้า filter
  const { waitingCount, overdueCount } = useMemo(() => {
    const now = new Date();
    const earned = new Map<string, number>();
    const keysByDesigner = new Map<string, Set<string>>();
    for (const o of orders) {
      if (o.status !== "paid" || o.source !== "checkout" || !o.designer_id) continue;
      const d = new Date(o.paid_at ?? o.created_at);
      const y = d.getFullYear(), q = quarterOfMonth(d.getMonth() + 1);
      const k = `${o.designer_id}:${y}:${q}`;
      earned.set(k, (earned.get(k) ?? 0) + designerShareOf(o));
      let set = keysByDesigner.get(o.designer_id);
      if (!set) { set = new Set(); keysByDesigner.set(o.designer_id, set); }
      set.add(`${y}:${q}`);
    }
    const paidSet = new Set(payouts.map((p) => `${p.designer_id}:${p.period_year}:${p.period_quarter}`));
    const rank: Record<PayoutStatus, number> = { clear: 0, notdue: 1, waiting: 2, overdue: 3 };
    let waiting = 0, overdue = 0;
    for (const [id, keys] of keysByDesigner) {
      if (id === STUDIO_KEY) continue;
      let worst: PayoutStatus = "clear";
      for (const yq of keys) {
        const [y, q] = yq.split(":").map(Number);
        if ((earned.get(`${id}:${y}:${q}`) ?? 0) <= 0.005) continue;
        if (paidSet.has(`${id}:${y}:${q}`)) continue;
        const s: PayoutStatus = isPayoutOverdue(y, q, now) ? "overdue" : isPayoutDue(y, q, now) ? "waiting" : "notdue";
        if (rank[s] > rank[worst]) worst = s;
      }
      if (worst === "overdue") overdue++;
      else if (worst === "waiting") waiting++;
    }
    return { waitingCount: waiting, overdueCount: overdue };
  }, [orders, payouts]);

  // stat tiles ยอดขาย — ตามช่วงที่เลือก (tile "ค้างโอน" ใช้ยอดสะสมทั้งหมดแยกด้านล่าง)
  const periodStats = useMemo(() => {
    let b2cTotal = 0, subTotal = 0, platformAmount = 0;
    for (const r of summaryRows) {
      b2cTotal += r.b2cTotal;
      subTotal += r.subAmount;
      platformAmount += r.platformAmount;
    }
    return { b2cTotal, subTotal, platformAmount };
  }, [summaryRows]);

  const selectedRow = summaryRows.find((r) => r.designerId === selectedDesignerId) ?? null;

  useEffect(() => {
    if (selectedRow) {
      setPayAmount(String(selectedRow.pending || ""));
      setPayNote("");
    }
  }, [selectedRow?.designerId, periodKeyStr]); // eslint-disable-line react-hooks/exhaustive-deps

  // บันทึกการโอน + ส่งอีเมลยืนยันพร้อม PDF ให้ designer
  const confirmTransfer = async () => {
    if (!selectedRow || !selectedQuarter) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) { showToast("กรุณาระบุจำนวนเงิน"); return; }
    setSaving(true);

    const { error } = await supabase.from("payouts").insert({
      designer_id: selectedRow.designerId,
      period_year: selectedQuarter.year,
      period_quarter: selectedQuarter.quarter,
      amount,
      note: payNote || null,
    } as never);

    if (error) {
      setSaving(false);
      showToast(error.code === "23505" ? "มีการบันทึกไปแล้ว" : "บันทึกไม่สำเร็จ: " + error.message);
      loadAll();
      return;
    }

    // บันทึกสำเร็จแล้ว — ตั้งแต่จุดนี้ห้ามให้ข้อความบอกว่า "ไม่สำเร็จ" ลอย ๆ
    // เพราะเงินถูก mark ว่าจ่ายแล้วจริง อีเมลที่ล้มเป็นคนละเรื่องกัน
    const periodLabel = quarterLabel(selectedQuarter.year, selectedQuarter.quarter);
    const b2cAmount = selectedRow.designerAmount;
    let emailOk = false;
    let emailErr = "";
    try {
      let pdf_base64: string | undefined;
      let filename: string | undefined;
      try {
        const { generatePayoutPdf } = await import("@/lib/payout-doc");
        const bytes = await generatePayoutPdf({
          designerName: displayName(designers[selectedRow.designerId], selectedRow.designerId),
          periodLabel,
          paidAt: new Date().toISOString(),
          b2cAmount,
          subscriptionAmount: selectedRow.subAmount,
          totalAmount: amount,
          note: payNote || null,
          bank: designers[selectedRow.designerId]?.bank ?? null,
        });
        pdf_base64 = uint8ToBase64(bytes);
        filename = `payout-${selectedQuarter.year}Q${selectedQuarter.quarter}.pdf`;
      } catch {
        // สร้าง PDF ไม่สำเร็จ — ยังส่งอีเมลแจ้งได้ แค่ไม่มีไฟล์แนบ
      }

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          type: "payout",
          payload: {
            designer_id: selectedRow.designerId,
            period_label: periodLabel,
            total_amount: fmtBaht(amount),
            b2c_amount: fmtBaht(b2cAmount),
            subscription_amount: fmtBaht(selectedRow.subAmount),
            note: payNote || "",
            ...(pdf_base64 ? { pdf_base64, filename } : {}),
          },
        }),
      });
      const result = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      emailOk = res.ok && !!result?.ok;
      emailErr = result?.error ?? String(res.status);
    } catch (e) {
      emailErr = e instanceof Error ? e.message : String(e);
    }

    setSaving(false);
    showToast(
      emailOk
        ? "✓ บันทึกการโอนแล้ว และส่งอีเมลยืนยันให้ designer เรียบร้อย"
        : `✓ บันทึกการโอนแล้ว แต่ส่งอีเมลไม่สำเร็จ (${emailErr}) — แจ้ง designer เองอีกทาง`
    );
    loadAll();
  };

  const unmarkPaid = async () => {
    if (!selectedRow?.payout) return;
    if (!confirm("ยกเลิกการบันทึกว่าจ่ายแล้ว?")) return;
    const { error } = await supabase.from("payouts").delete().eq("id", selectedRow.payout.id);
    showToast(error ? "ยกเลิกไม่สำเร็จ: " + error.message : "ยกเลิกแล้ว");
    loadAll();
  };

  const dueMonth = selectedQuarter ? payoutMonthFor(selectedQuarter.year, selectedQuarter.quarter) : null;

  return (
    <div className="p-6 max-w-[1200px]">
      <div className="mb-4">
        <h1 className="font-heading text-h2 text-black">Payouts / จ่ายส่วนแบ่ง</h1>
        <p className="font-body text-body-sm text-grey-600 mt-0.5">สรุปยอดขายและรายได้แบ่งปันนักออกแบบ</p>
        <p className="font-body text-body-sm text-grey-600 mt-0.5">
          จ่ายส่วนแบ่งทุก 3 เดือน (รายไตรมาส) — โอนในเดือนมกราคม เมษายน กรกฎาคม และตุลาคม
        </p>
      </div>

      {/* Stat tiles — ตามช่วงที่เลือก, รวมทุก designer */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatTile label="ยอดขาย Retail Font" value={fmtBaht(periodStats.b2cTotal)} />
        <StatTile label="ยอด Subscription" value={fmtBaht(periodStats.subTotal)} />
        <StatTile label="รายได้ของเว็บ" value={fmtBaht(periodStats.platformAmount)} />
        <StatTile label="ค้างโอนให้ designer (สะสมทั้งหมด)" value={fmtBaht(totalOutstanding)} highlight />
      </div>

      {loading ? (
        <div className="bg-surface py-16 flex items-center justify-center font-body text-body-sm text-grey-600">
          กำลังโหลด…
        </div>
      ) : (
        <>
          {/* Period selector — ไตรมาสนี้ / ก่อน / รายปี 3 ปี */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <label className="font-body font-bold text-body-sm text-grey-600">ช่วงเวลา</label>
            <select
              value={periodKeyStr}
              onChange={(e) => { setPeriodKeyStr(e.target.value); setSelectedDesignerId(null); }}
              className="px-3 py-2 h-[38px] bg-surface font-body text-body-sm text-black outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black transition-colors duration-150 ease-base"
            >
              {options.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
            {dueMonth && selectedQuarter && (
              <span className="font-body font-bold text-body-sm text-grey-600">
                {isPayoutDue(selectedQuarter.year, selectedQuarter.quarter)
                  ? `ถึงรอบโอนแล้ว (${monthLabel(dueMonth.year, dueMonth.month)})`
                  : `รอบโอน ${monthLabel(dueMonth.year, dueMonth.month)}`}
              </span>
            )}
            {readOnly && (
              <span className="font-body text-footnote text-grey-600">โหมดรายปี/ทั้งหมด — ดูสรุปอย่างเดียว (บันทึกการโอนทำได้ทีละไตรมาส)</span>
            )}
            {(overdueCount > 0 || waitingCount > 0) && (
              <div className="ml-auto flex items-center gap-2">
                {overdueCount > 0 && (
                  <span className="text-badge font-heading px-2 py-0.5 bg-danger text-white">ค้างชำระ {overdueCount} ราย</span>
                )}
                {waitingCount > 0 && (
                  <span className="text-badge font-heading px-2 py-0.5 bg-warning text-black">รอโอน {waitingCount} ราย</span>
                )}
              </div>
            )}
          </div>

          {/* สรุปยอดต้องโอนต่อ designer — คลิกแถวเพื่อกางรายละเอียดใต้แถวนั้นเลย */}
          <div className="bg-surface overflow-hidden">
            <div className={`${SUMMARY_GRID} px-4 py-2.5 bg-white font-heading text-badge text-grey-600 tracking-[0.04em]`}>
              <div>Designer</div>
              <div>ส่วนแบ่ง Retail Font</div>
              <div>ส่วนแบ่ง Subscription</div>
              <div>ยอดรับตรง (ไม่ผ่านเว็บ)</div>
              <div>ยอดค้างโอน</div>
              <div>สถานะ</div>
            </div>

            {summaryRows.length === 0 ? (
              <div className="flex items-center justify-center py-12 font-body text-body-sm text-grey-600">ไม่มีข้อมูลในช่วงนี้</div>
            ) : (
              summaryRows.map((r) => {
                const d = designers[r.designerId];
                const open = selectedDesignerId === r.designerId;
                const rowBank = d?.bank;
                const rowHasBank = !!(rowBank && (rowBank.bank_name || rowBank.account_number));
                const rowIsStudio = r.designerId === STUDIO_KEY;
                const status = rowIsStudio ? "clear" : statusByDesigner[r.designerId] ?? "clear";
                return (
                  <Fragment key={r.designerId}>
                    <div
                      onClick={() => setSelectedDesignerId(open ? null : r.designerId)}
                      className={`${SUMMARY_GRID} px-4 py-3 cursor-pointer transition-colors duration-150 ease-base items-center ${open ? "bg-mint/20" : "hover:bg-grey-200"}`}
                    >
                      <div className="font-ui text-ui text-black truncate">{displayName(d, r.designerId)}</div>
                      <div className="font-body text-body-sm text-grey-600">{fmtBaht(r.designerAmount)}</div>
                      <div className="font-body text-body-sm text-grey-600">{fmtBaht(r.subAmount)}</div>
                      <div className="font-body text-body-sm text-grey-600">{fmtBaht(r.b2bTotal)}</div>
                      <div className="font-ui text-ui text-black">{fmtBaht(r.pending)}</div>
                      <div><PayoutStatusBadge status={status} /></div>
                    </div>

                    {/* รายละเอียด — กางใต้แถวที่เลือก เต็มความกว้าง วางข้อมูลแนวนอน */}
                    {open && (
                      <div className="bg-white px-4 py-4 flex flex-col gap-4">
                        <div className="font-body text-footnote text-grey-600">
                          {selectedQuarter ? quarterLabel(selectedQuarter.year, selectedQuarter.quarter) : periodLabel(period)}
                        </div>

                        {/* Breakdown แนวนอน (ตัดยอด B2B ออก) */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <MiniStat label="ยอดขาย Retail Font" value={fmtBaht(r.b2cTotal)} />
                          <MiniStat label="รายได้ของเว็บ" value={fmtBaht(r.platformAmount)} />
                          <MiniStat label="ส่วนแบ่ง Retail Font" value={fmtBaht(r.designerAmount)} />
                          <MiniStat label="ส่วนแบ่ง Subscription" value={fmtBaht(r.subAmount)} />
                        </div>

                        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)]">
                          {/* บัญชีธนาคาร — เรียงแนวตั้งกันอ่านผิดคู่ */}
                          {!rowIsStudio && (
                            <div>
                              <div className="font-heading text-badge text-grey-600 tracking-[0.04em] mb-1.5">บัญชีธนาคาร (สำหรับโอน)</div>
                              {rowHasBank ? (
                                <div className="flex flex-col gap-1 font-body text-body-sm bg-surface px-3 py-2.5">
                                  <Row label="ธนาคาร" value={rowBank?.bank_name} />
                                  <Row label="สาขา" value={rowBank?.branch} />
                                  <Row label="ชื่อบัญชี" value={rowBank?.account_name} />
                                  <Row label="เลขที่บัญชี" value={rowBank?.account_number} />
                                </div>
                              ) : (
                                <div className="font-body text-footnote text-black bg-warning px-3 py-2.5">⚠️ designer ยังไม่กรอกบัญชีธนาคาร</div>
                              )}
                            </div>
                          )}

                          {/* ออเดอร์ — ทีละแถว แยก Retail Font / Subscription */}
                          {(() => {
                            const retailOrders = r.orders
                              .filter((o) => o.source === "checkout")
                              .sort((a, b) => new Date(b.paid_at ?? b.created_at).getTime() - new Date(a.paid_at ?? a.created_at).getTime());
                            if (retailOrders.length === 0 && r.subAmount <= 0) return null;
                            return (
                              <div className="flex flex-col gap-3">
                                {retailOrders.length > 0 && (
                                  <div>
                                    <div className="font-heading text-badge text-grey-600 tracking-[0.04em] mb-1.5">Retail Font</div>
                                    <div className="flex flex-col gap-1">
                                      {retailOrders.map((o) => (
                                        <div key={o.id} className="grid grid-cols-[auto_1fr_auto] gap-3 items-baseline font-body text-body-sm bg-surface px-3 py-2">
                                          <span className="text-grey-600">{o.order_no}</span>
                                          <span className="text-black truncate">{(o.items ?? []).map((it) => it.name).join(", ") || "—"}</span>
                                          <span className="font-ui text-ui text-black">{fmtBaht(designerShareOf(o))}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {r.subAmount > 0 && (
                                  <div>
                                    <div className="font-heading text-badge text-grey-600 tracking-[0.04em] mb-1.5">Subscription</div>
                                    <div className="grid grid-cols-[1fr_auto] gap-3 items-baseline font-body text-body-sm bg-surface px-3 py-2">
                                      <span className="text-black">ส่วนแบ่งรวมของไตรมาส</span>
                                      <span className="font-ui text-ui text-black">{fmtBaht(r.subAmount)}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* การโอน */}
                          <div className="flex flex-col gap-2">
                            {rowIsStudio ? (
                              <div className="font-body text-footnote text-grey-600">ยอดของสตูดิโอเอง (order ไม่ผูก designer) — ไม่มีการโอนส่วนแบ่ง</div>
                            ) : readOnly ? (
                              <div className="font-body text-footnote text-grey-600">โหมดรายปี/ทั้งหมด — บันทึกการโอนทำได้ทีละไตรมาส เลือกไตรมาสที่ต้องการใน filter ด้านบน</div>
                            ) : r.payout ? (
                              <>
                                <div className="font-body text-body-sm text-white bg-success px-3 py-2 flex flex-col gap-0.5">
                                  <span>✓ จ่ายแล้ว {fmtBaht(r.payout.amount)}</span>
                                  <span className="font-body text-footnote">{fmtDateFull(r.payout.paid_at)}</span>
                                  {r.payout.note && <span className="font-body text-footnote">โน้ต: {r.payout.note}</span>}
                                </div>
                                <button onClick={unmarkPaid} className="font-body text-footnote text-grey-600 hover:text-danger-dark bg-transparent border-none cursor-pointer transition-colors duration-150 ease-base self-start">
                                  ยกเลิกการบันทึก
                                </button>
                              </>
                            ) : r.pending > 0 ? (
                              <>
                                <label className="font-body font-bold text-body-sm text-grey-600">จำนวนเงินที่โอน</label>
                                <input
                                  type="number"
                                  value={payAmount}
                                  onChange={(e) => setPayAmount(e.target.value)}
                                  className="w-full px-3 py-2 h-[38px] bg-surface font-body text-body-sm text-black outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black transition-colors duration-150 ease-base"
                                />
                                <label className="font-body font-bold text-body-sm text-grey-600">โน้ต / เลขอ้างอิง (ถ้ามี)</label>
                                <input
                                  value={payNote}
                                  onChange={(e) => setPayNote(e.target.value)}
                                  className="w-full px-3 py-2 h-[38px] bg-surface font-body text-body-sm text-black outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black transition-colors duration-150 ease-base"
                                />
                                <p className="font-body text-footnote text-grey-600 leading-relaxed">
                                  กดหลังจากโอนเงินจริงแล้ว — ระบบจะบันทึกการโอน ออกใบสรุป และส่งอีเมลยืนยันพร้อมเอกสารให้ designer
                                </p>
                                <Button onClick={confirmTransfer} disabled={saving} className="w-full mt-1">
                                  {saving ? "กำลังบันทึก…" : "ยืนยันการโอน"}
                                </Button>
                              </>
                            ) : (
                              <div className="font-body text-footnote text-grey-600">ไตรมาสนี้ไม่มีรายการต้องโอน</div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </Fragment>
                );
              })
            )}
            <div className="px-4 py-3 font-body text-footnote text-grey-600">
              ยอดค้างโอน = ยอดของไตรมาสที่เลือกที่ยังไม่ได้โอน · ยอดสะสมทุกไตรมาสดูที่การ์ด &ldquo;ค้างโอนให้ designer (สะสมทั้งหมด)&rdquo; ด้านบน · กดจ่ายทีละไตรมาส (ยอดรับตรง designer รับเงินจากลูกค้าเอง ไม่ผ่านเว็บ)
            </div>
          </div>
        </>
      )}

      <SubscriptionRevenue mode="admin" />

      {toast && (
        <div className="fixed bottom-6 right-6 z-[190] px-4 py-3 bg-black text-white font-body text-body-sm shadow-lg max-w-[420px]">{toast}</div>
      )}
    </div>
  );
}

// chunk-safe Uint8Array → base64 (เลี่ยง String.fromCharCode(...bigArray) spread overflow)
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

// สถานะการโอน (rollup ต่อ designer) — เขียวอ่อน/เหลือง/แดง/เทา
function PayoutStatusBadge({ status }: { status: PayoutStatus }) {
  if (status === "overdue") return <span className="text-badge font-heading px-2 py-0.5 bg-danger text-white">ค้างชำระ</span>;
  if (status === "waiting") return <span className="text-badge font-heading px-2 py-0.5 bg-warning text-black">รอโอน</span>;
  if (status === "notdue") return <span className="text-badge font-heading px-2 py-0.5 bg-mint text-black">ยังไม่ถึงรอบโอน</span>;
  return <span className="font-body text-footnote text-grey-600">จ่ายครบแล้ว</span>;
}

// เซลล์ตัวเลขในรายละเอียด (วางแนวนอน)
function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface p-3">
      <div className="font-ui text-ui text-black leading-none mb-1">{value}</div>
      <div className="font-body text-footnote text-grey-600">{label}</div>
    </div>
  );
}

function StatTile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-surface p-4">
      <div className={`font-heading text-h2 leading-none mb-1 ${highlight ? "text-mint-text" : "text-black"}`}>{value}</div>
      <div className="font-body text-footnote text-grey-600">{label}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-grey-600">{label}: </span>
      <span className="text-black">{value}</span>
    </div>
  );
}
