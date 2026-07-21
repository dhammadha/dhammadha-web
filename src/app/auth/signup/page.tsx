"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AuthShell from "@/components/auth/AuthShell";
import { FIELD, LABEL } from "@/components/form/field";
import Button from "@/components/ui/Button";

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
      <AuthShell title="ตรวจสอบอีเมลของคุณ">
        <div className="bg-surface p-6">
          <p className="font-body text-body text-grey-800 leading-[1.8] mb-1">
            ✓ เราได้ส่งลิงก์ยืนยันไปที่
          </p>
          <p className="font-heading text-h2 text-black mb-3">{email}</p>
          <p className="font-body text-body-sm text-grey-600 leading-[1.8] mb-6">
            กรุณาคลิกลิงก์ในอีเมลเพื่อเปิดใช้งานบัญชี หากไม่พบอีเมลให้ตรวจสอบในโฟลเดอร์ Spam
          </p>
          <Link href="/auth/login" className="block">
            <Button size="lg" className="w-full">ไปหน้าเข้าสู่ระบบ</Button>
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="สมัครสมาชิก">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className={LABEL}>ชื่อ</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            className={FIELD}
            placeholder="ชื่อของคุณ"
          />
        </div>

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

        <div>
          <label className={LABEL}>รหัสผ่าน</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            className={FIELD}
            placeholder="อย่างน้อย 8 ตัวอักษร"
          />
        </div>

        <div>
          <label className={LABEL}>ยืนยันรหัสผ่าน</label>
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

        <div className="pt-4 mt-1 flex flex-col gap-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={applyDesigner}
              onChange={(e) => setApplyDesigner(e.target.checked)}
              className="mt-0.5 accent-black shrink-0"
            />
            <div>
              <span className="font-ui text-ui text-black">สมัครเป็น Designer</span>
              <p className="font-body text-body-sm text-grey-600 mt-0.5 leading-[1.8]">
                หากต้องการร่วมวางจำหน่ายฟอนต์กับ DHAMMADHA STUDIO กรุณาติ๊กตัวเลือกนี้และกรอกลิงก์ผลงาน ทีมงานจะตรวจสอบและติดต่อกลับ
              </p>
            </div>
          </label>

          {applyDesigner && (
            <>
              <div>
                <label className={LABEL}>ลิงก์ผลงาน</label>
                <input
                  type="text"
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  onBlur={(e) => setPortfolioUrl(normalizeUrl(e.target.value))}
                  className={FIELD}
                  placeholder="behance.net/yourname หรือ Instagram / website ฯลฯ"
                />
                <p className="font-body text-body-sm text-grey-600 mt-1.5 leading-[1.8]">
                  กรอกลิงก์แสดงผลงานออกแบบฟอนต์ที่มีอยู่ เช่น Behance, Instagram, เว็บไซต์ส่วนตัว
                </p>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreementAccepted}
                  onChange={(e) => setAgreementAccepted(e.target.checked)}
                  className="mt-0.5 accent-black shrink-0"
                />
                <span className="font-body text-body-sm text-grey-800 leading-[1.8]">
                  ฉันได้อ่านและยอมรับ{" "}
                  <Link href="/designer-agreement/" target="_blank" className="text-mint-text no-underline hover:underline">
                    ข้อตกลงสำหรับนักออกแบบ
                  </Link>
                </span>
              </label>
            </>
          )}

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={(e) => setMarketingConsent(e.target.checked)}
              className="mt-0.5 accent-black shrink-0"
            />
            <span className="font-body text-body-sm text-grey-600 leading-[1.8]">
              ยินยอมรับข่าวสาร ฟอนต์ใหม่ และโปรโมชั่นทางอีเมล (ยกเลิกได้ทุกเมื่อ — ดู{" "}
              <Link href="/privacy/" target="_blank" className="text-mint-text no-underline hover:underline">
                นโยบายความเป็นส่วนตัว
              </Link>)
            </span>
          </label>
        </div>

        {error && (
          <p className="font-body text-body-sm text-danger-dark">{error}</p>
        )}

        <Button type="submit" disabled={loading} size="lg" className="mt-2 w-full">
          {loading ? "กำลังสมัคร…" : "สมัครสมาชิก"}
        </Button>
      </form>

      <p className="text-center font-body text-body-sm text-grey-600 mt-6">
        มีบัญชีแล้ว?{" "}
        <Link href="/auth/login" className="text-mint-text no-underline hover:underline">
          เข้าสู่ระบบ
        </Link>
      </p>

      <p className="text-center mt-5">
        <button
          type="button"
          onClick={() => router.back()}
          className="font-body text-body-sm text-grey-600 bg-transparent border-none cursor-pointer hover:text-black transition-colors p-0"
        >
          ← ย้อนกลับ
        </button>
      </p>
    </AuthShell>
  );
}
