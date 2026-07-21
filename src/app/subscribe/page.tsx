"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Container from "@/components/ui/Container";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import WaitlistForm from "@/components/WaitlistForm";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import {
  isSubActive,
  isTrialOpen,
  parseSubSettings,
  type SubscriptionRow,
  type SubscriptionSettings,
} from "@/lib/subscription";

const features = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-mint-text">
        <path d="M4 7h16M4 12h10M4 17h7" />
      </svg>
    ),
    title: "ฟอนต์ครบทุกตัว",
    desc: "เข้าถึงฟอนต์ทุกชุดที่ร่วมแพลนโดยไม่มีข้อจำกัด",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-mint-text">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    title: "activate ผ่านแอป",
    desc: "เปิด/ปิดฟอนต์บนเครื่องได้ทันทีผ่านแอป Windows / macOS",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-mint-text">
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
    ),
    title: "อัปเดตอัตโนมัติ",
    desc: "ได้รับฟอนต์ใหม่และ version อัปเดตโดยอัตโนมัติ",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-mint-text">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      </svg>
    ),
    title: "ใช้เชิงพาณิชย์",
    desc: "ลิขสิทธิ์ครอบคลุมงานส่วนตัวและเชิงพาณิชย์",
  },
];

const ERR_TH: Record<string, string> = {
  trial_closed: "ช่วงทดสอบปิดรับสมัครแล้ว",
  unauthorized: "กรุณาเข้าสู่ระบบใหม่",
};

export default function SubscribePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState<SubscriptionSettings | null>(null);
  const [sub, setSub] = useState<SubscriptionRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const reload = async () => {
    const settingsP = supabase.from("settings").select("value").eq("key", "subscription").maybeSingle();
    const subP = user
      ? supabase.from("subscriptions").select("*").eq("status", "active").order("current_period_end", { ascending: false })
      : Promise.resolve({ data: null });
    const [setRes, subRes] = await Promise.all([settingsP, subP]);
    setSettings(setRes.data ? parseSubSettings(setRes.data.value) : parseSubSettings(null));
    const rows = ((subRes as { data: SubscriptionRow[] | null }).data) ?? [];
    setSub(rows.find((r) => isSubActive(r)) ?? null);
    setLoaded(true);
  };

  useEffect(() => {
    if (authLoading) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  async function startTrial() {
    setError("");
    setSubmitting(true);
    const { error: rpcErr } = await supabase.rpc("start_trial_subscription");
    if (rpcErr) {
      const code = rpcErr.message.replace(/^.*:\s*/, "").trim();
      setError(ERR_TH[code] || "เกิดข้อผิดพลาด กรุณาลองใหม่");
      setSubmitting(false);
      return;
    }
    await reload();
    setSubmitting(false);
  }

  const trialOpen = isTrialOpen(settings);
  const active = isSubActive(sub);

  return (
    <>
      <Nav />
      <section className="bg-white">
        <Container className="pt-10 pb-16">
          <div className="max-w-[560px] mx-auto text-center">
            {!loaded ? (
              <p className="font-body text-body-sm text-grey-600">กำลังโหลด…</p>
            ) : active ? (
              /* ── มี subscription ใช้งานอยู่ ── */
              <>
                <span className="inline-block mb-6">
                  <Badge variant="free">สมาชิกใช้งานอยู่</Badge>
                </span>
                <h1 className="font-heading text-hero text-black mb-4">
                  คุณเป็นสมาชิกแล้ว 🎉
                </h1>
                <p className="font-body text-body text-grey-600 leading-[1.8] mb-8">
                  ใช้ได้ถึง{" "}
                  <strong className="text-black">
                    {new Date(sub!.current_period_end).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}
                  </strong>
                  <br />
                  ดาวน์โหลดแอปเพื่อ activate ฟอนต์บนเครื่องของคุณ
                </p>
                <div className="flex flex-wrap gap-2.5 justify-center mb-8">
                  {settings?.download_mac ? (
                    <Button as="a" href={settings.download_mac} external size="lg">ดาวน์โหลดสำหรับ macOS</Button>
                  ) : (
                    <span className="inline-flex items-center px-6 py-3 bg-grey-200 font-body text-body text-grey-400">macOS — เร็ว ๆ นี้</span>
                  )}
                  {settings?.download_win ? (
                    <Button as="a" href={settings.download_win} external size="lg" variant="outline">ดาวน์โหลดสำหรับ Windows</Button>
                  ) : (
                    <span className="inline-flex items-center px-6 py-3 bg-grey-200 font-body text-body text-grey-400">Windows — เร็ว ๆ นี้</span>
                  )}
                </div>
                <Link href="/account" className="font-body text-body-sm text-mint-text no-underline hover:underline">
                  ไปที่บัญชีของฉัน →
                </Link>
              </>
            ) : (
              /* ── ยังไม่ได้สมัคร ── */
              <>
                <span className="inline-block mb-6">
                  <Badge variant="free">{trialOpen ? "เปิดให้ทดสอบฟรี" : "Coming Soon"}</Badge>
                </span>
                <h1 className="font-heading text-hero text-black mb-4">
                  ฟอนต์ไทยไม่จำกัด<br />ด้วย <em className="text-mint-text not-italic">Subscription</em>
                </h1>

                {/* ราคา */}
                <div className="flex items-end justify-center gap-2 mb-2">
                  {trialOpen && <span className="font-heading text-h2 text-grey-400 line-through">฿{settings?.monthly_price.toLocaleString()}</span>}
                  <span className="font-heading text-hero text-black leading-none">
                    {trialOpen ? "฿0" : `฿${settings?.monthly_price.toLocaleString()}`}
                  </span>
                  <span className="font-body text-body text-grey-600 mb-1">/ เดือน</span>
                </div>
                <p className="font-body text-body-sm text-grey-600 mb-2">
                  หรือรายปี ฿{settings?.yearly_price.toLocaleString()} <span className="text-mint-text">(ฟรี 2 เดือน)</span>
                </p>
                <p className="font-body text-body text-grey-600 leading-[1.8] mb-9">
                  {trialOpen
                    ? "ช่วงทดสอบ — สมัครฟรี ใช้ฟอนต์ทุกตัวที่ร่วมแพลนผ่านแอป"
                    : "เข้าถึงฟอนต์ทุกตัวในคลังด้วยแพลนรายเดือน ไม่ต้องซื้อทีละชุด"}
                </p>

                {/* CTA */}
                {trialOpen ? (
                  !user ? (
                    <div className="max-w-[360px] mx-auto mb-3">
                      <Button as="link" href="/auth/login?next=/subscribe" size="lg" className="w-full">
                        เข้าสู่ระบบเพื่อเริ่มใช้ฟรี
                      </Button>
                      <p className="font-body text-body-sm text-grey-600 mt-2">ยังไม่มีบัญชี? สมัครฟรี ใช้เวลาไม่ถึงนาที</p>
                    </div>
                  ) : (
                    <div className="max-w-[360px] mx-auto mb-3">
                      <Button onClick={startTrial} disabled={submitting} size="lg" className="w-full">
                        {submitting ? "กำลังดำเนินการ…" : "เริ่มใช้ฟรีเลย"}
                      </Button>
                      {error && <p className="font-body text-body-sm text-danger-dark mt-2">{error}</p>}
                    </div>
                  )
                ) : (
                  <div className="max-w-[420px] mx-auto mb-3">
                    <p className="font-body text-body-sm text-grey-600 mb-2.5">ลงทะเบียนรับแจ้งเตือนเมื่อเปิดให้บริการ</p>
                    <WaitlistForm />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-12 text-left">
                  {features.map((f) => (
                    <div key={f.title} className="bg-surface p-5">
                      <div className="mb-2">{f.icon}</div>
                      <div className="font-heading text-h2 text-black mb-1">{f.title}</div>
                      <div className="font-body text-body-sm text-grey-600 leading-[1.8]">{f.desc}</div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => router.back()}
                  className="inline-flex items-center justify-center gap-1.5 font-body text-body-sm text-grey-600 bg-transparent border-none cursor-pointer mt-8 hover:text-black transition-colors"
                >
                  ← ย้อนกลับ
                </button>
              </>
            )}
          </div>
        </Container>
      </section>
      <Footer />
    </>
  );
}
