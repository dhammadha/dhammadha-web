"use client";

// การ์ด Subscription ในส่วน "ราคาและแผนบริการ" หน้าแรก
// ช่วงทดสอบเปิด → ปุ่มไป /subscribe / ช่วงปิด → ฟอร์ม waitlist เดิม

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import WaitlistForm from "@/components/WaitlistForm";
import { isTrialOpen, parseSubSettings, type SubscriptionSettings } from "@/lib/subscription";

export default function SubscriptionPricingCard() {
  const [settings, setSettings] = useState<SubscriptionSettings | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase
      .from("settings")
      .select("value")
      .eq("key", "subscription")
      .maybeSingle()
      .then(({ data }) => {
        setSettings(data ? parseSubSettings(data.value) : parseSubSettings(null));
        setLoaded(true);
      });
  }, []);

  const trialOpen = loaded && isTrialOpen(settings);

  return (
    <div className="p-5 bg-surface flex flex-col">
      <div className="font-heading text-h2 text-black">Subscription รายเดือน</div>
      <div className="font-heading text-h2 text-black">
        {trialOpen ? (
          <>
            <span className="text-grey-400 line-through mr-2">฿{settings?.monthly_price.toLocaleString()}</span>฿0 / เดือน
          </>
        ) : (
          "กำลังจะเปิดตัว"
        )}
      </div>
      <div className="font-body text-body-sm text-grey-600 mt-2.5 mb-2.5">เข้าถึงฟอนต์ทุกชุดที่ร่วมแพลน · ยกเลิกได้ทุกเมื่อ</div>
      <div className="font-body text-body-sm text-grey-600 flex-1 mb-4">
        {trialOpen
          ? "ช่วงทดสอบเปิดให้ใช้ฟรี — activate ฟอนต์ผ่านแอปบนเครื่องของคุณ"
          : "ลงทะเบียนรับข่าว แล้วเราจะแจ้งคุณเป็นคนแรกพร้อมสิทธิพิเศษช่วงเปิดตัว"}
      </div>
      {trialOpen ? (
        <Button as="link" href="/subscribe/" variant="primary" className="w-full">
          เริ่มใช้ฟรีช่วงทดสอบ
        </Button>
      ) : (
        <WaitlistForm />
      )}
    </div>
  );
}
