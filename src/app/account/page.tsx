"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Container from "@/components/ui/Container";
import Badge from "@/components/ui/Badge";
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
            <h1 className="font-heading text-h1 text-black mb-8">บัญชีของฉัน</h1>

            <div className="bg-surface p-6 flex flex-col gap-6">
              {/* Avatar + role */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-mint flex items-center justify-center font-heading text-h2 text-black select-none">
                    {(user.email?.[0] ?? "?").toUpperCase()}
                  </div>
                  <div>
                    <p className="font-heading text-h2 text-black leading-snug">
                      {profile?.name ?? user.email}
                    </p>
                    <span className="inline-block mt-1">
                      {role === "admin" ? (
                        <Badge className="bg-black text-white">{ROLE_LABEL.admin}</Badge>
                      ) : role === "designer" ? (
                        <Badge variant="free">{ROLE_LABEL.designer}</Badge>
                      ) : (
                        <Badge variant="tag">{ROLE_LABEL.customer}</Badge>
                      )}
                    </span>
                  </div>
                </div>
                <Link
                  href="/account/settings"
                  className="inline-flex items-center gap-1.5 font-body text-body-sm text-mint-text no-underline hover:underline shrink-0"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  ตั้งค่า
                </Link>
              </div>

              {/* Info rows */}
              <div className="grid grid-cols-[120px_1fr] gap-y-3">
                <span className="font-body text-body-sm text-grey-600">ชื่อ</span>
                <span className="font-body text-body text-black">{profile?.name ?? "-"}</span>
                <span className="font-body text-body-sm text-grey-600">อีเมล</span>
                <span className="font-body text-body text-black">{user.email}</span>
                <span className="font-body text-body-sm text-grey-600">เบอร์โทร</span>
                <span className="font-body text-body text-black">{profile?.phone ?? "-"}</span>
              </div>

              {/* Role shortcuts */}
              {(role === "admin" || role === "designer") && (
                <Link
                  href={role === "admin" ? "/admin" : "/designer"}
                  className="inline-flex items-center gap-2 font-body text-body-sm text-mint-text no-underline hover:underline"
                >
                  {role === "admin" ? "ไปที่ Admin Panel →" : "ไปที่ Designer Dashboard →"}
                </Link>
              )}
            </div>

            {role !== "admin" && <SubscriptionCard />}
            <MyFavourites />
            <MyDownloads />
          </div>
        </Container>
      </section>
      <Footer />
    </>
  );
}
