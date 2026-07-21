"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import AuthShell from "@/components/auth/AuthShell";
import { FIELD, LABEL } from "@/components/form/field";
import Button from "@/components/ui/Button";

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
    <AuthShell title="ลืมพาสเวิร์ด">
      {sent ? (
        <>
          <p className="font-body text-body text-grey-800 leading-[1.8]">
            ถ้ามีบัญชีที่ใช้อีเมล <b className="text-black">{email}</b> อยู่ในระบบ
            เราได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้แล้ว — กรุณาตรวจสอบกล่องจดหมาย (รวมถึงโฟลเดอร์ Junk/Spam)
          </p>
          <p className="font-body text-body-sm text-grey-600 leading-[1.8] mt-3">
            ลิงก์มีอายุจำกัด หากหมดอายุแล้วให้ขอใหม่อีกครั้ง
          </p>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="font-body text-body-sm text-mint-text bg-transparent border-none cursor-pointer hover:underline p-0 mt-4"
          >
            ส่งอีกครั้ง / เปลี่ยนอีเมล
          </button>
        </>
      ) : (
        <>
          <p className="font-body text-body-sm text-grey-600 mb-6 leading-[1.8]">
            กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className={LABEL}>อีเมล</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className={FIELD}
                placeholder="your@email.com"
              />
            </div>

            <Button type="submit" disabled={loading} size="lg" className="mt-2 w-full">
              {loading ? "กำลังส่ง…" : "ส่งลิงก์ตั้งรหัสผ่านใหม่"}
            </Button>
          </form>
        </>
      )}

      <p className="text-center font-body text-body-sm text-grey-600 mt-6">
        <Link href="/auth/login" className="text-mint-text no-underline hover:underline">
          กลับไปหน้าเข้าสู่ระบบ
        </Link>
      </p>
    </AuthShell>
  );
}
