"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import MyDownloads from "@/components/account/MyDownloads";
import MyFavourites from "@/components/account/MyFavourites";
import SubscriptionCard from "@/components/account/SubscriptionCard";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  designer: "นักออกแบบ",
  customer: "ลูกค้า",
};

type Profile = { name: string | null; phone: string | null };

export default function AccountPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);

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
      .then(({ data }) => setProfile(data ?? { name: null, phone: null }));
  }, [user]);

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
          <h1 className="text-[24px] font-semibold text-navy mb-8">บัญชีของฉัน</h1>

          <div className="bg-white rounded-2xl border border-border p-6 flex flex-col gap-5">
            {/* Avatar + role */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-mint-light border border-mint-mid flex items-center justify-center text-[20px] font-semibold text-mint select-none">
                  {(user.email?.[0] ?? "?").toUpperCase()}
                </div>
                <div>
                  <p className="text-[16px] font-semibold text-navy leading-snug">
                    {profile?.name ?? user.email}
                  </p>
                  <span className={`inline-block mt-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full ${
                    role === "admin"
                      ? "bg-navy text-white"
                      : role === "designer"
                      ? "bg-mint-light text-mint border border-mint-mid"
                      : "bg-[#f5f5f2] text-[#888]"
                  }`}>
                    {ROLE_LABEL[role ?? "customer"]}
                  </span>
                </div>
              </div>
              <Link
                href="/account/settings"
                className="inline-flex items-center gap-1.5 text-[13px] text-mint no-underline hover:underline font-medium shrink-0"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                ตั้งค่า
              </Link>
            </div>

            <hr className="border-border" />

            {/* Info rows */}
            <div className="grid grid-cols-[120px_1fr] gap-y-3 text-[14px]">
              <span className="text-[#aaa]">ชื่อ</span>
              <span className="text-navy">{profile?.name ?? "-"}</span>
              <span className="text-[#aaa]">อีเมล</span>
              <span className="text-navy">{user.email}</span>
              <span className="text-[#aaa]">เบอร์โทร</span>
              <span className="text-navy">{profile?.phone ?? "-"}</span>
            </div>

            {/* Role shortcuts */}
            {(role === "admin" || role === "designer") && (
              <>
                <hr className="border-border" />
                <Link
                  href={role === "admin" ? "/admin" : "/designer"}
                  className="inline-flex items-center gap-2 text-[14px] text-mint no-underline hover:underline font-medium"
                >
                  {role === "admin" ? "ไปที่ Admin Panel →" : "ไปที่ Designer Dashboard →"}
                </Link>
              </>
            )}
          </div>

          <SubscriptionCard />
          <MyFavourites />
          <MyDownloads />
        </div>
      </main>
      <Footer />
    </>
  );
}
