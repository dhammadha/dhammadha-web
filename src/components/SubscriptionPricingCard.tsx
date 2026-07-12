"use client";

// การ์ด Subscription ในส่วน "ราคาและแผนบริการ" หน้าแรก
// ช่วงทดสอบเปิด → ปุ่มไป /subscribe / ช่วงปิด → ฟอร์ม waitlist เดิม

import { useEffect, useState } from "react";
import Link from "next/link";
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
    <div className="p-5 border border-[0.25px] border-[#ddd] rounded-[10px] bg-white flex flex-col">
      <span className="self-start text-[10px] bg-mint-light text-[#0a8a84] px-2.5 py-0.5 rounded-full border border-[0.5px] border-mint-mid mb-2.5">
        {trialOpen ? "เปิดให้ทดสอบฟรี" : "เร็ว ๆ นี้"}
      </span>
      <div className="text-[26px] font-semibold text-navy leading-[1.2]">Subscription รายเดือน</div>
      <div className="text-[26px] font-semibold text-navy leading-[1.2]">
        {trialOpen ? (
          <>
            <span className="text-[#bbb] line-through text-[20px] mr-2">฿{settings?.monthly_price.toLocaleString()}</span>฿0 / เดือน
          </>
        ) : (
          "กำลังจะเปิดตัว"
        )}
      </div>
      <div className="text-[12px] text-[#aaa] mt-2.5 mb-2.5">เข้าถึงฟอนต์ทุกชุดที่ร่วมแพลน · ยกเลิกได้ทุกเมื่อ</div>
      <div className="text-[12px] text-[#666] leading-[1.65] flex-1 mb-4">
        {trialOpen
          ? "ช่วงทดสอบเปิดให้ใช้ฟรี — activate ฟอนต์ผ่านแอปบนเครื่องของคุณ"
          : "ลงทะเบียนรับข่าว แล้วเราจะแจ้งคุณเป็นคนแรกพร้อมสิทธิพิเศษช่วงเปิดตัว"}
      </div>
      {trialOpen ? (
        <Link
          href="/subscribe/"
          className="block w-full py-2.5 text-center rounded-[6px] text-[14px] font-medium text-white bg-mint border border-mint no-underline hover:bg-navy hover:border-navy transition-all"
        >
          เริ่มใช้ฟรีช่วงทดสอบ
        </Link>
      ) : (
        <WaitlistForm />
      )}
    </div>
  );
}
