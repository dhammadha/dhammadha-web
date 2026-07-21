"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Container from "@/components/ui/Container";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/Button";
import { FIELD, LABEL } from "@/components/form/field";

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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <span className="font-body text-body-sm text-grey-600">กำลังโหลด…</span>
      </div>
    );
  }

  return (
    <>
      <Nav />
      <section className="bg-white">
        <Container className="pt-10 pb-16">
          <div className="max-w-[680px] mx-auto">
            <Link
              href="/account"
              className="inline-block font-body text-body-sm text-grey-600 hover:text-black transition-colors mb-4 no-underline"
            >
              ← กลับ
            </Link>

            <h1 className="font-heading text-h1 text-black mb-8">ตั้งค่าบัญชี</h1>

            <div className="flex flex-col gap-4">
              {loadingProfile ? (
                <span className="font-body text-body-sm text-grey-600">กำลังโหลด…</span>
              ) : (
                <>
                  <div>
                    <label className={LABEL}>ชื่อ</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={FIELD}
                      placeholder="ชื่อของคุณ"
                    />
                  </div>

                  <div>
                    <label className={LABEL}>เบอร์โทร</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className={FIELD}
                      placeholder="เบอร์โทรศัพท์"
                    />
                  </div>

                  <div>
                    <label className={LABEL}>อีเมล</label>
                    <input
                      type="email"
                      value={user.email ?? ""}
                      disabled
                      className={`${FIELD} text-grey-400 cursor-not-allowed`}
                    />
                    <p className="font-body text-footnote text-grey-600 mt-1.5 leading-[1.8]">
                      อีเมลใช้สำหรับเข้าสู่ระบบ เปลี่ยนไม่ได้
                    </p>
                  </div>

                  <Button onClick={handleSave} disabled={saving} className="w-full mt-2">
                    {saving ? "กำลังบันทึก…" : "บันทึก"}
                  </Button>
                </>
              )}
            </div>

            <div className="flex flex-col gap-4 mt-10">
              <div>
                <h2 className="font-heading text-h2 text-black">เปลี่ยนรหัสผ่าน</h2>
                <p className="font-body text-body-sm text-grey-600 mt-0.5">อย่างน้อย 8 ตัวอักษร</p>
              </div>

              <div>
                <label className={LABEL}>รหัสผ่านใหม่</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                  autoComplete="new-password"
                  className={FIELD}
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
        </Container>
      </section>

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[200] px-4 py-3 font-body text-body-sm shadow-lg ${
            toast.error ? "bg-danger-dark text-white" : "bg-black text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <Footer />
    </>
  );
}
