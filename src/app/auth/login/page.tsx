"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message === "Invalid login credentials" ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง" : error.message);
      setLoading(false);
    } else {
      router.push("/account");
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        <div className="bg-white rounded-2xl shadow-sm border border-border p-8">
          <h1 className="text-[20px] font-semibold text-navy mb-6">เข้าสู่ระบบ</h1>

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

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] text-[#555] font-medium">รหัสผ่าน</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
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
              {loading ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
            </button>
          </form>

          <p className="text-center text-[13px] text-[#aaa] mt-6">
            ยังไม่มีบัญชี?{" "}
            <Link href="/auth/signup" className="text-mint no-underline hover:underline">
              สมัครสมาชิก
            </Link>
          </p>
        </div>

        <p className="text-center text-[13px] text-[#aaa] mt-5">
          <Link href="/" className="text-[#aaa] no-underline hover:text-navy transition-colors">
            ← กลับหน้าแรก
          </Link>
        </p>
      </div>
    </div>
  );
}
