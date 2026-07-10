"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import Button from "@/components/Button";

type Tier = { name: string; price: number };
type PromoState = { discount: string; end: string; active: boolean };

const DEFAULT_TIERS: Tier[] = [
  { name: "บริษัทขนาดเล็ก / กลาง", price: 3500 },
  { name: "บริษัทขนาดใหญ่ / Ad Agency", price: 7000 },
  { name: "สิทธิการใช้งานเพิ่มเติม", price: 20000 },
];

export default function DesignerPricingPage() {
  const { user } = useAuth();
  const [useDefault, setUseDefault] = useState(true);
  const [tiers, setTiers] = useState<Tier[]>(DEFAULT_TIERS);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [promo, setPromo] = useState<PromoState>({ discount: "", end: "", active: false });
  const [promoSaving, setPromoSaving] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("designer_license_config")
      .select("*")
      .eq("designer_id", user.id)
      .single();
    if (data) {
      setUseDefault(data.use_default);
      setPdfUrl(data.license_pdf_url ?? null);
      if (!data.use_default && data.tiers) {
        setTiers(data.tiers as Tier[]);
      }
    }
    // Load active promo from own fonts
    const { data: promoFont } = await supabase
      .from("fonts")
      .select("discount_percent, sale_end, is_sale")
      .eq("owner_id", user.id)
      .eq("is_sale", true)
      .limit(1)
      .single();
    if (promoFont) {
      setPromo({ discount: String(promoFont.discount_percent ?? ""), end: promoFont.sale_end ?? "", active: true });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const savePromo = async () => {
    if (!user) return;
    const disc = parseInt(promo.discount) || 0;
    if (!disc) { showToast("กรุณาใส่ส่วนลด %"); return; }
    if (!confirm(`ยืนยันเปิดโปรโมชั่น ลด ${disc}%${promo.end ? ` ถึง ${promo.end}` : ""}?\nจะอัปเดตฟอนต์ทุกตัวของคุณที่ไม่ใช่ฟรีทันที`)) return;
    setPromoSaving(true);
    try {
      const { data: fonts } = await supabase.from("fonts").select("id, price").eq("owner_id", user.id).eq("is_free", false);
      if (fonts) {
        for (const f of fonts) {
          await supabase.from("fonts").update({
            is_sale: true, discount_percent: disc,
            sale_price: Math.round((f.price ?? 0) * (1 - disc / 100)),
            sale_end: promo.end || null, sale_label: `ลด ${disc}%`,
          }).eq("id", f.id);
        }
      }
      setPromo((p) => ({ ...p, active: true }));
      showToast("✓ เปิดโปรโมชั่น — อัปเดตฟอนต์ทั้งหมดแล้ว");
    } catch { showToast("เกิดข้อผิดพลาด กรุณาลองใหม่"); }
    setPromoSaving(false);
  };

  const clearPromo = async () => {
    if (!user) return;
    if (!confirm("ปิดโปรโมชั่นทั้งหมด?")) return;
    setPromoSaving(true);
    try {
      const { data: fonts } = await supabase.from("fonts").select("id").eq("owner_id", user.id).eq("is_sale", true);
      if (fonts) {
        for (const f of fonts) {
          await supabase.from("fonts").update({ is_sale: false, discount_percent: null, sale_price: null, sale_end: null, sale_label: null }).eq("id", f.id);
        }
      }
      setPromo({ discount: "", end: "", active: false });
      showToast("✓ ปิดโปรโมชั่นแล้ว");
    } catch { showToast("เกิดข้อผิดพลาด กรุณาลองใหม่"); }
    setPromoSaving(false);
  };

  const resetToDefault = () => {
    setTiers(DEFAULT_TIERS);
    setUseDefault(true);
    setPdfFile(null);
    setPdfUrl(null);
  };

  const setTierField = (i: number, field: keyof Tier, val: string) => {
    setTiers((prev) => prev.map((t, idx) =>
      idx === i ? { ...t, [field]: field === "price" ? Number(val) : val } : t
    ));
  };

  const addTier = () => setTiers((prev) => [...prev, { name: "", price: 0 }]);
  const removeTier = (i: number) => setTiers((prev) => prev.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      let uploadedPdfUrl = pdfUrl;

      if (!useDefault && pdfFile) {
        const ext = pdfFile.name.split(".").pop();
        const path = `license-pdf/${user.id}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("license-pdf")
          .upload(path, pdfFile, { upsert: true, contentType: "application/pdf" });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("license-pdf").getPublicUrl(path);
        uploadedPdfUrl = urlData.publicUrl;
      }

      if (useDefault) uploadedPdfUrl = null;

      await supabase.from("designer_license_config").upsert({
        designer_id: user.id,
        use_default: useDefault,
        tiers: useDefault ? null : tiers,
        license_pdf_url: uploadedPdfUrl,
      }, { onConflict: "designer_id" });

      setPdfUrl(uploadedPdfUrl);
      setPdfFile(null);
      showToast("✓ บันทึกแล้ว");
    } catch {
      showToast("เกิดข้อผิดพลาด กรุณาลองใหม่");
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="p-6 text-[#aaa] text-[14px]">กำลังโหลด…</div>;
  }

  return (
    <div className="p-6 max-w-[640px]">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[20px] font-semibold text-navy">ราคาและโปรโมชั่น</h1>
        {!useDefault && (
          <button
            onClick={resetToDefault}
            className="text-[12px] text-[#aaa] hover:text-navy bg-transparent border-none cursor-pointer transition-colors p-0"
          >
            คืนค่า default ของเว็บ
          </button>
        )}
      </div>

      {/* License section */}
      <div className="bg-white rounded-2xl border border-border p-5 mb-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={!useDefault}
            onChange={(e) => {
              setUseDefault(!e.target.checked);
              if (!e.target.checked) setTiers(DEFAULT_TIERS);
            }}
            className="mt-0.5 accent-[#0a8a84] shrink-0"
          />
          <div>
            <span className="text-[14px] font-medium text-navy">ตั้งค่าสิทธิการใช้งานเอง</span>
            <p className="text-[12px] text-[#aaa] mt-0.5 leading-[1.6]">
              หากไม่ติ๊ก จะใช้ค่า default ของ DHAMMADHA STUDIO (tier และราคามาตรฐาน)
            </p>
          </div>
        </label>
      </div>

      {!useDefault && (
        <>
          <div className="bg-white rounded-2xl border border-border p-5 mb-4">
            <h2 className="text-[14px] font-semibold text-navy mb-4">รูปแบบสิทธิและราคา</h2>
            <div className="flex flex-col gap-3">
              {tiers.map((tier, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 flex flex-col gap-2">
                    <input
                      type="text"
                      value={tier.name}
                      onChange={(e) => setTierField(i, "name", e.target.value)}
                      placeholder="ชื่อ tier เช่น บริษัทขนาดเล็ก"
                      className="w-full px-3 py-2 border border-[0.5px] border-[#ddd] rounded-[8px] text-[13px] text-navy outline-none focus:border-mint bg-white"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] text-[#aaa]">฿</span>
                      <input
                        type="number"
                        value={tier.price}
                        onChange={(e) => setTierField(i, "price", e.target.value)}
                        placeholder="0"
                        min="0"
                        className="w-full px-3 py-2 border border-[0.5px] border-[#ddd] rounded-[8px] text-[13px] text-navy outline-none focus:border-mint bg-white"
                      />
                    </div>
                  </div>
                  {tiers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTier(i)}
                      className="w-8 h-8 mt-1 flex items-center justify-center rounded-[6px] border border-[0.5px] border-[#ddd] text-[#bbb] hover:border-red-300 hover:text-red-400 transition-colors bg-white cursor-pointer shrink-0"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            {tiers.length < 5 && (
              <button
                type="button"
                onClick={addTier}
                className="mt-3 flex items-center gap-1.5 text-[13px] text-[#0a8a84] cursor-pointer border-none bg-transparent p-0 hover:opacity-70 transition-opacity"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                เพิ่ม tier
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-border p-5 mb-4">
            <h2 className="text-[14px] font-semibold text-navy mb-1">ไฟล์สัญญาอนุญาต (PDF)</h2>
            <p className="text-[12px] text-[#aaa] mb-4 leading-[1.6]">
              จำเป็นต้องแนบเมื่อตั้งค่าสิทธิเอง — จะแสดงให้ลูกค้าดูใน lightbox ในหน้าขอใบเสนอราคา
            </p>

            {pdfUrl && !pdfFile && (
              <div className="flex items-center gap-2 mb-3 p-3 bg-[#f8f8f6] rounded-xl">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-5 h-5 text-[#e74c3c] shrink-0">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-[13px] text-mint no-underline hover:underline flex-1 truncate">
                  ดูไฟล์ที่อัปโหลด
                </a>
              </div>
            )}

            <label className="flex items-center gap-3 px-4 py-3 border border-[0.5px] border-dashed border-[#ccc] rounded-xl cursor-pointer hover:border-mint transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-5 h-5 text-[#aaa] shrink-0">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span className="text-[13px] text-[#888]">
                {pdfFile ? pdfFile.name : "เลือกไฟล์ PDF"}
              </span>
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
              />
            </label>

            {!pdfUrl && !pdfFile && (
              <p className="text-[11px] text-amber-600 mt-2">⚠️ ยังไม่มีไฟล์ PDF — กรุณาอัปโหลดก่อนบันทึก</p>
            )}
          </div>
        </>
      )}

      {useDefault && (
        <div className="bg-white rounded-2xl border border-border p-5 mb-4">
          <h2 className="text-[14px] font-semibold text-navy mb-3">สิทธิ default ของเว็บ</h2>
          <div className="flex flex-col gap-2">
            {DEFAULT_TIERS.map((t) => (
              <div key={t.name} className="flex justify-between items-center py-2 border-b border-[#f5f5f2] last:border-0">
                <span className="text-[13px] text-[#555]">{t.name}</span>
                <span className="text-[13px] font-medium text-navy">฿{t.price.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <p className="text-[12px] text-[#aaa] mt-3">
            ราคาจริงอ้างอิงจากตารางราคา — ติ๊ก "ตั้งค่าสิทธิการใช้งานเอง" เพื่อปรับแก้
          </p>
        </div>
      )}

      <div className="flex justify-end mb-8">
        <Button
          onClick={save}
          disabled={saving || (!useDefault && !pdfUrl && !pdfFile)}
        >
          {saving ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
      </div>

      {/* Promotion section */}
      <div className="bg-white rounded-2xl border border-border p-5 mb-4">
        <h2 className="text-[15px] font-semibold text-navy mb-1">โปรโมชั่น</h2>
        <p className="text-[12px] text-[#aaa] mb-4">เปิด/ปิดส่วนลดสำหรับฟอนต์ทุกตัวของคุณที่ไม่ใช่ฟรีพร้อมกัน</p>
        {promo.active && (
          <div className="mb-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-[13px] text-amber-700">
            ⚡ โปรโมชั่นเปิดอยู่: ลด {promo.discount}%{promo.end ? ` ถึง ${promo.end}` : ""}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-[#666]">ส่วนลด (%)</label>
            <input type="number" value={promo.discount} onChange={(e) => setPromo((p) => ({ ...p, discount: e.target.value }))} placeholder="เช่น 20" min="1" max="100" className={iCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-[#666]">วันสิ้นสุด (ไม่บังคับ)</label>
            <input type="date" value={promo.end} onChange={(e) => setPromo((p) => ({ ...p, end: e.target.value }))} className={iCls} />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={savePromo} disabled={promoSaving} className="flex-1 py-2 rounded-xl bg-mint text-white text-[14px] font-medium border-none cursor-pointer hover:bg-[#4dbfb9] transition-colors disabled:opacity-50">
            {promoSaving ? "กำลังบันทึก…" : "บันทึก / เปิดโปรโมชั่น"}
          </button>
          {promo.active && (
            <button onClick={clearPromo} disabled={promoSaving} className="px-4 py-2 rounded-xl border border-red-200 text-red-500 bg-red-50 text-[14px] font-medium cursor-pointer hover:bg-red-100 transition-colors disabled:opacity-50">
              ปิดโปรโมชั่น
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-[190] px-4 py-3 rounded-xl bg-navy text-white text-[13px] font-medium shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

const iCls = "w-full px-3 py-2 rounded-xl border border-border bg-[#fafaf8] text-[14px] text-navy outline-none focus:border-mint focus:shadow-[0_0_0_3px_#5ECEC820] transition-all font-[inherit]";
