"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Container from "@/components/ui/Container";
import { supabase } from "@/lib/supabase";
import LicenseLink from "@/components/LicenseLink";
import Button from "@/components/ui/Button";
import { FIELD, Field } from "@/components/form/field";
import {
  parseLicenseSettings,
  parseDesignerTiers,
  designerLicensePdf,
  licenseLabel as getLicenseLabel,
  type LicenseTier,
} from "@/lib/license";
import { CONTACT_EMAIL } from "@/lib/brand";

interface FontItem {
  id: string;
  name: string;
  slug: string;
}

interface DesignerInfo {
  id: string;
  name: string | null;
  business_name: string | null;
}

interface LicenseConfig {
  use_default: boolean;
  license_pdf_url: string | null;
  tiers: LicenseTier[] | null;
}

const EMPTY_FORM = {
  contact_name: "",
  company_name: "",
  address: "",
  tax_id: "",
  email: "",
  license_type: "",
  note: "",
};

// Cloudflare Turnstile — bot protection on the quote form.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

export default function QuotePage() {
  return (
    <Suspense>
      <QuoteForm />
    </Suspense>
  );
}

function QuoteForm() {
  const searchParams = useSearchParams();
  const preselectedFont = searchParams.get("font") ?? "";
  const designerSlug = searchParams.get("designer_slug") ?? "";

  const [form, setForm] = useState(EMPTY_FORM);
  const [fonts, setFonts] = useState<FontItem[]>([]);
  const [designer, setDesigner] = useState<DesignerInfo | null>(null);
  const [licenseConfig, setLicenseConfig] = useState<LicenseConfig | null>(null);
  // ดีไซน์เนอร์รายนี้เปิดรับใบเสนอราคาหรือไม่ (null = ยังไม่เจาะจงดีไซน์เนอร์)
  const [quotesClosed, setQuotesClosed] = useState(false);
  const [defaultTiers, setDefaultTiers] = useState<LicenseTier[]>(() => parseLicenseSettings(null));
  const [selectedFonts, setSelectedFonts] = useState<string[]>([preselectedFont || ""]);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  // คำขอถูกบันทึกแล้ว แต่อีเมลแจ้งนักออกแบบไม่ออก — สถานะกึ่งกลางที่ต้องแยกจาก
  // ทั้ง success และ error (ดูเหตุผลตรงจุดที่ตั้งค่า)
  const [notifyFailed, setNotifyFailed] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);

  // โหลดสคริปต์ Turnstile แล้ว render widget แบบ explicit (ไม่ใช้ auto-render)
  // ทำงานเฉพาะเมื่อตั้ง NEXT_PUBLIC_TURNSTILE_SITE_KEY ไว้ — ถ้าไม่ตั้ง (dev เครื่อง)
  // จะไม่โหลดสคริปต์เลย และฟอร์มยังส่งได้ตามปกติ (ดูเงื่อนไขใน submit())
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;

    function renderWidget() {
      if (!turnstileContainerRef.current || !window.turnstile || turnstileWidgetIdRef.current) return;
      turnstileWidgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        // default เป็น "auto" = ตามธีมเครื่องผู้ใช้ → คนใช้ dark mode จะเห็นกล่องดำ
        // เว็บนี้เป็นธีมสว่างอย่างเดียว บังคับ light ให้เข้ากันทุกเครื่อง
        theme: "light",
        callback: (token: string) => setTurnstileToken(token),
        "expired-callback": () => setTurnstileToken(""),
        "error-callback": () => setTurnstileToken(""),
      });
    }

    if (window.turnstile) {
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

    return () => {
      script.removeEventListener("load", renderWidget);
    };
  }, []);

  useEffect(() => {
    async function load() {
      let designerInfo: DesignerInfo | null = null;

      const { data: licSettings } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "licensing")
        .single();
      setDefaultTiers(parseLicenseSettings(licSettings?.value));

      if (designerSlug) {
        // designer_profiles (view สาธารณะ, 0054) แทน users ตรง ๆ — ฟอร์มนี้เปิดให้ anon ใช้
        const { data: dData } = await supabase
          .from("designer_profiles")
          .select("id, name, business_name")
          .eq("designer_slug", designerSlug)
          .single();
        if (dData) designerInfo = dData as DesignerInfo;

        const { data: licData } = await supabase
          .from("designer_license_config")
          .select("use_default, license_pdf_url, tiers, quote_enabled")
          .eq("designer_id", dData!.id)
          .single();
        // ไม่มีแถว config = ยังไม่เคยเปิด = ปิด (ตรงกับค่า default ของคอลัมน์ใน DB)
        setQuotesClosed(!licData?.quote_enabled);
        setLicenseConfig(
          licData
            ? {
                use_default: licData.use_default,
                license_pdf_url: licData.license_pdf_url,
                tiers: parseDesignerTiers(licData.tiers),
              }
            : null
        );
      }
      setDesigner(designerInfo);

      let query = supabase
        .from("fonts")
        .select("id, name, slug, owner_id")
        .eq("is_active", true)
        .order("name");

      if (designerInfo) {
        query = query.eq("owner_id", designerInfo.id);
      } else {
        query = query.not("published_at", "is", null);
      }

      const { data } = await query;
      let list = (data ?? []) as FontItem[];

      // dropdown รวมทุกฟอนต์ (ไม่มี designer_slug) ต้องไม่โชว์ฟอนต์ของดีไซน์เนอร์ที่ปิดระบบ
      // ไม่งั้นลูกค้ากรอกจนจบแล้วค่อยโดน RPC ปฏิเสธ
      if (!designerInfo) {
        const { data: enabled } = await supabase
          .from("designer_license_config")
          .select("designer_id")
          .eq("quote_enabled", true);
        const allowed = new Set((enabled ?? []).map((r) => r.designer_id));
        const withOwner = (data ?? []) as Array<FontItem & { owner_id?: string | null }>;
        list = withOwner.filter((f) => f.owner_id && allowed.has(f.owner_id));
      }
      setFonts(list);

      if (preselectedFont) {
        const match = list.find((f) => f.slug === preselectedFont || f.id === preselectedFont);
        if (match) setSelectedFonts([match.id]);
      }
    }
    load();
  }, [preselectedFont, designerSlug]);

  function set(key: keyof typeof EMPTY_FORM, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function setFont(index: number, val: string) {
    setSelectedFonts((prev) => prev.map((v, i) => (i === index ? val : v)));
  }

  function addFont() {
    setSelectedFonts((prev) => [...prev, ""]);
  }

  function removeFont(index: number) {
    setSelectedFonts((prev) => prev.filter((_, i) => i !== index));
  }

  // รีเซ็ต widget Turnstile — token ใช้ได้ครั้งเดียว ต้องรีเซ็ตทุกครั้งที่ส่งฟอร์ม
  // ไม่สำเร็จ (ทั้ง error จริงและ turnstile ตรวจไม่ผ่าน) เพื่อให้ผู้ใช้ลองใหม่ได้
  function resetTurnstile() {
    if (turnstileWidgetIdRef.current && window.turnstile) {
      window.turnstile.reset(turnstileWidgetIdRef.current);
    }
    setTurnstileToken("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const chosenFonts = selectedFonts.filter(Boolean);

    // ตรวจสอบฟิลด์บังคับ (ยกเว้น form.note ที่ไม่ต้องเช็กแล้ว)
    if (
      !form.contact_name ||
      !form.company_name ||
      !form.address ||
      !form.tax_id ||
      !form.email ||
      !form.license_type ||
      chosenFonts.length === 0
    ) {
      setErrorMsg("กรุณากรอกข้อมูลให้ครบทุกช่องและเลือกฟอนต์อย่างน้อย 1 รายการ");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setErrorMsg("กรุณากรอกอีเมลให้ถูกต้อง เช่น name@company.com");
      return;
    }
    if (!/^\d{13}$/.test(form.tax_id)) {
      setErrorMsg("หมายเลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก");
      return;
    }
    // บังคับผ่าน Turnstile ก่อนส่ง — เช็คเฉพาะตอนตั้ง site key ไว้ (dev เครื่องที่ไม่มี
    // key ให้ส่งได้ตามปกติ ฝั่ง server จะข้ามการตรวจเช่นกันเมื่อไม่ได้ตั้ง secret key)
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setErrorMsg("กรุณายืนยันว่าคุณไม่ใช่บอทก่อนส่งคำขอ");
      return;
    }
    setErrorMsg("");
    setStatus("loading");
    try {
      const fontNames = chosenFonts.map(
        (id) => fonts.find((f) => f.id === id)?.name ?? id
      );
      
      // ผ่าน RPC submit_public_quote (0056) แทน insert ตรง — RLS ปิด insert ตรงบน quotes
      // ไปแล้ว ป้องกัน anon ตั้งค่าคอลัมน์บัญชี (quote_no, total_amount, issued_by, ...) เอง
      const { error: insertError } = await supabase.rpc("submit_public_quote", {
        p_contact_name: form.contact_name,
        p_company_name: form.company_name,
        p_address: form.address,
        p_tax_id: form.tax_id,
        p_email: form.email,
        p_license_type: form.license_type,
        p_fonts: fontNames,
        p_note: form.note || null,
        p_designer_id: designer?.id ?? null,
      });
      if (insertError) {
        console.error("quote insert failed:", insertError);
        throw insertError;
      }

      // custom tier ของ designer มาก่อน default ของเว็บ — ถ้าชื่อชนกัน ต้องได้ของ designer
      const customTiers = licenseConfig && !licenseConfig.use_default ? licenseConfig.tiers ?? [] : [];
      const licenseLabel = getLicenseLabel(form.license_type, [...customTiers, ...defaultTiers]);

      const emailPayload = {
        contact_name: form.contact_name,
        company_name: form.company_name,
        email: form.email,
        tax_id: form.tax_id,
        address: form.address,
        license_type: licenseLabel,
        fonts: fontNames.join(", "),
        note: form.note || "—",
        designer_id: designer?.id ?? null,
      };

      // ⚠️ **ห้าม throw เมื่ออีเมลไม่ออก** — คำขอถูกบันทึกลง quotes ไปแล้วโดย
      // `submit_public_quote` ข้างบน ถ้าโยนเข้า catch ผู้ใช้จะเห็น "ส่งไม่สำเร็จ" แล้วกดซ้ำ
      // → ได้แถวซ้ำใน quotes และสุดท้ายชน rate limit 5 ครั้ง/ชม. (0074) ทั้งที่ครั้งแรกสำเร็จ
      //
      // แต่ก็ห้ามเงียบเหมือนเดิม (ก่อน 7 ส.ค. 2569 ไม่เช็ค res.ok เลย) — ตอนโดเมนอีเมล
      // มีปัญหา ลูกค้าเห็น "ส่งคำขอสำเร็จ" ทั้งที่ designer ไม่เคยได้รับอะไร และไม่มีใครรู้
      // → คงหน้า success ไว้ (เพราะคำขอถึงเราจริง) แล้วเตือนเพิ่มว่าช่องแจ้งเตือนขัดข้อง
      const emailRes = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "quote", turnstile_token: turnstileToken, payload: emailPayload }),
      });
      if (!emailRes.ok) {
        console.error("quote saved but notification email failed:", emailRes.status, await emailRes.text().catch(() => ""));
        setNotifyFailed(true);
      }

      setStatus("success");
      setForm(EMPTY_FORM);
      setSelectedFonts([""]);
      resetTurnstile();
    } catch (err) {
      setStatus("error");
      // `rate_limited` มาจาก submit_public_quote (0074) — อีเมลเดียวกันส่งเกิน 5 ครั้ง/ชั่วโมง
      // ต้องบอกให้ตรงสาเหตุ ไม่งั้นคนที่กรอกถูกทุกอย่างจะนึกว่าฟอร์มพัง แล้วกดซ้ำอีก
      // ⚠️ PostgrestError เป็น plain object ไม่ใช่ Error — `instanceof Error` จับไม่ได้
      const raw =
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : String(err);
      setErrorMsg(
        raw.includes("rate_limited")
          ? "คุณส่งคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง"
          : "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"
      );
      // token ของ Turnstile ใช้ได้ครั้งเดียว — รีเซ็ต widget ให้ผู้ใช้ยืนยันใหม่ก่อน retry
      resetTurnstile();
    }
  }

  if (status === "success") {
    return (
      <>
        <Nav />
        <section className="bg-white">
          <Container className="pt-10 pb-16">
            <div className="max-w-[640px] mx-auto">
              <div className="bg-surface p-6">
                <h1 className="font-heading text-h2 text-success mb-3">✓ ส่งคำขอสำเร็จ</h1>
                <p className="font-body text-body text-grey-800 leading-[1.8] mb-2">
                  เราได้รับคำขอใบเสนอราคาของคุณแล้ว<br />
                  ทีมงานจะติดต่อกลับทางอีเมลภายใน 1–2 วันทำการ
                </p>
                <p className="font-body text-body-sm text-grey-600 leading-[1.8] mb-6">
                  หากไม่พบอีเมลตอบกลับจากเรา รบกวนตรวจสอบใน Junk Mail
                </p>
                {/* คำขอบันทึกสำเร็จแต่อีเมลแจ้งเตือนไม่ออก — ต้องบอก ไม่งั้นลูกค้ารอเก้อ
                    โดยไม่มีใครรู้ว่านักออกแบบยังไม่เคยเห็นคำขอนี้ */}
                {notifyFailed && (
                  <div className="border-l-2 border-warning bg-white p-4 mb-6">
                    <p className="font-body text-body-sm text-grey-800 leading-[1.8]">
                      หมายเหตุ: ระบบแจ้งเตือนนักออกแบบขัดข้องชั่วคราว คำขอของคุณถูกบันทึกไว้เรียบร้อยแล้ว
                      แต่หากไม่ได้รับการติดต่อกลับภายใน 2 วันทำการ รบกวนแจ้งเราที่{" "}
                      <a href={`mailto:${CONTACT_EMAIL}`} className="text-black underline decoration-danger-dark">
                        {CONTACT_EMAIL}
                      </a>
                    </p>
                  </div>
                )}
                <Button as="link" href="/">กลับหน้าแรก</Button>
              </div>
            </div>
          </Container>
        </section>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Nav />
      <section className="bg-white">
        <Container className="pt-10 pb-16">
          <div className="max-w-[640px] mx-auto">
            <div className="mb-8">
              <h1 className="font-heading text-h1 text-black mb-1">ขอใบเสนอราคา</h1>
              {designer ? (
                <p className="font-body text-body-sm text-grey-600">
                  ฟอนต์โดย{" "}
                  <span className="text-black">
                    {designer.business_name ?? designer.name}
                  </span>
                </p>
              ) : (
                <p className="font-body text-body-sm text-grey-600">สำหรับสิทธิการใช้งานองค์กรและสิทธิพิเศษ</p>
              )}
            </div>

            {/* ดีไซน์เนอร์ปิดระบบไว้ — ไม่ต้องให้กรอกจนจบแล้วค่อยโดน RPC ปฏิเสธ */}
            {quotesClosed ? (
              <div className="bg-surface px-6 py-10 text-center">
                <p className="font-body text-body text-black mb-2">
                  ดีไซน์เนอร์รายนี้ยังไม่เปิดรับใบเสนอราคา
                </p>
                <p className="font-body text-body-sm text-grey-600 leading-[1.7] mb-6 max-w-[420px] mx-auto">
                  ฟอนต์ชุดนี้ยังไม่รองรับการขอใบเสนอราคาสำหรับองค์กร
                  หากต้องการใช้งานเชิงพาณิชย์ สามารถสั่งซื้อสิทธิรายชุดได้จากหน้าฟอนต์
                </p>
                {preselectedFont && designerSlug && (
                  <Button as="link" href={`/fonts/${designerSlug}/${preselectedFont}`}>
                    ← กลับไปหน้าฟอนต์
                  </Button>
                )}
              </div>
            ) : (
            <form onSubmit={submit} className="flex flex-col gap-10">
              {/* Contact & Company */}
              <div className="flex flex-col gap-4">
                <h2 className="font-heading text-h2 text-black">ข้อมูลผู้ติดต่อ</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="ชื่อผู้ติดต่อ">
                    <input
                      type="text"
                      value={form.contact_name}
                      onChange={(e) => set("contact_name", e.target.value)}
                      placeholder="ชื่อ-นามสกุล"
                      className={FIELD}
                      required
                    />
                  </Field>
                  <Field label="อีเมล">
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => set("email", e.target.value)}
                      placeholder="example@company.com"
                      className={FIELD}
                      required
                    />
                  </Field>
                </div>

                <Field label="ชื่อห้างร้าน / องค์กร / บริษัท">
                  <input
                    type="text"
                    value={form.company_name}
                    onChange={(e) => set("company_name", e.target.value)}
                    placeholder="ชื่อองค์กร"
                    className={FIELD}
                    required
                  />
                </Field>

                <Field label="ที่อยู่">
                  <textarea
                    value={form.address}
                    onChange={(e) => set("address", e.target.value)}
                    placeholder="ที่อยู่สำหรับออกเอกสาร"
                    rows={3}
                    className={FIELD + " resize-none"}
                    required
                  />
                </Field>

                <Field label="หมายเลขประจำตัวผู้เสียภาษี">
                  <input
                    type="text"
                    value={form.tax_id}
                    onChange={(e) => set("tax_id", e.target.value)}
                    placeholder="0000000000000"
                    className={FIELD}
                    maxLength={13}
                    required
                  />
                </Field>
              </div>

              {/* License Type */}
              <div className="flex flex-col gap-3">
                <h2 className="font-heading text-h2 text-black">
                  รูปแบบสิทธิการใช้งานที่ต้องการ
                </h2>

                {licenseConfig && !licenseConfig.use_default && licenseConfig.tiers ? (
                  licenseConfig.tiers.map((tier) => (
                      <label
                        key={tier.id}
                        className={`flex items-start gap-3 p-3.5 cursor-pointer transition-colors ${
                          form.license_type === tier.id ? "bg-mint" : "bg-surface hover:bg-grey-200/60"
                        }`}
                      >
                        <input
                          type="radio"
                          name="license_type"
                          value={tier.id}
                          checked={form.license_type === tier.id}
                          onChange={() => set("license_type", tier.id)}
                          className="mt-0.5 accent-black"
                        />
                        <div className="flex-1 flex items-start justify-between">
                          <div>
                            <div className="font-body text-body text-black">{tier.name}</div>
                            {tier.desc && (
                              <div className="font-body text-body-sm text-grey-600 mt-0.5">{tier.desc}</div>
                            )}
                          </div>
                          <div className="font-heading text-body text-black ml-3 shrink-0">
                            ฿{tier.price.toLocaleString()}
                          </div>
                        </div>
                      </label>
                    ))
                ) : (
                  defaultTiers.map((tier) => (
                    <label
                      key={tier.id}
                      className={`flex items-start gap-3 p-3.5 cursor-pointer transition-colors ${
                        form.license_type === tier.id ? "bg-mint" : "bg-surface hover:bg-grey-200/60"
                      }`}
                    >
                      <input
                        type="radio"
                        name="license_type"
                        value={tier.id}
                        checked={form.license_type === tier.id}
                        onChange={() => set("license_type", tier.id)}
                        className="mt-0.5 accent-black"
                      />
                      <div>
                        <div className="font-body text-body text-black">{tier.name}</div>
                        {tier.desc && (
                          <div className="font-body text-body-sm text-grey-600 mt-0.5">{tier.desc}</div>
                        )}
                      </div>
                    </label>
                  ))
                )}

                <p className="font-body text-body-sm text-grey-600 mt-1">
                  รายละเอียด{" "}
                  <LicenseLink
                    pdfUrl={designerLicensePdf(licenseConfig)}
                    newTab
                    className="text-mint-text font-body text-body-sm hover:underline"
                  />
                </p>
              </div>

              {/* Font Selection */}
              <div className="flex flex-col gap-3">
                <h2 className="font-heading text-h2 text-black">
                  โปรแกรมคอมพิวเตอร์ฟอนต์ที่ต้องการสั่งซื้อ
                </h2>

                <div className="flex flex-col gap-2">
                  {selectedFonts.map((val, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select
                        value={val}
                        onChange={(e) => setFont(idx, e.target.value)}
                        className={FIELD + " flex-1"}
                      >
                        <option value="">— เลือกฟอนต์ —</option>
                        {fonts.map((f) => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                      {selectedFonts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeFont(idx)}
                          className="w-10 h-10 flex items-center justify-center bg-surface text-grey-600 hover:bg-danger hover:text-white transition-colors cursor-pointer shrink-0"
                          aria-label="ลบ"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addFont}
                  className="self-start flex items-center gap-1.5 font-body text-body-sm text-mint-text cursor-pointer border-none bg-transparent p-0 hover:opacity-70 transition-opacity"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  เพิ่มฟอนต์
                </button>
              </div>

              {/* Note — ไม่บังคับ */}
              <div>
                <Field label="หมายเหตุเพิ่มเติม (ไม่บังคับ)">
                  <textarea
                    value={form.note}
                    onChange={(e) => set("note", e.target.value)}
                    placeholder="รายละเอียดเพิ่มเติม เช่น จำนวนเครื่อง ประเภทงาน ฯลฯ"
                    rows={3}
                    className={FIELD + " resize-none"}
                  />
                </Field>
              </div>


              {/* Cloudflare Turnstile — แสดงเฉพาะตอนตั้ง site key ไว้เท่านั้น */}
              {TURNSTILE_SITE_KEY && (
                <div className="flex justify-end">
                  <div ref={turnstileContainerRef} />
                </div>
              )}

              {errorMsg && (
                <p className="font-body text-body-sm text-danger-dark text-right">{errorMsg}</p>
              )}

              <div className="flex items-center justify-end gap-6">
                <Link
                  href={
                    preselectedFont && designerSlug
                      ? `/fonts/${designerSlug}/${preselectedFont}`
                      : preselectedFont
                      ? `/fonts/${preselectedFont}`
                      : "/"
                  }
                  className="font-body text-body-sm text-grey-600 no-underline hover:text-black transition-colors"
                >
                  ยกเลิก
                </Link>
                <Button
                  type="submit"
                  disabled={status === "loading" || (!!TURNSTILE_SITE_KEY && !turnstileToken)}
                >
                  {status === "loading" ? "กำลังส่ง..." : "ส่งคำขอใบเสนอราคา"}
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