"use client";

import { useState } from "react";
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
      <p className="text-[13px] text-[#0a8a84] bg-mint-light border border-[0.5px] border-mint-mid rounded-[8px] px-3.5 py-2.5">
        ✓ ลงทะเบียนแล้ว — เราจะแจ้งคุณทางอีเมลทันทีที่เปิดบริการ
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        type="email"
        value={email}
        onChange={(e) => { setEmail(e.target.value); if (status === "error") setStatus("idle"); }}
        placeholder="your@email.com"
        required
        className={`flex-1 min-w-0 px-3.5 py-2.5 border border-[0.5px] rounded-[8px] text-[13px] text-navy outline-none focus:border-mint transition-colors bg-white ${status === "error" ? "border-[#e74c3c]" : "border-[#ddd]"}`}
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="shrink-0 px-4 py-2.5 rounded-[8px] bg-navy text-white text-[13px] font-medium border-none cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {status === "loading" ? "กำลังส่ง…" : "แจ้งเมื่อเปิดตัว"}
      </button>
    </form>
  );
}
