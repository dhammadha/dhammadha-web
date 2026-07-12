"use client";

// การ์ดสถานะ subscription ในหน้าบัญชี — แสดงแผนปัจจุบัน วันหมดอายุ และลิงก์โหลดแอป
// การสมัคร/ต่ออายุ/ชำระเงิน อยู่ที่หน้า /subscribe

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import {
  isSubActive,
  parseSubSettings,
  type SubscriptionRow,
  type SubscriptionSettings,
} from "@/lib/subscription";

const PROVIDER_LABEL: Record<string, string> = {
  trial: "ช่วงทดสอบ (ฟรี)",
  stripe: "รายเดือน",
  payso: "รายเดือน",
  admin: "สิทธิ์พิเศษ",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
}

export default function SubscriptionCard() {
  const { user } = useAuth();
  const [sub, setSub] = useState<SubscriptionRow | null>(null);
  const [settings, setSettings] = useState<SubscriptionSettings | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("subscriptions").select("*").eq("status", "active").order("current_period_end", { ascending: false }),
      supabase.from("settings").select("value").eq("key", "subscription").maybeSingle(),
    ]).then(([subRes, setRes]) => {
      const rows = (subRes.data as SubscriptionRow[]) ?? [];
      setSub(rows.find((r) => isSubActive(r)) ?? null);
      setSettings(setRes.data ? parseSubSettings(setRes.data.value) : null);
      setLoaded(true);
    });
  }, [user]);

  if (!user || !loaded) return null;

  const active = isSubActive(sub);

  return (
    <section className="mt-6">
      <div className="bg-white rounded-2xl border border-border p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-[18px] font-semibold text-navy">Subscription</h2>
          {active ? (
            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-mint-light text-mint border border-mint-mid">
              ใช้งานอยู่
            </span>
          ) : (
            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#f5f5f2] text-[#888]">
              ยังไม่ได้สมัคร
            </span>
          )}
        </div>

        {active && sub ? (
          <>
            <div className="grid grid-cols-[120px_1fr] gap-y-2.5 text-[14px] mb-4">
              <span className="text-[#aaa]">แผน</span>
              <span className="text-navy">{PROVIDER_LABEL[sub.provider] ?? sub.provider}</span>
              <span className="text-[#aaa]">ใช้ได้ถึง</span>
              <span className="text-navy">{fmtDate(sub.current_period_end)}</span>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-[13px] text-[#666] mb-2.5">ดาวน์โหลดแอปเพื่อ activate ฟอนต์บนเครื่องของคุณ</p>
              <div className="flex flex-wrap gap-2">
                {settings?.download_mac ? (
                  <a href={settings.download_mac} className="text-[13px] font-medium text-navy no-underline border border-[0.5px] border-navy rounded-[8px] px-3.5 py-2 hover:bg-navy hover:text-white transition-colors">
                    ดาวน์โหลดสำหรับ macOS
                  </a>
                ) : (
                  <span className="text-[13px] text-[#aaa] border border-[0.5px] border-border rounded-[8px] px-3.5 py-2">macOS — เร็ว ๆ นี้</span>
                )}
                {settings?.download_win ? (
                  <a href={settings.download_win} className="text-[13px] font-medium text-navy no-underline border border-[0.5px] border-navy rounded-[8px] px-3.5 py-2 hover:bg-navy hover:text-white transition-colors">
                    ดาวน์โหลดสำหรับ Windows
                  </a>
                ) : (
                  <span className="text-[13px] text-[#aaa] border border-[0.5px] border-border rounded-[8px] px-3.5 py-2">Windows — เร็ว ๆ นี้</span>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-[14px] text-[#666]">สมัคร subscription เพื่อใช้ฟอนต์ทุกตัวผ่านแอป</p>
            <Link
              href="/subscribe/"
              className="flex-shrink-0 text-[13px] font-medium text-white no-underline bg-mint hover:bg-navy rounded-[8px] px-4 py-2 transition-colors"
            >
              ดูแผนบริการ
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
