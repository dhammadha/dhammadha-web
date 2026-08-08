"use client";

// สมาชิก subscription (admin): รายการสมาชิก · อุปกรณ์ที่ลงทะเบียน · สัญญาณการใช้งานผิดปกติ
//
// แยกออกมาจาก /admin/subscriptions (3 ส.ค. 2569) — หน้านั้นเหลือเฉพาะการ์ดตั้งค่า
// ราคา/trial/ลิงก์แอป · **ใช้ max-w-[720px] เท่ากับหน้า subscription ตามที่เจ้าของกำหนด**
// (ไม่ใช่ 1200px แบบ /admin/orders) ตารางที่กว้างเกินมี overflow-x-auto ครอบอยู่แล้ว
//
// เขียนตรงใต้ RLS: "admin all subscriptions" (0046) และ "admin manage sub devices" (0078)
// ⚠️ การถอนอุปกรณ์ต้องมีทั้ง policy และ table grant — grant อยู่ใน 0079 (เคยพลาดมาแล้ว)

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/Button";
import { isSubActive, type SubscriptionRow } from "@/lib/subscription";
import { fetchAllRows } from "@/lib/fetch-all";

type Row = SubscriptionRow & { users: { email: string | null; name: string | null } | null };

type DeviceRow = {
  id: string;
  user_id: string;
  name: string | null;
  platform: string | null;
  last_seen_at: string | null;
  activated_at: string | null;
  created_at: string;
  users: { email: string | null; name: string | null } | null;
};

/** สรุปการใช้งาน 7 วันล่าสุดต่อผู้ใช้ — ใช้จับคนดูดคลัง */
type UsageRow = {
  userId: string;
  files: number;           // จำนวนไฟล์ที่โหลด
  fontsDownloaded: number; // ฟอนต์ที่ต่างกันที่โหลด
  fontsStreamed: number;   // ฟอนต์ที่ต่างกันที่มี heartbeat จริง
};

const PROVIDER_LABEL: Record<string, string> = {
  trial: "ทดสอบ", stripe: "Stripe", payso: "Payso", admin: "Comp",
};
const STATUS_LABEL: Record<string, string> = {
  active: "ใช้งาน", cancelled: "ยกเลิก", expired: "หมดอายุ",
};

const USAGE_DAYS = 7;
/** โหลดตั้งแต่กี่ฟอนต์ขึ้นไปถึงจะเริ่มสนใจ (ต่ำกว่านี้คือใช้งานปกติ) */
const SUSPICIOUS_MIN_FONTS = 5;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", { year: "2-digit", month: "short", day: "numeric" });
}

export default function AdminMembersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);
  const [compEmail, setCompEmail] = useState("");
  const [compDays, setCompDays] = useState("60");
  const [compBusy, setCompBusy] = useState(false);

  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [usage, setUsage] = useState<UsageRow[]>([]);

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

  // ── อุปกรณ์ + สัญญาณการใช้งานผิดปกติ ──
  // โหลดแยกจากตารางสมาชิกและไม่บล็อกกัน (แพตเทิร์นเดียวกับประวัติดาวน์โหลดใน /admin/orders)
  const loadDevices = useCallback(async () => {
    const since = new Date(Date.now() - USAGE_DAYS * 24 * 3600 * 1000).toISOString();
    const sinceDay = since.slice(0, 10);
    const [devRes, dlRes, sdRes] = await Promise.all([
      fetchAllRows<DeviceRow>((from, to) =>
        supabase
          .from("sub_devices")
          .select("id, user_id, name, platform, last_seen_at, activated_at, created_at, users(email, name)")
          .is("revoked_at", null)
          .order("created_at", { ascending: false })
          .range(from, to) as unknown as PromiseLike<{ data: DeviceRow[] | null; error: unknown }>
      ),
      fetchAllRows<{ user_id: string; font_id: string }>((from, to) =>
        supabase
          .from("sub_download_logs")
          .select("user_id, font_id")
          .gte("created_at", since)
          .range(from, to) as unknown as PromiseLike<{ data: { user_id: string; font_id: string }[] | null; error: unknown }>
      ),
      fetchAllRows<{ user_id: string; font_id: string }>((from, to) =>
        supabase
          .from("stream_days")
          .select("user_id, font_id")
          .gte("day", sinceDay)
          .range(from, to) as unknown as PromiseLike<{ data: { user_id: string; font_id: string }[] | null; error: unknown }>
      ),
    ]);

    setDevices(devRes.rows);

    // สัญญาณหลัก: โหลดฟอนต์ไปเยอะแต่ไม่มี heartbeat = ดึงไฟล์ไปเก็บ ไม่ได้เอาไปใช้จริง
    // ผู้ใช้จริง activate → แอปส่ง heartbeat ของฟอนต์นั้น สองตัวเลขจึงควรใกล้กัน
    const byUser = new Map<string, UsageRow>();
    const get = (id: string) => {
      let u = byUser.get(id);
      if (!u) { u = { userId: id, files: 0, fontsDownloaded: 0, fontsStreamed: 0 }; byUser.set(id, u); }
      return u;
    };
    const dlFonts = new Map<string, Set<string>>();
    for (const r of dlRes.rows) {
      get(r.user_id).files++;
      if (!dlFonts.has(r.user_id)) dlFonts.set(r.user_id, new Set());
      dlFonts.get(r.user_id)!.add(r.font_id);
    }
    const sdFonts = new Map<string, Set<string>>();
    for (const r of sdRes.rows) {
      if (!sdFonts.has(r.user_id)) sdFonts.set(r.user_id, new Set());
      sdFonts.get(r.user_id)!.add(r.font_id);
    }
    for (const [id, set] of dlFonts) get(id).fontsDownloaded = set.size;
    for (const [id, set] of sdFonts) get(id).fontsStreamed = set.size;
    setUsage([...byUser.values()].sort((a, b) => b.fontsDownloaded - a.fontsDownloaded));
  }, []);

  useEffect(() => { loadDevices(); }, [loadDevices]);

  const activeCount = rows.filter((r) => isSubActive(r)).length;

  // เครื่องที่ถือสิทธิ์ใช้งานของแต่ละคน = activated_at ใหม่ที่สุด (ตรรกะเดียวกับ
  // activeDevice() ใน Edge Function — ที่นั่นเป็นตัวจริง ที่นี่แค่แสดงผล)
  const activeDeviceByUser = new Map<string, string>();
  for (const d of devices) {
    if (!d.activated_at) continue;
    const cur = activeDeviceByUser.get(d.user_id);
    const curAt = cur ? devices.find((x) => x.id === cur)?.activated_at : null;
    if (!cur || (curAt && d.activated_at > curAt)) activeDeviceByUser.set(d.user_id, d.id);
  }

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

  const revokeDevice = async (d: DeviceRow) => {
    if (!confirm(`ถอนการลงทะเบียน "${d.name || "ไม่ระบุชื่อ"}" ของ ${d.users?.email ?? d.user_id.slice(0, 8)}?\n\nเครื่องนี้จะเรียกใช้ฟอนต์ไม่ได้ทันที`)) return;
    const { error } = await supabase
      .from("sub_devices")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", d.id);
    if (error) showToast("ผิดพลาด: " + error.message, true);
    else { showToast("✓ ถอนอุปกรณ์แล้ว"); loadDevices(); }
  };

  return (
    <div className="p-6 max-w-[720px] flex flex-col gap-8">
      <h1 className="font-ui text-h2 text-black">Members</h1>

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
                <tr className="text-left bg-page font-ui text-badge text-grey-600 tracking-[0.04em]">
                  <th className="px-4 py-3 font-ui">ผู้ใช้</th>
                  <th className="px-4 py-3 font-ui">แผน</th>
                  <th className="px-4 py-3 font-ui">สถานะ</th>
                  <th className="px-4 py-3 font-ui">ใช้ได้ถึง</th>
                  <th className="px-4 py-3 font-ui text-right">จัดการ</th>
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
                        <span className={`text-badge font-ui px-2 py-0.5 ${active ? "bg-success text-white" : "bg-page text-grey-600"}`}>
                          {active ? "ใช้งาน" : STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-grey-600">{fmtDate(r.current_period_end)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => extend(r)} className="font-body text-footnote link-accent hover:underline bg-transparent border-none cursor-pointer p-0">+30 วัน</button>
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

      {/* อุปกรณ์ที่ลงทะเบียน */}
      <div className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-ui text-ui text-black">อุปกรณ์ที่ลงทะเบียน</h2>
          <span className="font-body text-body-sm text-grey-600">{devices.length} เครื่อง (สูงสุด 2 ต่อบัญชี)</span>
        </div>
        <p className="font-body text-footnote text-grey-600">
          ลงทะเบียนได้ 2 เครื่องแต่ <strong>ใช้งานได้ทีละเครื่อง</strong> —
          เปิดแอปเครื่องไหนเครื่องนั้นได้สิทธิ์ไป อีกเครื่องฟอนต์จะดับแต่ไฟล์ยังอยู่
          สลับกลับไม่ต้องโหลดใหม่ · เครื่องที่ถูกถอนจะเรียกใช้ฟอนต์ไม่ได้ทันที
          และสล็อตจะว่างให้ลงทะเบียนเครื่องใหม่
        </p>
        <div className="bg-surface overflow-hidden">
          {devices.length === 0 ? (
            <p className="font-body text-body-sm text-grey-600 p-6">ยังไม่มีอุปกรณ์ลงทะเบียน</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full font-body text-body-sm">
                <thead>
                  <tr className="text-left bg-page font-ui text-badge text-grey-600 tracking-[0.04em]">
                    <th className="px-4 py-3 font-ui">ผู้ใช้</th>
                    <th className="px-4 py-3 font-ui">เครื่อง</th>
                    <th className="px-4 py-3 font-ui">ใช้ล่าสุด</th>
                    <th className="px-4 py-3 font-ui text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((d) => {
                    const holding = activeDeviceByUser.get(d.user_id) === d.id;
                    return (
                      <tr key={d.id} className="hover:bg-grey-200 transition-colors duration-150 ease-base">
                        <td className="px-4 py-3">
                          <div className="text-black">{d.users?.name || "—"}</div>
                          <div className="font-body text-footnote text-grey-600">{d.users?.email ?? d.user_id.slice(0, 8)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-black flex items-center gap-2">
                            {d.name || "ไม่ระบุชื่อ"}
                            {holding && (
                              <span className="text-badge font-ui px-2 py-0.5 bg-black text-page">ถือสิทธิ์อยู่</span>
                            )}
                          </div>
                          <div className="font-body text-footnote text-grey-600">{d.platform ?? "—"} · ลงทะเบียน {fmtDate(d.created_at)}</div>
                        </td>
                        <td className="px-4 py-3 text-grey-600">{d.last_seen_at ? fmtDate(d.last_seen_at) : "ยังไม่เคยใช้"}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => revokeDevice(d)} className="font-body text-footnote text-danger-dark hover:underline bg-transparent border-none cursor-pointer p-0">ถอน</button>
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

      {/* สัญญาณการใช้งานผิดปกติ */}
      <div className="flex flex-col gap-4">
        <h2 className="font-ui text-ui text-black">การใช้งาน {USAGE_DAYS} วันล่าสุด</h2>
        <p className="font-body text-footnote text-grey-600">
          ผู้ใช้จริงกด activate แล้วแอปจะส่งสัญญาณการใช้งานของฟอนต์นั้น{" "}
          <strong>สองตัวเลขจึงควรใกล้กัน</strong> — ถ้าโหลดไปเยอะแต่แทบไม่มีการใช้งานจริง
          แปลว่าดึงไฟล์ไปเก็บ ไม่ได้เอาไปใช้ · ตรวจแล้วผิดปกติให้ถอนอุปกรณ์ด้านบน
          หรือยกเลิกสมาชิกในตารางแรก
        </p>
        <div className="bg-surface overflow-hidden">
          {usage.length === 0 ? (
            <p className="font-body text-body-sm text-grey-600 p-6">ยังไม่มีการใช้งานในช่วงนี้</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full font-body text-body-sm">
                <thead>
                  <tr className="text-left bg-page font-ui text-badge text-grey-600 tracking-[0.04em]">
                    <th className="px-4 py-3 font-ui">ผู้ใช้</th>
                    <th className="px-4 py-3 font-ui text-right">ไฟล์ที่โหลด</th>
                    <th className="px-4 py-3 font-ui text-right">ฟอนต์ที่โหลด</th>
                    <th className="px-4 py-3 font-ui text-right">ฟอนต์ที่ใช้จริง</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.map((u) => {
                    const dev = devices.find((d) => d.user_id === u.userId);
                    // น่าสงสัยเมื่อโหลดฟอนต์ไปหลายตัวแต่ใช้จริงไม่ถึงครึ่ง
                    const suspicious =
                      u.fontsDownloaded >= SUSPICIOUS_MIN_FONTS &&
                      u.fontsStreamed * 2 < u.fontsDownloaded;
                    return (
                      <tr key={u.userId} className={suspicious ? "bg-danger/10" : ""}>
                        <td className="px-4 py-3">
                          <div className="text-black">{dev?.users?.email ?? u.userId.slice(0, 8)}</div>
                          {suspicious && (
                            <div className="font-ui text-badge text-danger-dark tracking-[0.04em] mt-0.5">
                              ⚠ โหลดมากแต่ใช้จริงน้อย
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-grey-600">{u.files}</td>
                        <td className="px-4 py-3 text-right text-grey-600">{u.fontsDownloaded}</td>
                        <td className="px-4 py-3 text-right text-grey-600">{u.fontsStreamed}</td>
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

const iCls = "w-full px-3 py-2 bg-page font-body text-body-sm text-black outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black transition-colors duration-150 ease-base";
