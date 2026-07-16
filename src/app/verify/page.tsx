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
import { supabase } from "@/lib/supabase";

type VerifyResult = {
  valid: boolean;
  order_no?: string;
  paid_at?: string;
  licensed_to?: string;
  fonts?: string[];
};

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
    <main className="min-h-screen bg-bg px-4 py-12">
      <div className="max-w-[560px] mx-auto">
        <h1 className="text-[24px] font-semibold text-navy mb-2">ตรวจสอบสิทธิการใช้งานฟอนต์</h1>
        <p className="text-[14px] text-[#888] mb-6">
          กรอกรหัสยืนยันที่ประทับอยู่ในไฟล์ฟอนต์ (ดูได้จาก License URL ใน Font Book
          บน macOS, Properties บน Windows หรือ fontdrop.info) หรือเปิดลิงก์ตรวจสอบโดยตรงจากไฟล์
        </p>

        <form
          onSubmit={(e) => { e.preventDefault(); check(token); }}
          className="flex gap-2 mb-6"
        >
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="รหัสยืนยันจาก License URL"
            className="flex-1 border border-border rounded-xl px-4 py-2.5 text-[14px] text-navy bg-white"
          />
          <button
            type="submit"
            disabled={checking}
            className="px-5 py-2.5 rounded-xl bg-mint text-white text-[14px] font-semibold border-none cursor-pointer hover:bg-navy transition-colors disabled:opacity-50"
          >
            {checking ? "กำลังตรวจ…" : "ตรวจสอบ"}
          </button>
        </form>

        {result && (
          result.valid ? (
            <div className="bg-white rounded-2xl border border-mint-mid p-6">
              <div className="text-[15px] font-semibold text-green-600 mb-3">✓ คำสั่งซื้อนี้ถูกต้อง</div>
              <div className="grid grid-cols-[130px_1fr] gap-y-2 text-[14px]">
                <span className="text-[#aaa]">เลขคำสั่งซื้อ</span>
                <span className="text-navy font-medium">{result.order_no}</span>
                <span className="text-[#aaa]">ผู้ได้รับสิทธิ์</span>
                <span className="text-navy">{result.licensed_to}</span>
                <span className="text-[#aaa]">วันที่ชำระ</span>
                <span className="text-navy">
                  {result.paid_at ? new Date(result.paid_at).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" }) : "-"}
                </span>
                <span className="text-[#aaa]">ฟอนต์</span>
                <span className="text-navy">{result.fonts?.join(", ")}</span>
              </div>
              <p className="text-[12px] text-[#aaa] mt-4">
                สิทธิ์การใช้งานเป็นของผู้ซื้อตามเงื่อนไข license ที่ระบุในคำสั่งซื้อเท่านั้น
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-red-200 p-6">
              <div className="text-[15px] font-semibold text-red-500 mb-1">✕ ไม่พบคำสั่งซื้อนี้</div>
              <p className="text-[13px] text-[#888]">
                เลขคำสั่งซื้อไม่ถูกต้อง หรือไฟล์ฟอนต์นี้อาจไม่ได้มาจากการซื้อผ่าน dhammadha.com
                — หากคุณเชื่อว่าไฟล์ถูกละเมิดลิขสิทธิ์ แจ้งได้ที่ info@dhammadha.com
              </p>
            </div>
          )
        )}
      </div>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <>
      <Nav />
      <Suspense fallback={<main className="min-h-screen bg-bg" />}>
        <VerifyContent />
      </Suspense>
      <Footer />
    </>
  );
}
