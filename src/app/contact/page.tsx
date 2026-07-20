"use client";

// ฟอร์มติดต่อสาธารณะ — เดิม footer ลิงก์ mailto: ตรง ๆ ซึ่งเด้งโปรแกรมเมลของเครื่อง
// (คนใช้เว็บเมลจะไม่มีอะไรเกิดขึ้นเลย) เปลี่ยนเป็นฟอร์มกรอกแล้วยิงเข้า /api/send-email
//
// เป็นฟอร์มสาธารณะเหมือน /quote → ต้องผ่าน Turnstile ก่อนส่ง มิฉะนั้นกลายเป็นช่องสแปม
// ฝั่ง server อยู่ที่ handleContact ใน lib/email-service.ts (type: "contact")

import { useEffect, useRef, useState } from "react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

// ตั้งใจไม่ `declare global` ซ้ำกับ quote/page.tsx (จะชนกันตอน merge interface)
// — อ่านผ่าน cast เฉพาะจุดแทน ไม่ต้องไปแก้หน้า quote ที่ใช้งานจริงอยู่
type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (widgetId: string) => void;
};
const getTurnstile = (): TurnstileApi | undefined =>
  (window as unknown as { turnstile?: TurnstileApi }).turnstile;

const EMPTY = { name: "", email: "", subject: "", message: "" };

// ตัวอักษรในช่องกรอกต้องเท่ากับช่องค้นหาใน Nav และ ui/Input.tsx เสมอ:
// `font-body text-body-sm` (Looped Light 14) — เป็นมาตรฐานเดียวของทั้งโปรเจกต์
// (ไม่ใช้ ui/Input ตรง ๆ เพราะต้องการ padding ใหญ่กว่าช่องค้นหา และ cn() เป็นการ
//  ต่อสตริงเฉย ๆ ไม่ใช่ tailwind-merge → override px/py ผ่าน className ไม่ชัวร์)
const FIELD =
  "w-full bg-surface px-4 py-3 font-body text-body-sm text-black placeholder:text-grey-400 border-none " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black";
// หัวข้อช่องกรอกใช้ UI Text (Sans Bold 16) — ตัวหนา อ่านนำสายตาก่อนช่องกรอก
const LABEL = "block font-ui text-ui text-black mb-2";

export default function ContactPage() {
  const [form, setForm] = useState(EMPTY);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  // โหลดสคริปต์ Turnstile แล้ว render แบบ explicit (เหมือน /quote)
  // ถ้าไม่ได้ตั้ง NEXT_PUBLIC_TURNSTILE_SITE_KEY (dev เครื่อง) จะข้ามทั้งหมด
  // และฝั่ง server ก็ข้ามการตรวจเมื่อไม่ได้ตั้ง secret key เช่นกัน
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;

    function renderWidget() {
      const ts = getTurnstile();
      if (!containerRef.current || !ts || widgetIdRef.current) return;
      widgetIdRef.current = ts.render(containerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: "light", // เว็บนี้ธีมสว่างอย่างเดียว ไม่ให้ตามธีมเครื่องผู้ใช้
        callback: (token: string) => setTurnstileToken(token),
        "expired-callback": () => setTurnstileToken(""),
        "error-callback": () => setTurnstileToken(""),
      });
    }

    if (getTurnstile()) {
      renderWidget();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", renderWidget);
      return () => existing.removeEventListener("load", renderWidget);
    }

    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", renderWidget);
    document.body.appendChild(script);
    return () => script.removeEventListener("load", renderWidget);
  }, []);

  // token ของ Turnstile ใช้ได้ครั้งเดียว — ส่งไม่สำเร็จต้องรีเซ็ตให้ยืนยันใหม่
  function resetTurnstile() {
    const ts = getTurnstile();
    if (widgetIdRef.current && ts) ts.reset(widgetIdRef.current);
    setTurnstileToken("");
  }

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.message.trim()) {
      setErrorMsg("กรุณากรอกชื่อและข้อความ");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setErrorMsg("กรุณากรอกอีเมลให้ถูกต้อง เช่น name@example.com");
      return;
    }
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setErrorMsg("กรุณายืนยันว่าคุณไม่ใช่บอทก่อนส่ง");
      return;
    }

    setErrorMsg("");
    setStatus("loading");
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "contact", turnstile_token: turnstileToken, payload: form }),
      });
      if (!res.ok) throw new Error("send_failed");
      setStatus("success");
      setForm(EMPTY);
      resetTurnstile();
    } catch {
      setStatus("error");
      setErrorMsg("ส่งข้อความไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      resetTurnstile();
    }
  }

  return (
    <>
      <Nav />
      <section className="bg-white">
        <Container className="pt-10 pb-16">
          <div className="max-w-[640px] mx-auto">
            <h1 className="font-heading text-h1 text-black mb-3">ติดต่อสอบถาม</h1>
            <p className="font-body text-body text-grey-600 leading-[1.8] mb-8">
              มีคำถามเรื่องฟอนต์ สิทธิการใช้งาน หรือใบเสนอราคา กรอกแบบฟอร์มด้านล่างได้เลย
              เราจะตอบกลับทางอีเมลภายใน 1–2 วันทำการ
            </p>

            {status === "success" ? (
              <div className="bg-surface p-6">
                <div className="font-heading text-h2 text-success mb-2.5">✓ ส่งข้อความเรียบร้อย</div>
                <p className="font-body text-body text-grey-800 leading-[1.8] mb-5">
                  เราได้รับข้อความของคุณแล้ว ทีมงานจะติดต่อกลับทางอีเมลภายใน 1–2 วันทำการ
                  หากไม่พบอีเมลตอบกลับ รบกวนตรวจสอบใน Junk Mail
                </p>
                <Button as="button" variant="outline" onClick={() => setStatus("idle")}>
                  ส่งข้อความอีกครั้ง
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="flex flex-col gap-5">
                <div>
                  <label htmlFor="c-name" className={LABEL}>ชื่อผู้ติดต่อ</label>
                  <input id="c-name" value={form.name} onChange={set("name")} className={FIELD} placeholder="ชื่อของคุณ" />
                </div>
                <div>
                  <label htmlFor="c-email" className={LABEL}>อีเมล</label>
                  <input id="c-email" type="email" value={form.email} onChange={set("email")} className={FIELD} placeholder="name@example.com" />
                </div>
                <div>
                  <label htmlFor="c-subject" className={LABEL}>เรื่องที่ต้องการสอบถาม</label>
                  <input id="c-subject" value={form.subject} onChange={set("subject")} className={FIELD} placeholder="เช่น สอบถามสิทธิการใช้งานฟอนต์" />
                </div>
                <div>
                  <label htmlFor="c-message" className={LABEL}>ข้อความ</label>
                  <textarea id="c-message" value={form.message} onChange={set("message")} rows={7} className={FIELD} placeholder="รายละเอียดที่ต้องการสอบถาม" />
                </div>

                {TURNSTILE_SITE_KEY && <div ref={containerRef} />}

                {errorMsg && (
                  <p className="font-body text-body-sm text-danger-dark">{errorMsg}</p>
                )}

                <div>
                  <Button type="submit" size="lg" disabled={status === "loading"}>
                    {status === "loading" ? "กำลังส่ง…" : "ส่งข้อความ"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </Container>
      </section>
      <Footer />
    </>
  );
}
