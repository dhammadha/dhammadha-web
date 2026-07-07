"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("รหัสผ่านไม่ตรงกัน"); return; }
    if (password.length < 8) { setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"); return; }
    setLoading(true);

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    router.push("/account");
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center gap-1 no-underline">
            <span className="text-xl font-semibold text-navy tracking-[0.05em]">DHAMMADHA</span>
            <span className="text-xs text-[#aaa] tracking-[0.06em]">STUDIO</span>
          </Link>
        </div>

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
                className="px-4 py-2.5 rounded-xl border border-border bg-[#fafaf8] text-[14px] text-navy outline-none focus:border-mint focus:shadow-[0_0_0_3px_#5ECEC820] transition-all font-[inherit]"
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
                className="px-4 py-2.5 rounded-xl border border-border bg-[#fafaf8] text-[14px] text-navy outline-none focus:border-mint focus:shadow-[0_0_0_3px_#5ECEC820] transition-all font-[inherit]"
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
                className="px-4 py-2.5 rounded-xl border border-border bg-[#fafaf8] text-[14px] text-navy outline-none focus:border-mint focus:shadow-[0_0_0_3px_#5ECEC820] transition-all font-[inherit]"
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
                className="px-4 py-2.5 rounded-xl border border-border bg-[#fafaf8] text-[14px] text-navy outline-none focus:border-mint focus:shadow-[0_0_0_3px_#5ECEC820] transition-all font-[inherit]"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-[13px] text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 py-2.5 rounded-xl bg-mint text-white font-semibold text-[15px] border-none cursor-pointer hover:bg-[#4dbfb9] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
      </div>
    </div>
  );
}
