"use client";

// ตั้งค่า Subscription (admin): ราคาแพลน · ช่วงทดสอบฟรี · ลิงก์ดาวน์โหลดแอป
//
// รายชื่อสมาชิก / อุปกรณ์ที่ลงทะเบียน / สัญญาณการใช้งาน **ย้ายไป `/admin/members` แล้ว**
// (3 ส.ค. 2569) — หน้านี้เหลือเฉพาะการตั้งค่าซึ่งเป็นฟอร์มแคบ จึงคง max-w-[720px] ไว้

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/Button";
import { DEFAULT_SUB_SETTINGS, parseSubSettings } from "@/lib/subscription";

export default function AdminSubscriptionsPage() {
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);

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
          <div className="mb-3 px-4 py-3 bg-grey-200 font-body text-body-sm text-black">
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
            <label className="flex items-center gap-2 h-[38px] px-3 bg-page cursor-pointer">
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

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[200] px-4 py-3 font-body text-body-sm shadow-lg ${toast.error ? "bg-danger text-white" : "bg-black text-white"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

const iCls = "w-full px-3 py-2 bg-page font-body text-body-sm text-black outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black transition-colors duration-150 ease-base";
