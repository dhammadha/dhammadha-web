"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import Button from "@/components/Button";

const iCls =
  "px-4 py-2.5 rounded-xl border border-border bg-[#fafaf8] text-[14px] text-navy outline-none focus:border-mint focus:shadow-[0_0_0_3px_#5ECEC820] transition-all font-[inherit]";

export default function AccountSettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/auth/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("users")
      .select("name, phone")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        setName(data?.name ?? "");
        setPhone(data?.phone ?? "");
        setLoadingProfile(false);
      });
  }, [user]);

  const showToast = (msg: string, error = false) => {
    setToast({ msg, error });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("users").update({ name, phone }).eq("id", user.id);
    setSaving(false);
    if (error) {
      showToast("เกิดข้อผิดพลาด: " + error.message, true);
      return;
    }
    showToast("✓ บันทึกข้อมูลเรียบร้อย");
  };

  // รหัสผ่านอยู่ใน auth ของ Supabase ไม่ใช่ตาราง users — จึงใช้ auth.updateUser
  // คนละ API กับปุ่มบันทึกด้านบน แยก state/ปุ่มออกจากกัน
  const handleChangePassword = async () => {
    if (password !== confirm) { showToast("รหัสผ่านไม่ตรงกัน", true); return; }
    if (password.length < 8) { showToast("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร", true); return; }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSavingPassword(false);
    if (error) { showToast("เกิดข้อผิดพลาด: " + error.message, true); return; }
    setPassword("");
    setConfirm("");
    showToast("✓ เปลี่ยนรหัสผ่านเรียบร้อย");
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <span className="text-[#aaa] text-[14px]">กำลังโหลด…</span>
      </div>
    );
  }

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-bg px-4 py-12">
        <div className="max-w-[680px] mx-auto">
          <Link
            href="/account"
            className="inline-block text-[13px] text-[#aaa] hover:text-navy transition-colors mb-4 no-underline"
          >
            ← กลับ
          </Link>

          <h1 className="text-[24px] font-semibold text-navy mb-8">ตั้งค่าบัญชี</h1>

          <div className="bg-white rounded-2xl border border-border p-6 flex flex-col gap-4">
            {loadingProfile ? (
              <span className="text-[#aaa] text-[14px]">กำลังโหลด…</span>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] text-[#555] font-medium">ชื่อ</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={iCls}
                    placeholder="ชื่อของคุณ"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] text-[#555] font-medium">เบอร์โทร</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={iCls}
                    placeholder="เบอร์โทรศัพท์"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] text-[#555] font-medium">อีเมล</label>
                  <input
                    type="email"
                    value={user.email ?? ""}
                    disabled
                    className={`${iCls} bg-[#f5f5f2] text-[#888] cursor-not-allowed`}
                  />
                  <p className="text-[11px] text-[#bbb] leading-[1.5]">
                    อีเมลใช้สำหรับเข้าสู่ระบบ เปลี่ยนไม่ได้
                  </p>
                </div>

                <Button onClick={handleSave} disabled={saving} className="w-full mt-2">
                  {saving ? "กำลังบันทึก…" : "บันทึก"}
                </Button>
              </>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-border p-6 flex flex-col gap-4 mt-4">
            <div>
              <h2 className="text-[15px] font-semibold text-navy">เปลี่ยนรหัสผ่าน</h2>
              <p className="text-[12px] text-[#aaa] mt-0.5">อย่างน้อย 8 ตัวอักษร</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] text-[#555] font-medium">รหัสผ่านใหม่</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className={iCls}
                placeholder="••••••••"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] text-[#555] font-medium">ยืนยันรหัสผ่านใหม่</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                className={iCls}
                placeholder="••••••••"
              />
            </div>

            <Button
              onClick={handleChangePassword}
              disabled={savingPassword || !password || !confirm}
              className="w-full mt-2"
            >
              {savingPassword ? "กำลังบันทึก…" : "เปลี่ยนรหัสผ่าน"}
            </Button>
          </div>
        </div>
      </main>

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[200] px-4 py-3 rounded-xl text-[13px] font-medium shadow-lg ${
            toast.error ? "bg-red-500 text-white" : "bg-navy text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <Footer />
    </>
  );
}
