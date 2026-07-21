"use client";

// การ์ดสถานะ subscription ในหน้าบัญชี — แสดงแผนปัจจุบัน วันหมดอายุ และลิงก์โหลดแอป
// การสมัคร/ต่ออายุ/ชำระเงิน อยู่ที่หน้า /subscribe

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
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
    <section className="mt-10">
      <div className="bg-surface p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-heading text-h2 text-black">Subscription</h2>
          {active ? (
            <Badge variant="free">ใช้งานอยู่</Badge>
          ) : (
            <Badge variant="tag">ยังไม่ได้สมัคร</Badge>
          )}
        </div>

        {active && sub ? (
          <>
            <div className="grid grid-cols-[120px_1fr] gap-y-2.5 mb-4">
              <span className="font-body text-body-sm text-grey-600">แผน</span>
              <span className="font-body text-body text-black">{PROVIDER_LABEL[sub.provider] ?? sub.provider}</span>
              <span className="font-body text-body-sm text-grey-600">ใช้ได้ถึง</span>
              <span className="font-body text-body text-black">{fmtDate(sub.current_period_end)}</span>
            </div>

            <div className="pt-4">
              <p className="font-body text-body-sm text-grey-600 mb-2.5">ดาวน์โหลดแอปเพื่อ activate ฟอนต์บนเครื่องของคุณ</p>
              <div className="flex flex-wrap gap-2">
                {settings?.download_mac ? (
                  <Button as="a" href={settings.download_mac} variant="outline" size="sm">
                    ดาวน์โหลดสำหรับ macOS
                  </Button>
                ) : (
                  <span className="font-body text-body-sm text-grey-400 bg-grey-200 px-3.5 py-2">macOS — เร็ว ๆ นี้</span>
                )}
                {settings?.download_win ? (
                  <Button as="a" href={settings.download_win} variant="outline" size="sm">
                    ดาวน์โหลดสำหรับ Windows
                  </Button>
                ) : (
                  <span className="font-body text-body-sm text-grey-400 bg-grey-200 px-3.5 py-2">Windows — เร็ว ๆ นี้</span>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="font-body text-body text-grey-800">สมัคร subscription เพื่อใช้ฟอนต์ทุกตัวผ่านแอป</p>
            <Button as="link" href="/subscribe/" size="sm" className="flex-shrink-0">
              ดูแผนบริการ
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
