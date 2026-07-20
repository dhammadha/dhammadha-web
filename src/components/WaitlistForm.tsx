"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { supabase } from "@/lib/supabase";

// ฟอร์มลงทะเบียนรอเปิดตัว Subscription — เก็บอีเมลลง subscription_waitlist
// ยอดรายชื่อคือข้อมูลตัดสินใจราคา/จังหวะเปิดบริการ (ดู docs/ROADMAP.md Phase 4)
export default function WaitlistForm() {
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
      <p className="font-body text-body-sm text-success bg-surface px-3.5 py-2.5">
        ✓ ลงทะเบียนแล้ว — เราจะแจ้งคุณทางอีเมลทันทีที่เปิดบริการ
      </p>
    );
  }

  // ช่องกรอก = เหมือนช่องค้นหาบน nav (เหลี่ยม พื้น surface) · ปุ่ม = Button primitive (เหลี่ยม สูงเท่าปุ่ม "ดูฟอนต์ทั้งหมด")
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
          "flex-1 min-w-0 px-3.5 bg-surface font-body text-body-sm text-black placeholder:text-grey-400 outline-none",
          "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-mint",
          status === "error" && "outline outline-2 -outline-offset-2 outline-danger"
        )}
      />
      <Button type="submit" variant="primary" disabled={status === "loading"} className="shrink-0">
        {status === "loading" ? "กำลังส่ง…" : "แจ้งเมื่อเปิดตัว"}
      </Button>
    </form>
  );
}
