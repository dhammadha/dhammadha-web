"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Button from "@/components/Button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // redirectTo ต้องลงท้ายด้วย / เพราะ next.config ตั้ง trailingSlash: true
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password/`,
    });
    // ขึ้นข้อความเดียวกันเสมอ ไม่ว่าอีเมลนี้จะมีในระบบหรือไม่ และไม่สนใจ error —
    // ถ้าแยกกรณี จะกลายเป็นเครื่องมือให้คนนอกไล่เช็คว่าอีเมลไหนสมัครไว้บ้าง
    setSent(true);
    setLoading(false);
  };

  return (
    <>
      <Nav />
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="w-full max-w-[400px]">
          <div className="bg-white rounded-2xl shadow-sm border border-border p-8">
            <h1 className="text-[20px] font-semibold text-navy mb-2">ลืมพาสเวิร์ด</h1>

            {sent ? (
              <>
                <p className="text-[13px] text-[#666] leading-[1.7] mt-4">
                  ถ้ามีบัญชีที่ใช้อีเมล <b className="text-navy">{email}</b> อยู่ในระบบ
                  เราได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้แล้ว — กรุณาตรวจสอบกล่องจดหมาย (รวมถึงโฟลเดอร์ Junk/Spam)
                </p>
                <p className="text-[12px] text-[#aaa] leading-[1.7] mt-3">
                  ลิงก์มีอายุจำกัด หากหมดอายุแล้วให้ขอใหม่อีกครั้ง
                </p>
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="text-[13px] text-mint bg-transparent border-none cursor-pointer hover:underline p-0 mt-4 font-[inherit]"
                >
                  ส่งอีกครั้ง / เปลี่ยนอีเมล
                </button>
              </>
            ) : (
              <>
                <p className="text-[13px] text-[#aaa] mb-6 leading-[1.7]">
                  กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้
                </p>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] text-[#555] font-medium">อีเมล</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="px-4 py-2.5 rounded-xl border border-border bg-[#fafaf8] text-[14px] text-navy outline-none focus:border-mint focus:shadow-[0_0_0_3px_#5ECEC820] transition-all font-[inherit]"
                      placeholder="your@email.com"
                    />
                  </div>

                  <Button type="submit" disabled={loading} size="lg" className="mt-2 w-full">
                    {loading ? "กำลังส่ง…" : "ส่งลิงก์ตั้งรหัสผ่านใหม่"}
                  </Button>
                </form>
              </>
            )}

            <p className="text-center text-[13px] text-[#aaa] mt-6">
              <Link href="/auth/login" className="text-mint no-underline hover:underline">
                กลับไปหน้าเข้าสู่ระบบ
              </Link>
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
