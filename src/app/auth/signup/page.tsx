"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Button from "@/components/Button";

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
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const normalizeUrl = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return trimmed;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return "https://" + trimmed;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("รหัสผ่านไม่ตรงกัน"); return; }
    if (password.length < 8) { setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"); return; }
    if (applyDesigner && !portfolioUrl.trim()) {
      setError("กรุณากรอกลิงก์ผลงานเพื่อสมัครเป็น designer");
      return;
    }
    if (applyDesigner && !agreementAccepted) {
      setError("กรุณาอ่านและยอมรับข้อตกลงสำหรับนักออกแบบก่อนสมัคร");
      return;
    }
    setLoading(true);

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          ...(marketingConsent ? { marketing_consent: true } : {}),
          ...(applyDesigner ? {
            portfolio_url: normalizeUrl(portfolioUrl),
            designer_application_status: "pending",
            designer_agreement_accepted: true,
          } : {}),
        },
      },
    });
    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
  };

  if (done) {
    return (
      <>
        <Nav />
        <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-[400px]">
            <div className="bg-white rounded-2xl shadow-sm border border-border p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-mint-light flex items-center justify-center mb-4 mx-auto">
                <svg viewBox="0 0 24 24" fill="none" stroke="#0a8a84" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m3 7 9 6 9-6" />
                </svg>
              </div>
              <h1 className="text-[20px] font-semibold text-navy mb-3">ตรวจสอบอีเมลของคุณ</h1>
              <p className="text-[14px] text-[#555] leading-[1.7] mb-2">
                เราได้ส่งลิงก์ยืนยันไปที่
              </p>
              <p className="text-[14px] font-semibold text-navy mb-4">{email}</p>
              <p className="text-[13px] text-[#aaa] leading-[1.6] mb-6">
                กรุณาคลิกลิงก์ในอีเมลเพื่อเปิดใช้งานบัญชี หากไม่พบอีเมลให้ตรวจสอบในโฟลเดอร์ Spam
              </p>
              <Link href="/auth/login" className="block">
                <Button size="lg" className="w-full">ไปหน้าเข้าสู่ระบบ</Button>
              </Link>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

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
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] text-[#555] font-medium">
                        ลิงก์ผลงาน <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={portfolioUrl}
                        onChange={(e) => setPortfolioUrl(e.target.value)}
                        onBlur={(e) => setPortfolioUrl(normalizeUrl(e.target.value))}
                        className={inputCls}
                        placeholder="behance.net/yourname หรือ Instagram / website ฯลฯ"
                      />
                      <p className="text-[11px] text-[#bbb] leading-[1.5]">
                        กรอกลิงก์แสดงผลงานออกแบบฟอนต์ที่มีอยู่ เช่น Behance, Instagram, เว็บไซต์ส่วนตัว
                      </p>
                    </div>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={agreementAccepted}
                        onChange={(e) => setAgreementAccepted(e.target.checked)}
                        className="mt-0.5 accent-[#0a8a84] shrink-0"
                      />
                      <span className="text-[12px] text-[#555] leading-[1.6]">
                        ฉันได้อ่านและยอมรับ{" "}
                        <Link href="/designer-agreement/" target="_blank" className="text-mint no-underline hover:underline">
                          ข้อตกลงสำหรับนักออกแบบ
                        </Link>{" "}
                        <span className="text-red-400">*</span>
                      </span>
                    </label>
                  </>
                )}

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={marketingConsent}
                    onChange={(e) => setMarketingConsent(e.target.checked)}
                    className="mt-0.5 accent-[#0a8a84] shrink-0"
                  />
                  <span className="text-[12px] text-[#888] leading-[1.6]">
                    ยินยอมรับข่าวสาร ฟอนต์ใหม่ และโปรโมชั่นทางอีเมล (ยกเลิกได้ทุกเมื่อ — ดู{" "}
                    <Link href="/privacy/" target="_blank" className="text-mint no-underline hover:underline">
                      นโยบายความเป็นส่วนตัว
                    </Link>)
                  </span>
                </label>
              </div>

              {error && (
                <p className="text-[13px] text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}

              <Button type="submit" disabled={loading} size="lg" className="mt-2 w-full">
                {loading ? "กำลังสมัคร…" : "สมัครสมาชิก"}
              </Button>
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
