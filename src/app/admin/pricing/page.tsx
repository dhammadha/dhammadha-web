"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Button from "@/components/Button";

export default function AdminPricingPage() {
  const [licSmall, setLicSmall] = useState("3500");
  const [licLarge, setLicLarge] = useState("7000");
  const [licExtra, setLicExtra] = useState("20000");

  const [promoDiscount, setPromoDiscount] = useState("");
  const [promoEnd, setPromoEnd] = useState("");
  const [promoActive, setPromoActive] = useState(false);

  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);

  const showToast = (msg: string, error = false) => {
    setToast({ msg, error });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    supabase.from("settings").select("value").eq("key", "licensing").single().then(({ data }) => {
      if (!data) return;
      const v = data.value as { small?: number; large?: number; extra?: number };
      if (v.small) setLicSmall(String(v.small));
      if (v.large) setLicLarge(String(v.large));
      if (v.extra) setLicExtra(String(v.extra));
    });
    supabase.from("settings").select("value").eq("key", "promotion").single().then(({ data }) => {
      if (!data) return;
      const v = data.value as { discount_percent?: number; sale_end?: string; active?: boolean };
      if (v.discount_percent) setPromoDiscount(String(v.discount_percent));
      if (v.sale_end) setPromoEnd(v.sale_end);
      setPromoActive(!!v.active);
    });
  }, []);

  const saveLicensing = async () => {
    const val = { small: parseInt(licSmall) || 3500, large: parseInt(licLarge) || 7000, extra: parseInt(licExtra) || 20000 };
    const { error } = await supabase.from("settings").upsert({ key: "licensing", value: val });
    if (error) showToast("เกิดข้อผิดพลาด: " + error.message, true);
    else showToast("✓ บันทึกราคา Licensing เรียบร้อย");
  };

  const savePromotion = async () => {
    const disc = parseInt(promoDiscount) || 0;
    if (!disc) { showToast("กรุณาใส่ส่วนลด %", true); return; }
    if (!confirm(`ยืนยันเปิดโปรโมชั่น ลด ${disc}%${promoEnd ? ` ถึง ${promoEnd}` : ""}?\nจะอัปเดตฟอนต์ทุกตัวที่ไม่ใช่ฟรีทันที`)) return;
    try {
      await supabase.from("settings").upsert({ key: "promotion", value: { discount_percent: disc, sale_end: promoEnd, active: true } });
      const { data: fonts } = await supabase.from("fonts").select("id, price").eq("is_free", false);
      if (fonts) {
        for (const f of fonts) {
          const price = f.price ?? 0;
          await supabase.from("fonts").update({
            is_sale: true, discount_percent: disc,
            sale_price: Math.round(price * (1 - disc / 100)),
            sale_end: promoEnd || null, sale_label: `ลด ${disc}%`,
          }).eq("id", f.id);
        }
      }
      setPromoActive(true);
      showToast("✓ เปิดโปรโมชั่น — อัปเดตฟอนต์ทั้งหมดแล้ว");
    } catch (e: unknown) {
      showToast("เกิดข้อผิดพลาด: " + (e instanceof Error ? e.message : String(e)), true);
    }
  };

  const clearPromotion = async () => {
    if (!confirm("ปิดโปรโมชั่นทั้งหมด?")) return;
    try {
      await supabase.from("settings").upsert({ key: "promotion", value: { discount_percent: 0, sale_end: "", active: false } });
      const { data: fonts } = await supabase.from("fonts").select("id").eq("is_sale", true).eq("is_free", false);
      if (fonts) {
        for (const f of fonts) {
          await supabase.from("fonts").update({ is_sale: false, discount_percent: null, sale_price: null, sale_end: null, sale_label: null }).eq("id", f.id);
        }
      }
      setPromoDiscount(""); setPromoEnd(""); setPromoActive(false);
      showToast("✓ ปิดโปรโมชั่น — รีเซ็ตฟอนต์ทั้งหมดแล้ว");
    } catch (e: unknown) {
      showToast("เกิดข้อผิดพลาด: " + (e instanceof Error ? e.message : String(e)), true);
    }
  };

  return (
    <div className="p-6 max-w-[680px] flex flex-col gap-8">
      {/* Licensing */}
      <Section title="ราคาองค์กร" desc="ราคาสิทธิ์ใช้งานองค์กรที่แสดงในหน้าฟอนต์">
        <div className="grid grid-cols-1 gap-3">
          <Field label="บริษัทขนาดเล็ก / กลาง (฿) — ไม่เกิน 10 เครื่อง">
            <input type="number" value={licSmall} onChange={(e) => setLicSmall(e.target.value)} className={iCls} />
          </Field>
          <Field label="บริษัทใหญ่ / Ad Agency (฿) — ไม่จำกัดจำนวนเครื่อง">
            <input type="number" value={licLarge} onChange={(e) => setLicLarge(e.target.value)} className={iCls} />
          </Field>
          <Field label="ใช้งานเพิ่มเติม ตามข้อ (3) ในสัญญาอนุญาต (฿)">
            <input type="number" value={licExtra} onChange={(e) => setLicExtra(e.target.value)} className={iCls} />
          </Field>
        </div>
        <Button onClick={saveLicensing} className="w-full mt-4">บันทึกราคา Licensing</Button>
      </Section>

      {/* Promotion */}
      <Section title="โปรโมชั่นทั้งหมด" desc="เปิด/ปิดโปรโมชั่นสำหรับฟอนต์ทุกตัวที่ไม่ใช่ฟรีพร้อมกัน">
        {promoActive && (
          <div className="mb-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-[13px] text-amber-700">
            ⚡ โปรโมชั่นเปิดอยู่: ลด {promoDiscount}%{promoEnd ? ` ถึง ${promoEnd}` : ""}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="ส่วนลด (%)">
            <input type="number" value={promoDiscount} onChange={(e) => setPromoDiscount(e.target.value)} placeholder="เช่น 30" min="0" max="100" className={iCls} />
          </Field>
          <Field label="วันสิ้นสุดโปรโมชั่น">
            <input type="date" value={promoEnd} onChange={(e) => setPromoEnd(e.target.value)} className={iCls} />
          </Field>
        </div>
        <div className="flex gap-2 mt-4">
          <Button onClick={savePromotion} className="flex-1">บันทึก / เปิดโปรโมชั่น</Button>
          {promoActive && (
            <button onClick={clearPromotion} className="px-4 py-2 rounded-xl border border-red-200 text-red-500 bg-red-50 text-[14px] font-medium cursor-pointer hover:bg-red-100 transition-colors">
              ปิดโปรโมชั่น
            </button>
          )}
        </div>
      </Section>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[200] px-4 py-3 rounded-xl text-[13px] font-medium shadow-lg ${toast.error ? "bg-red-500 text-white" : "bg-navy text-white"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

const iCls = "w-full px-3 py-2 rounded-xl border border-border bg-[#fafaf8] text-[14px] text-navy outline-none focus:border-mint focus:shadow-[0_0_0_3px_#5ECEC820] transition-all font-[inherit]";

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-border p-6">
      <div className="mb-4">
        <h2 className="text-[16px] font-semibold text-navy">{title}</h2>
        <p className="text-[12px] text-[#aaa] mt-0.5">{desc}</p>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-medium text-[#666]">{label}</label>
      {children}
    </div>
  );
}
