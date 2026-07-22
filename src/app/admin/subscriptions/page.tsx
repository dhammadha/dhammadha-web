"use client";

// จัดการสมาชิก subscription (admin): ดูรายการ, ยืดอายุ, ยกเลิก, เพิ่มสิทธิ์ (comp)
// เขียนตรงใต้ RLS "admin all subscriptions" — ไม่ต้องมี RPC

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/Button";
import { DEFAULT_SUB_SETTINGS, isSubActive, parseSubSettings, type SubscriptionRow } from "@/lib/subscription";
import { fetchAllRows } from "@/lib/fetch-all";

type Row = SubscriptionRow & { users: { email: string | null; name: string | null } | null };

const PROVIDER_LABEL: Record<string, string> = {
  trial: "ทดสอบ", stripe: "Stripe", payso: "Payso", admin: "Comp",
};
const STATUS_LABEL: Record<string, string> = {
  active: "ใช้งาน", cancelled: "ยกเลิก", expired: "หมดอายุ",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", { year: "2-digit", month: "short", day: "numeric" });
}

export default function AdminSubscriptionsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);
  const [compEmail, setCompEmail] = useState("");
  const [compDays, setCompDays] = useState("60");
  const [compBusy, setCompBusy] = useState(false);

  const [subMonthly, setSubMonthly] = useState(String(DEFAULT_SUB_SETTINGS.monthly_price));
  const [subYearly, setSubYearly] = useState(String(DEFAULT_SUB_SETTINGS.yearly_price));
  const [subTrialActive, setSubTrialActive] = useState(DEFAULT_SUB_SETTINGS.trial_active);
  const [subTrialEnd, setSubTrialEnd] = useState(DEFAULT_SUB_SETTINGS.trial_end_date);
  const [subDownWin, setSubDownWin] = useState("");
  const [subDownMac, setSubDownMac] = useState("");

  const showToast = (msg: string, error = false) => {
    setToast({ msg, error });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    const { rows: data } = await fetchAllRows<Row>((from, to) =>
      supabase
        .from("subscriptions")
        .select("*, users(email, name)")
        .order("created_at", { ascending: false })
        .range(from, to) as unknown as PromiseLike<{ data: Row[] | null; error: unknown }>
    );
    setRows(data);
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    supabase.from("settings").select("value").eq("key", "subscription").maybeSingle().then(({ data }) => {
      if (!data) return;
      const v = parseSubSettings(data.value);
      setSubMonthly(String(v.monthly_price));
      setSubYearly(String(v.yearly_price));
      setSubTrialActive(v.trial_active);
      setSubTrialEnd(v.trial_end_date);
      if (v.download_win) setSubDownWin(v.download_win);
      if (v.download_mac) setSubDownMac(v.download_mac);
    });
  }, []);

  const saveSubscription = async () => {
    const val = {
      monthly_price: parseInt(subMonthly) || DEFAULT_SUB_SETTINGS.monthly_price,
      yearly_price: parseInt(subYearly) || DEFAULT_SUB_SETTINGS.yearly_price,
      trial_active: subTrialActive,
      trial_end_date: subTrialEnd,
      download_win: subDownWin.trim(),
      download_mac: subDownMac.trim(),
    };
    if (subTrialActive && !subTrialEnd) { showToast("เปิดช่วงทดสอบต้องกำหนดวันสิ้นสุด", true); return; }
    const { error } = await supabase.from("settings").upsert({ key: "subscription", value: val });
    if (error) showToast("เกิดข้อผิดพลาด: " + error.message, true);
    else showToast("✓ บันทึกการตั้งค่า Subscription เรียบร้อย");
  };

  const activeCount = rows.filter((r) => isSubActive(r)).length;

  const extend = async (r: Row) => {
    const base = new Date(r.current_period_end).getTime() > Date.now() ? new Date(r.current_period_end) : new Date();
    base.setDate(base.getDate() + 30);
    const { error } = await supabase
      .from("subscriptions")
      .update({ current_period_end: base.toISOString(), status: "active", updated_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) showToast("ผิดพลาด: " + error.message, true);
    else { showToast("✓ ต่ออายุ 30 วันแล้ว"); load(); }
  };

  const cancel = async (r: Row) => {
    if (!confirm(`ยกเลิก subscription ของ ${r.users?.email ?? r.user_id}?`)) return;
    const { error } = await supabase
      .from("subscriptions")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) showToast("ผิดพลาด: " + error.message, true);
    else { showToast("✓ ยกเลิกแล้ว"); load(); }
  };

  const addComp = async () => {
    const email = compEmail.trim().toLowerCase();
    const days = parseInt(compDays) || 60;
    if (!email) { showToast("กรอกอีเมล", true); return; }
    setCompBusy(true);
    // หา user id จากอีเมล
    const { data: u } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
    if (!u) { showToast("ไม่พบผู้ใช้อีเมลนี้ (ต้องสมัครสมาชิกก่อน)", true); setCompBusy(false); return; }
    const end = new Date();
    end.setDate(end.getDate() + days);
    const { error } = await supabase.from("subscriptions").insert({
      user_id: u.id, provider: "admin", status: "active", price_amount: 0,
      current_period_end: end.toISOString(), note: "comp by admin",
    });
    if (error) {
      showToast(error.code === "23505" ? "ผู้ใช้นี้มี subscription ใช้งานอยู่แล้ว" : "ผิดพลาด: " + error.message, true);
    } else {
      showToast("✓ เพิ่มสิทธิ์แล้ว");
      setCompEmail("");
      load();
    }
    setCompBusy(false);
  };

  return (
    <div className="p-6 max-w-[720px] flex flex-col gap-8">
      <h1 className="font-heading text-h2 text-black">Subscription</h1>

      {/* Subscription settings */}
      <div className="bg-surface p-6">
        <div className="mb-4">
          <h2 className="font-ui text-ui text-black">ตั้งค่า Subscription</h2>
          <p className="font-body text-footnote text-grey-600 mt-0.5">ราคาแพลนรายเดือน/รายปี และช่วงทดสอบฟรี (฿0)</p>
        </div>
        {subTrialActive && (
          <div className="mb-3 px-4 py-3 bg-mint/20 font-body text-body-sm text-black">
            ⚡ ช่วงทดสอบเปิดอยู่{subTrialEnd ? ` ถึง ${subTrialEnd}` : ""} — สมัครได้ในราคา ฿0
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="font-body font-bold text-body-sm text-grey-600">ราคารายเดือน (฿)</label>
            <input type="number" value={subMonthly} onChange={(e) => setSubMonthly(e.target.value)} className={iCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-body font-bold text-body-sm text-grey-600">ราคารายปี (฿)</label>
            <input type="number" value={subYearly} onChange={(e) => setSubYearly(e.target.value)} className={iCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="flex flex-col gap-1.5">
            <label className="font-body font-bold text-body-sm text-grey-600">เปิดช่วงทดสอบฟรี</label>
            <label className="flex items-center gap-2 h-[38px] px-3 bg-white cursor-pointer">
              <input type="checkbox" checked={subTrialActive} onChange={(e) => setSubTrialActive(e.target.checked)} className="accent-black" />
              <span className="font-body text-body-sm text-black">{subTrialActive ? "กดเพื่อปิด" : "กดเพื่อเปิด"}</span>
            </label>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-body font-bold text-body-sm text-grey-600">วันสิ้นสุดช่วงทดสอบ</label>
            <input type="date" value={subTrialEnd} onChange={(e) => setSubTrialEnd(e.target.value)} className={iCls} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 mt-3">
          <div className="flex flex-col gap-1.5">
            <label className="font-body font-bold text-body-sm text-grey-600">ลิงก์ดาวน์โหลดแอป macOS (.dmg)</label>
            <input type="url" value={subDownMac} onChange={(e) => setSubDownMac(e.target.value)} placeholder="เว้นว่าง = แสดง 'เร็ว ๆ นี้'" className={iCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-body font-bold text-body-sm text-grey-600">ลิงก์ดาวน์โหลดแอป Windows (.msi)</label>
            <input type="url" value={subDownWin} onChange={(e) => setSubDownWin(e.target.value)} placeholder="เว้นว่าง = แสดง 'เร็ว ๆ นี้'" className={iCls} />
          </div>
        </div>
        <Button onClick={saveSubscription} className="w-full mt-4">บันทึกการตั้งค่า Subscription</Button>
      </div>

      {/* สมาชิก */}
      <div className="flex flex-col gap-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-ui text-ui text-black">สมาชิก</h2>
          <span className="font-body text-body-sm text-grey-600">ใช้งานอยู่ {activeCount} · ทั้งหมด {rows.length}</span>
        </div>

        {/* Comp form */}
        <div className="bg-surface p-5">
          <h2 className="font-ui text-ui text-black mb-1">เพิ่มสิทธิ์ (Comp)</h2>
          <p className="font-body text-footnote text-grey-600 mb-3">ให้สิทธิ์ฟรีกับบัญชีทดสอบ — ผู้ใช้ต้องสมัครสมาชิกในเว็บก่อน</p>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <label className="font-body font-bold text-body-sm text-grey-600">อีเมลผู้ใช้</label>
              <input type="email" value={compEmail} onChange={(e) => setCompEmail(e.target.value)} placeholder="user@email.com" className={iCls} />
            </div>
            <div className="flex flex-col gap-1 w-[120px]">
              <label className="font-body font-bold text-body-sm text-grey-600">จำนวนวัน</label>
              <input type="number" value={compDays} onChange={(e) => setCompDays(e.target.value)} className={iCls} />
            </div>
            <Button onClick={addComp} disabled={compBusy}>{compBusy ? "กำลังเพิ่ม…" : "เพิ่มสิทธิ์"}</Button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-surface overflow-hidden">
        {!loaded ? (
          <p className="font-body text-body-sm text-grey-600 p-6">กำลังโหลด…</p>
        ) : rows.length === 0 ? (
          <p className="font-body text-body-sm text-grey-600 p-6">ยังไม่มีสมาชิก</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-body text-body-sm">
              <thead>
                <tr className="text-left bg-white font-heading text-badge text-grey-600 tracking-[0.04em]">
                  <th className="px-4 py-3 font-heading">ผู้ใช้</th>
                  <th className="px-4 py-3 font-heading">แผน</th>
                  <th className="px-4 py-3 font-heading">สถานะ</th>
                  <th className="px-4 py-3 font-heading">ใช้ได้ถึง</th>
                  <th className="px-4 py-3 font-heading text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const active = isSubActive(r);
                  return (
                    <tr key={r.id} className="hover:bg-grey-200 transition-colors duration-150 ease-base">
                      <td className="px-4 py-3">
                        <div className="text-black">{r.users?.name || "—"}</div>
                        <div className="font-body text-footnote text-grey-600">{r.users?.email ?? r.user_id.slice(0, 8)}</div>
                      </td>
                      <td className="px-4 py-3 text-grey-600">{PROVIDER_LABEL[r.provider] ?? r.provider}</td>
                      <td className="px-4 py-3">
                        <span className={`text-badge font-heading px-2 py-0.5 ${active ? "bg-success text-white" : "bg-white text-grey-600"}`}>
                          {active ? "ใช้งาน" : STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-grey-600">{fmtDate(r.current_period_end)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => extend(r)} className="font-body text-footnote text-mint-text hover:underline bg-transparent border-none cursor-pointer p-0">+30 วัน</button>
                          {r.status === "active" && (
                            <button onClick={() => cancel(r)} className="font-body text-footnote text-danger-dark hover:underline bg-transparent border-none cursor-pointer p-0">ยกเลิก</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[200] px-4 py-3 font-body text-body-sm shadow-lg ${toast.error ? "bg-danger text-white" : "bg-black text-white"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

const iCls = "w-full px-3 py-2 bg-white font-body text-body-sm text-black outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black transition-colors duration-150 ease-base";
