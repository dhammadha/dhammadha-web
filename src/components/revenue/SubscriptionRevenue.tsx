"use client";

// ส่วนรายได้ subscription (แยกจากรายได้ B2C/B2B เดิม) — ใช้ทั้งหน้า admin และ designer
// เรียก RPC subscription_month_data(year, month) แล้วคำนวณส่วนแบ่งด้วย
// src/lib/subscription-revenue.ts (pure) — โมเดล เว็บ 50% / equal 15% / stream 35%
//
// admin  : เห็น pool รวม + ตารางต่อ designer + ต่อฟอนต์
// designer: เห็นเฉพาะส่วนแบ่งของตัวเอง

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { fmtBaht, monthLabel } from "@/lib/revenue";
import {
  buildSubMonthStatement,
  designerSlice,
  type MonthData,
  type SubMonthStatement,
} from "@/lib/subscription-revenue";

type Props = { mode: "admin" | "designer" };

type UserName = { id: string; name: string | null; business_name: string | null };

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

export default function SubscriptionRevenue({ mode }: Props) {
  const { user } = useAuth();
  const months = recentMonths(12);
  const [monthKey, setMonthKey] = useState(months[0].key);
  const [stmt, setStmt] = useState<SubMonthStatement | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const sel = months.find((m) => m.key === monthKey) ?? months[0];

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("subscription_month_data", {
      p_year: sel.year,
      p_month: sel.month,
    });
    if (error || !data) {
      setStmt(null);
      setLoading(false);
      return;
    }
    const built = buildSubMonthStatement(data as unknown as MonthData);
    setStmt(built);

    // ชื่อ designer/owner สำหรับ admin (designer เห็นแค่ของตัวเอง ไม่ต้องใช้ชื่อคนอื่น)
    if (mode === "admin") {
      const ownerIds = Array.from(built.byDesigner.keys());
      if (ownerIds.length > 0) {
        const { data: users } = await supabase
          .from("users")
          .select("id, name, business_name")
          .in("id", ownerIds);
        const map: Record<string, string> = {};
        for (const u of (users as UserName[]) ?? []) {
          map[u.id] = u.business_name ?? u.name ?? u.id.slice(0, 8);
        }
        setNames(map);
      }
    }
    setLoading(false);
  }, [sel.year, sel.month, mode]);

  useEffect(() => { load(); }, [load]);

  const isTrial = stmt != null && stmt.revenue === 0;

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="text-[18px] font-semibold text-navy">รายได้ Subscription</h2>
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
      <p className="text-[12px] text-[#888] mb-4 leading-relaxed">
        แบ่งจากยอดสมาชิกรวม: เว็บ 50% · แบ่งเท่ากันทุกฟอนต์ในแพลน 15% · ตามยอดใช้งาน (font-days) 35%
      </p>

      {loading ? (
        <div className="bg-white rounded-2xl border border-border py-12 text-center text-[#aaa] text-[14px]">กำลังโหลด…</div>
      ) : !stmt ? (
        <div className="bg-white rounded-2xl border border-border py-12 text-center text-[#aaa] text-[14px]">ยังไม่มีข้อมูล</div>
      ) : (
        <>
          {isTrial && (
            <div className="mb-4 px-4 py-2.5 rounded-xl bg-mint-light border border-mint-mid text-[12px] text-[#0a8a84]">
              ช่วงทดสอบ — ยอดเงินเป็น ฿0 แต่แสดงสัดส่วนและสถิติการใช้งานจริง
            </div>
          )}

          {mode === "admin" ? (
            <AdminView stmt={stmt} names={names} />
          ) : (
            <DesignerView stmt={stmt} designerId={user?.id ?? ""} />
          )}
        </>
      )}
    </section>
  );
}

function Pool({ label, pct, amount, sub }: { label: string; pct: string; amount: number; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-border p-4">
      <div className="text-[22px] font-semibold leading-none mb-1 text-navy">{fmtBaht(amount)}</div>
      <div className="text-[12px] text-[#aaa]">{label} <span className="text-[#ccc]">· {pct}</span></div>
      {sub && <div className="text-[11px] text-[#bbb] mt-0.5">{sub}</div>}
    </div>
  );
}

function AdminView({ stmt, names }: { stmt: SubMonthStatement; names: Record<string, string> }) {
  const designers = Array.from(stmt.byDesigner.values()).sort((a, b) => b.total - a.total);
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Pool label="ยอดสมาชิกรวม" pct={`${stmt.subscriberCount} คน`} amount={stmt.revenue} sub={`ใช้งานจริง ${stmt.contributingUsers} คน`} />
        <Pool label="ส่วนแบ่งเว็บ" pct="50%" amount={stmt.platformAmount} sub="รวมส่วนที่แบ่งไม่หมด" />
        <Pool label="Pool แบ่งเท่ากัน" pct="15%" amount={stmt.equalPool} sub={`${stmt.optedCount} ฟอนต์`} />
        <Pool label="Pool ตามการใช้งาน" pct="35%" amount={stmt.streamPool} />
      </div>

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr] gap-3 px-4 py-2.5 bg-[#f8f8f6] text-[11px] font-semibold text-[#aaa] tracking-[0.04em] border-b border-border">
          <div>Designer</div><div>แบ่งเท่ากัน</div><div>ตามการใช้งาน</div><div>รวม</div>
        </div>
        {designers.length === 0 ? (
          <div className="py-10 text-center text-[#aaa] text-[14px]">ยังไม่มีส่วนแบ่งในเดือนนี้</div>
        ) : (
          designers.map((d) => (
            <details key={d.ownerId} className="border-b border-[#f4f4f2] last:border-0">
              <summary className="grid grid-cols-[1.6fr_1fr_1fr_1fr] gap-3 px-4 py-3 cursor-pointer hover:bg-[#fafaf8] items-center list-none">
                <div className="text-[13px] text-navy font-medium truncate">{names[d.ownerId] ?? d.ownerId.slice(0, 8)}</div>
                <div className="text-[13px] text-[#555]">{fmtBaht(d.equal)}</div>
                <div className="text-[13px] text-[#555]">{fmtBaht(d.stream)}</div>
                <div className="text-[13px] text-navy font-semibold">{fmtBaht(d.total)}</div>
              </summary>
              <div className="px-4 pb-3 flex flex-col gap-1.5">
                {d.fonts.map((f) => (
                  <div key={f.fontId} className="grid grid-cols-[1.6fr_1fr_1fr_1fr] gap-3 text-[12px] text-[#666] bg-[#f8f8f6] rounded-lg px-3 py-2 items-center">
                    <div className="truncate">
                      {f.name ?? "—"}
                      {!f.optedIn && <span className="ml-1.5 text-[10px] text-amber-600">(ออกจากแพลนแล้ว)</span>}
                    </div>
                    <div>{fmtBaht(f.equalAmount)}</div>
                    <div>{fmtBaht(f.streamAmount)} <span className="text-[#bbb]">· {(f.streamShare * 100).toFixed(1)}%</span></div>
                    <div className="text-[#888]">{f.fontDays} วัน-ฟอนต์</div>
                  </div>
                ))}
              </div>
            </details>
          ))
        )}
      </div>
      <p className="text-[11px] text-[#aaa] mt-2.5 leading-relaxed">
        ยอดที่ต้องโอนให้ designer แต่ละเดือน = ส่วนแบ่ง B2C + ส่วนแบ่ง Subscription รวมกัน (บันทึกการจ่ายในตารางด้านบน)
      </p>
    </>
  );
}

function DesignerView({ stmt, designerId }: { stmt: SubMonthStatement; designerId: string }) {
  const slice = designerSlice(stmt, designerId);
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-2xl border border-border p-4">
          <div className="text-[22px] font-semibold leading-none mb-1 text-navy">{fmtBaht(slice?.equal ?? 0)}</div>
          <div className="text-[12px] text-[#aaa]">แบ่งเท่ากัน (จากฟอนต์ในแพลน)</div>
        </div>
        <div className="bg-white rounded-2xl border border-border p-4">
          <div className="text-[22px] font-semibold leading-none mb-1 text-navy">{fmtBaht(slice?.stream ?? 0)}</div>
          <div className="text-[12px] text-[#aaa]">ตามการใช้งาน (font-days)</div>
        </div>
        <div className="bg-white rounded-2xl border border-border p-4">
          <div className="text-[22px] font-semibold leading-none mb-1 text-mint">{fmtBaht(slice?.total ?? 0)}</div>
          <div className="text-[12px] text-[#aaa]">รวมส่วนแบ่ง Subscription</div>
        </div>
      </div>

      {!slice || slice.fonts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border py-10 text-center text-[#aaa] text-[14px]">
          ยังไม่มีส่วนแบ่ง Subscription ในเดือนนี้
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr] gap-3 px-4 py-2.5 bg-[#f8f8f6] text-[11px] font-semibold text-[#aaa] tracking-[0.04em] border-b border-border">
            <div>ฟอนต์</div><div>แบ่งเท่ากัน</div><div>ตามการใช้งาน</div><div>รวม</div>
          </div>
          {slice.fonts.map((f) => (
            <div key={f.fontId} className="grid grid-cols-[1.6fr_1fr_1fr_1fr] gap-3 px-4 py-3 border-b border-[#f4f4f2] last:border-0 text-[13px] items-center">
              <div className="text-navy truncate">
                {f.name ?? "—"}
                {!f.optedIn && <span className="ml-1.5 text-[10px] text-amber-600">(ออกจากแพลนแล้ว)</span>}
              </div>
              <div className="text-[#555]">{fmtBaht(f.equalAmount)}</div>
              <div className="text-[#555]">{fmtBaht(f.streamAmount)} <span className="text-[#bbb]">· {(f.streamShare * 100).toFixed(1)}%</span></div>
              <div className="text-navy font-medium">{fmtBaht(f.total)}</div>
            </div>
          ))}
        </div>
      )}
      <p className="text-[11px] text-[#aaa] mt-2.5 leading-relaxed">
        &quot;ตามการใช้งาน&quot; นับจากจำนวนวันที่สมาชิกเปิดใช้ฟอนต์ผ่านแอป (font-days) โดยเสียงของสมาชิกแต่ละคนถ่วงน้ำหนักเท่ากัน
      </p>
    </>
  );
}
