"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Button from "@/components/Button";

// ปลายทางของลิงก์ "ลืมพาสเวิร์ด" ในอีเมล
//
// เว็บ build เป็น static export จึงไม่มี server มาแลก token ให้ — ต้องพึ่ง
// detectSessionInUrl ของ supabase-js (เปิดโดย default) ที่อ่าน token จาก URL
// แล้วสร้าง session ให้ตอน client boot จากนั้นค่อยเรียก updateUser ตามปกติ
export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState<"checking" | "ready" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // ดักไว้สองทาง: event PASSWORD_RECOVERY (ยิงตอนแลก token เสร็จ) และ getSession()
    // ซึ่ง supabase-js จะรอ initialize (รวมขั้นตอนอ่าน token จาก URL) ให้ก่อนคืนค่า
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setReady("ready");
    });
    supabase.auth.getSession().then(({ data }) => {
      setReady(data.session ? "ready" : "invalid");
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("รหัสผ่านไม่ตรงกัน"); return; }
    if (password.length < 8) { setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }
    setDone(true);
    setSaving(false);
    setTimeout(() => router.push("/account"), 1500);
  };

  return (
    <>
      <Nav />
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="w-full max-w-[400px]">
          <div className="bg-white rounded-2xl shadow-sm border border-border p-8">
            <h1 className="text-[20px] font-semibold text-navy mb-2">ตั้งรหัสผ่านใหม่</h1>

            {ready === "checking" && (
              <p className="text-[13px] text-[#aaa] mt-4">กำลังตรวจสอบลิงก์…</p>
            )}

            {ready === "invalid" && (
              <>
                <p className="text-[13px] text-[#666] leading-[1.7] mt-4">
                  ลิงก์นี้ใช้ไม่ได้หรือหมดอายุแล้ว — กรุณาขอลิงก์ตั้งรหัสผ่านใหม่อีกครั้ง
                </p>
                <Link href="/auth/forgot-password" className="block mt-5">
                  <Button size="lg" className="w-full">ขอลิงก์ใหม่</Button>
                </Link>
              </>
            )}

            {ready === "ready" && done && (
              <p className="text-[13px] text-[#666] leading-[1.7] mt-4">
                ✓ เปลี่ยนรหัสผ่านเรียบร้อยแล้ว กำลังพาไปหน้าบัญชี…
              </p>
            )}

            {ready === "ready" && !done && (
              <>
                <p className="text-[13px] text-[#aaa] mb-6 leading-[1.7]">
                  ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ (อย่างน้อย 8 ตัวอักษร)
                </p>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] text-[#555] font-medium">รหัสผ่านใหม่</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      className="px-4 py-2.5 rounded-xl border border-border bg-[#fafaf8] text-[14px] text-navy outline-none focus:border-mint focus:shadow-[0_0_0_3px_#5ECEC820] transition-all font-[inherit]"
                      placeholder="••••••••"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] text-[#555] font-medium">ยืนยันรหัสผ่านใหม่</label>
                    <input
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      autoComplete="new-password"
                      className="px-4 py-2.5 rounded-xl border border-border bg-[#fafaf8] text-[14px] text-navy outline-none focus:border-mint focus:shadow-[0_0_0_3px_#5ECEC820] transition-all font-[inherit]"
                      placeholder="••••••••"
                    />
                  </div>

                  {error && (
                    <p className="text-[13px] text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
                  )}

                  <Button type="submit" disabled={saving} size="lg" className="mt-2 w-full">
                    {saving ? "กำลังบันทึก…" : "บันทึกรหัสผ่านใหม่"}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
