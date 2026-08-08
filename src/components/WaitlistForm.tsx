"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { supabase } from "@/lib/supabase";

// ฟอร์มลงทะเบียนรอเปิดตัว Subscription — เก็บอีเมลลง subscription_waitlist
// ยอดรายชื่อคือข้อมูลตัดสินใจราคา/จังหวะเปิดบริการ (ดู docs/ROADMAP.md Phase 4)
//
// 🔑 `on` = พื้นที่ฟอร์ม**วางอยู่บน** ไม่ใช่สีของช่องกรอก — ช่องกรอกเอาสีตรงข้ามเสมอ
//    ฟอร์มนี้ถูกใช้สองที่ที่พื้นต่างกัน: การ์ดในหน้าแรก (surface) กับหน้า /subscribe (page)
//    ถ้าฮาร์ดโค้ดสีเดียว อีกที่จะกลายเป็นช่องล่องหน — เคยเป็นมาแล้วทั้งสองฝั่ง
//    ⚠️ ต้อง**เลือก**คลาสพื้น ห้ามต่อท้าย เพราะ `cn()` ไม่ merge คลาสที่ชนกัน
type On = "surface" | "page";
const FIELD_BG: Record<On, string> = { surface: "bg-page", page: "bg-surface" };

export default function WaitlistForm({ on = "surface" }: { on?: On }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setStatus("error"); return; }
    setStatus("loading");
    const { error } = await supabase
      .from("subscription_waitlist")
      .insert({ email: email.trim().toLowerCase() });
    // อีเมลซ้ำ (23505) = เคยลงทะเบียนแล้ว ถือว่าสำเร็จเหมือนกัน
    if (error && error.code !== "23505") { setStatus("error"); return; }
    setStatus("done");
  }

  if (status === "done") {
    return (
      <p className={cn("font-body text-body-sm text-success px-3.5 py-2.5", FIELD_BG[on])}>
        ✓ ลงทะเบียนแล้ว — เราจะแจ้งคุณทางอีเมลทันทีที่เปิดบริการ
      </p>
    );
  }

  // ช่องกรอก = เหลี่ยม พื้นตรงข้ามกับที่ฟอร์มวางอยู่ (ดู FIELD_BG หัวไฟล์)
  // ปุ่ม = Button primitive (เหลี่ยม สูงเท่าปุ่ม "ดูฟอนต์ทั้งหมด")
  // items-stretch → ช่องกรอกยืดสูงเท่าปุ่มอัตโนมัติ (เจ้าของ 2026-07-18)
  return (
    <form onSubmit={submit} className="flex items-stretch gap-2">
      <input
        type="email"
        value={email}
        onChange={(e) => { setEmail(e.target.value); if (status === "error") setStatus("idle"); }}
        placeholder="your@email.com"
        required
        className={cn(
          "flex-1 min-w-0 px-3.5 font-body text-body-sm text-black placeholder:text-grey-400 outline-none",
          FIELD_BG[on],
          "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-orange-text",
          status === "error" && "outline outline-2 -outline-offset-2 outline-danger"
        )}
      />
      <Button type="submit" variant="primary" disabled={status === "loading"} className="shrink-0">
        {status === "loading" ? "กำลังส่ง…" : "แจ้งเมื่อเปิดตัว"}
      </Button>
    </form>
  );
}
