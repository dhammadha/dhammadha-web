"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AuthShell from "@/components/auth/AuthShell";
import { FIELD, LABEL } from "@/components/form/field";
import Button from "@/components/ui/Button";

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
    <AuthShell title="ตั้งรหัสผ่านใหม่">
      {ready === "checking" && (
        <p className="font-body text-body-sm text-grey-600">กำลังตรวจสอบลิงก์…</p>
      )}

      {ready === "invalid" && (
        <>
          <p className="font-body text-body text-grey-800 leading-[1.8]">
            ลิงก์นี้ใช้ไม่ได้หรือหมดอายุแล้ว — กรุณาขอลิงก์ตั้งรหัสผ่านใหม่อีกครั้ง
          </p>
          <Link href="/auth/forgot-password" className="block mt-5">
            <Button size="lg" className="w-full">ขอลิงก์ใหม่</Button>
          </Link>
        </>
      )}

      {ready === "ready" && done && (
        <p className="font-body text-body text-grey-800 leading-[1.8]">
          ✓ เปลี่ยนรหัสผ่านเรียบร้อยแล้ว กำลังพาไปหน้าบัญชี…
        </p>
      )}

      {ready === "ready" && !done && (
        <>
          <p className="font-body text-body-sm text-grey-600 mb-6 leading-[1.8]">
            ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ (อย่างน้อย 8 ตัวอักษร)
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className={LABEL}>รหัสผ่านใหม่</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className={FIELD}
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className={LABEL}>ยืนยันรหัสผ่านใหม่</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                className={FIELD}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="font-body text-body-sm text-danger-dark">{error}</p>
            )}

            <Button type="submit" disabled={saving} size="lg" className="mt-2 w-full">
              {saving ? "กำลังบันทึก…" : "บันทึกรหัสผ่านใหม่"}
            </Button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
