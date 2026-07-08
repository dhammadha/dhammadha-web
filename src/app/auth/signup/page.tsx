"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

const inputCls =
  "px-4 py-2.5 rounded-xl border border-border bg-[#fafaf8] text-[14px] text-navy outline-none focus:border-mint focus:shadow-[0_0_0_3px_#5ECEC820] transition-all font-[inherit]";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [applyDesigner, setApplyDesigner] = useState(false);
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("รหัสผ่านไม่ตรงกัน"); return; }
    if (password.length < 8) { setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"); return; }
    if (applyDesigner && !portfolioUrl.trim()) {
      setError("กรุณากรอกลิงก์ผลงานเพื่อสมัครเป็น designer");
      return;
    }
    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (applyDesigner && data.user) {
      await supabase.from("users").update({
        portfolio_url: portfolioUrl.trim(),
        designer_application_status: "pending",
      }).eq("id", data.user.id);
    }

    router.push("/account");
  };

  return (
    <>
      <Nav />
      <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[400px]">
          <div className="bg-white rounded-2xl shadow-sm border border-border p-8">
            <h1 className="text-[20px] font-semibold text-navy mb-6">สมัครสมาชิก</h1>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] text-[#555] font-medium">ชื่อ</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  className={inputCls}
                  placeholder="ชื่อของคุณ"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] text-[#555] font-medium">อีเมล</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className={inputCls}
                  placeholder="your@email.com"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] text-[#555] font-medium">รหัสผ่าน</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className={inputCls}
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] text-[#555] font-medium">ยืนยันรหัสผ่าน</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  className={inputCls}
                  placeholder="••••••••"
                />
              </div>

              <div className="border-t border-border pt-4 mt-1 flex flex-col gap-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyDesigner}
                    onChange={(e) => setApplyDesigner(e.target.checked)}
                    className="mt-0.5 accent-[#0a8a84] shrink-0"
                  />
                  <div>
                    <span className="text-[13px] font-medium text-navy">สมัครเป็น Designer</span>
                    <p className="text-[12px] text-[#aaa] mt-0.5 leading-[1.6]">
                      หากต้องการร่วมวางจำหน่ายฟอนต์กับ DHAMMADHA STUDIO กรุณาติ๊กตัวเลือกนี้และกรอกลิงก์ผลงาน ทีมงานจะตรวจสอบและติดต่อกลับ
                    </p>
                  </div>
                </label>

                {applyDesigner && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] text-[#555] font-medium">
                      ลิงก์ผลงาน <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="url"
                      value={portfolioUrl}
                      onChange={(e) => setPortfolioUrl(e.target.value)}
                      className={inputCls}
                      placeholder="https://behance.net/yourname หรือ Instagram / website ฯลฯ"
                    />
                    <p className="text-[11px] text-[#bbb] leading-[1.5]">
                      กรอกลิงก์แสดงผลงานออกแบบฟอนต์ที่มีอยู่ เช่น Behance, Instagram, เว็บไซต์ส่วนตัว
                    </p>
                  </div>
                )}
              </div>

              {error && (
                <p className="text-[13px] text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 py-2.5 rounded-xl bg-mint text-white font-semibold text-[15px] border-none cursor-pointer hover:bg-navy transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "กำลังสมัคร…" : "สมัครสมาชิก"}
              </button>
            </form>

            <p className="text-center text-[13px] text-[#aaa] mt-6">
              มีบัญชีแล้ว?{" "}
              <Link href="/auth/login" className="text-mint no-underline hover:underline">
                เข้าสู่ระบบ
              </Link>
            </p>
          </div>

          <p className="text-center text-[13px] text-[#aaa] mt-5">
            <button
              type="button"
              onClick={() => router.back()}
              className="text-[#aaa] bg-transparent border-none cursor-pointer hover:text-navy transition-colors p-0 text-[13px] font-[inherit]"
            >
              ← ย้อนกลับ
            </button>
          </p>
        </div>
      </div>
      <Footer />
    </>
  );
}
