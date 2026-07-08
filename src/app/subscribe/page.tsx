"use client";

import { useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

const features = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-navy">
        <path d="M4 7h16M4 12h10M4 17h7" />
      </svg>
    ),
    title: "ฟอนต์ครบทุกตัว",
    desc: "เข้าถึงฟอนต์ทุกชุดในคลังโดยไม่มีข้อจำกัด",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-navy">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    title: "ใช้งานได้ทันที",
    desc: "ดาวน์โหลดและติดตั้งได้ทันทีหลังสมัครสมาชิก",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-navy">
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
    ),
    title: "อัปเดตอัตโนมัติ",
    desc: "ได้รับฟอนต์ใหม่และ version อัปเดตโดยอัตโนมัติ",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-navy">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      </svg>
    ),
    title: "ใช้เชิงพาณิชย์",
    desc: "ลิขสิทธิ์ครอบคลุมงานส่วนตัวและเชิงพาณิชย์",
  },
];

export default function SubscribePage() {
  const [email, setEmail] = useState("");
  const [note, setNote] = useState({ text: "กรอกอีเมลเพื่อรับการแจ้งเตือนเมื่อเปิดให้บริการ", color: "#aaa" });

  function submit() {
    if (!email || !email.includes("@")) {
      setNote({ text: "กรุณากรอกอีเมลที่ถูกต้อง", color: "#e74c3c" });
      return;
    }
    setNote({ text: "✓ รับทราบแล้ว! เราจะแจ้งเตือนคุณเมื่อพร้อม", color: "#0a8a84" });
    setEmail("");
  }

  return (
    <>
      <Nav />
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center bg-bg px-8 py-16">
        <div className="max-w-[560px] w-full text-center">
          <span className="inline-block text-[11px] font-semibold tracking-[0.08em] text-mint bg-mint-light border border-[0.5px] border-mint-mid rounded-full px-3.5 py-1 mb-6 uppercase">
            Coming Soon
          </span>
          <h1 className="text-[40px] font-semibold text-navy leading-[1.15] mb-4 tracking-[-0.5px]">
            ฟอนต์ไทยไม่จำกัด<br />ด้วย <em className="text-mint not-italic">Subscription</em>
          </h1>
          <p className="text-[15px] text-[#666] leading-[1.7] mb-9">
            เข้าถึงฟอนต์ทุกตัวในคลังด้วยแพลนรายเดือน<br />
            ไม่ต้องซื้อทีละชุด ใช้ได้ทันที อัปเดตตลอดเวลา
          </p>

          <div className="flex gap-2.5 max-w-[420px] mx-auto mb-5">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="อีเมลของคุณ"
              className="flex-1 px-4 py-3 border border-[0.5px] border-[#ddd] rounded-[9px] text-[14px] outline-none focus:border-mint transition-colors"
            />
            <button
              onClick={submit}
              className="px-[22px] py-3 bg-mint text-white border-none rounded-[9px] text-[14px] font-medium cursor-pointer whitespace-nowrap hover:bg-navy transition-colors"
            >
              แจ้งเตือนฉัน
            </button>
          </div>
          <p className="text-[12px]" style={{ color: note.color }}>{note.text}</p>

          <div className="grid grid-cols-2 gap-3 mt-12 text-left">
            {features.map((f) => (
              <div key={f.title} className="bg-white rounded-[10px] p-5 border border-[0.5px] border-border">
                <div className="mb-2">{f.icon}</div>
                <div className="text-[13px] font-semibold text-navy mb-1">{f.title}</div>
                <div className="text-[12px] text-[#888] leading-[1.6]">{f.desc}</div>
              </div>
            ))}
          </div>

          <Link
            href="/"
            className="inline-flex items-center justify-center gap-1.5 text-[13px] text-[#888] no-underline mt-8 hover:text-navy transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            กลับหน้าแรก
          </Link>
        </div>
      </div>
      <Footer />
    </>
  );
}
