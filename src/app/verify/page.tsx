"use client";

// หน้า verify สาธารณะ — URL นี้ถูกประทับใน name table (nameID 14) ของไฟล์ฟอนต์
// ที่ขายออกไป: dhammadha.com/verify?token=<verify_token สุ่ม 32 hex>
// ใครก็ตรวจได้ว่าไฟล์ที่ถืออยู่มาจากคำสั่งซื้อจริงหรือไม่ (ไม่เปิดเผยข้อมูลลูกค้า)
//
// เดิมใช้ order_no (?order=OR-2569-0001) แต่ order_no เดินเลขลำดับ เดา/วนลูปได้ง่าย
// เปลี่ยนเป็น verify_token สุ่มตั้งแต่ 0055 — โหลดผ่านลิงก์ในไฟล์ฟอนต์เท่านั้น
// (พิมพ์เองยากกว่าเดิม แต่ตั้งใจ — token ต้อง copy จากไฟล์/ลิงก์ ไม่ใช่เลขที่จำง่าย)

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";

type VerifyResult = {
  valid: boolean;
  order_no?: string;
  paid_at?: string;
  licensed_to?: string;
  fonts?: string[];
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <span className="font-body text-body-sm text-grey-600">{label}</span>
      <span className="font-body text-body text-black">{value}</span>
    </>
  );
}

function VerifyContent() {
  const params = useSearchParams();
  const initial = params.get("token") ?? "";
  const [token, setToken] = useState(initial);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [checking, setChecking] = useState(false);

  const check = async (t: string) => {
    if (!t.trim()) return;
    setChecking(true);
    const { data } = await supabase.rpc("verify_order", { p_token: t.trim() });
    setResult((data as VerifyResult) ?? { valid: false });
    setChecking(false);
  };

  useEffect(() => {
    if (initial) check(initial);
  }, [initial]);

  return (
    <section className="bg-white">
      <Container className="pt-10 pb-16">
        <div className="max-w-[640px] mx-auto">
          <h1 className="font-heading text-h1 text-black mb-3">ตรวจสอบสิทธิการใช้งานฟอนต์</h1>
          <p className="font-body text-body text-grey-600 leading-[1.8] mb-8">
            กรอกรหัสยืนยันที่ประทับอยู่ในไฟล์ฟอนต์ (ดูได้จาก License URL ใน Font Book
            บน macOS, Properties บน Windows หรือ fontdrop.info) หรือเปิดลิงก์ตรวจสอบโดยตรงจากไฟล์
          </p>

          <form
            onSubmit={(e) => { e.preventDefault(); check(token); }}
            className="flex flex-col sm:flex-row gap-2 mb-10"
          >
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="รหัสยืนยันจาก License URL"
              aria-label="รหัสยืนยัน"
              // text-body-sm = มาตรฐานเดียวกับช่องค้นหาใน Nav / ui/Input.tsx
              className="flex-1 bg-surface px-4 py-3 font-body text-body-sm text-black placeholder:text-grey-400 border-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            />
            <Button type="submit" size="lg" disabled={checking} className="shrink-0">
              {checking ? "กำลังตรวจ…" : "ตรวจสอบ"}
            </Button>
          </form>

          {result && (
            result.valid ? (
              <div className="bg-surface p-6">
                <div className="font-heading text-h2 text-success mb-4">✓ คำสั่งซื้อนี้ถูกต้อง</div>
                <div className="grid grid-cols-[130px_1fr] gap-y-2.5 items-baseline">
                  <Row label="เลขคำสั่งซื้อ" value={result.order_no} />
                  <Row label="ผู้ได้รับสิทธิ์" value={result.licensed_to} />
                  <Row
                    label="วันที่ชำระ"
                    value={result.paid_at
                      ? new Date(result.paid_at).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })
                      : "-"}
                  />
                  <Row label="ฟอนต์" value={result.fonts?.join(", ")} />
                </div>
                <p className="font-body text-footnote text-grey-600 mt-5">
                  สิทธิ์การใช้งานเป็นของผู้ซื้อตามเงื่อนไข license ที่ระบุในคำสั่งซื้อเท่านั้น
                </p>
              </div>
            ) : (
              <div className="bg-surface p-6">
                <div className="font-heading text-h2 text-danger-dark mb-2.5">✕ ไม่พบคำสั่งซื้อนี้</div>
                <p className="font-body text-body text-grey-800 leading-[1.8]">
                  รหัสยืนยันไม่ถูกต้อง หรือไฟล์ฟอนต์นี้อาจไม่ได้มาจากการซื้อผ่าน dhammadha.com
                  — หากคุณเชื่อว่าไฟล์ถูกละเมิดลิขสิทธิ์ แจ้งได้ที่{" "}
                  <a href="mailto:info@dhammadha.com" className="text-mint-text">info@dhammadha.com</a>
                </p>
              </div>
            )
          )}
        </div>
      </Container>
    </section>
  );
}

export default function VerifyPage() {
  return (
    <>
      <Nav />
      <Suspense fallback={<section className="bg-white min-h-[60vh]" />}>
        <VerifyContent />
      </Suspense>
      <Footer />
    </>
  );
}
