"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AuthShell from "@/components/auth/AuthShell";
import { FIELD, LABEL } from "@/components/form/field";
import Button from "@/components/ui/Button";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // กลับไปหน้าเดิมหลัง login (เช่น หน้าฟอนต์ฟรีที่กดดาวน์โหลด) —
  // รับเฉพาะ path ภายในเว็บ กัน open redirect
  const rawNext = searchParams.get("next") ?? "";
  const nextPath = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/account";
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
      router.push(nextPath);
    }
  };

  return (
    <AuthShell title="เข้าสู่ระบบ">
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

        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <label className="font-ui text-ui text-black">รหัสผ่าน</label>
            <Link href="/auth/forgot-password" className="font-body text-body-sm text-mint-text no-underline hover:underline">
              ลืมพาสเวิร์ด
            </Link>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className={FIELD}
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p className="font-body text-body-sm text-danger-dark">{error}</p>
        )}

        <Button type="submit" disabled={loading} size="lg" className="mt-2 w-full">
          {loading ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
        </Button>
      </form>

      <p className="text-center font-body text-body-sm text-grey-600 mt-6">
        ยังไม่มีบัญชี ?{" "}
        <Link href="/auth/signup" className="text-mint-text no-underline hover:underline">
          สมัครสมาชิก
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
