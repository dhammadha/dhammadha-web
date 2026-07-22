"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import Button from "@/components/ui/Button";
import {
  DEFAULT_LICENSE_TIERS,
  parseLicenseSettings,
  parseDesignerTiers,
  newTierId,
  type LicenseTier,
} from "@/lib/license";
import { todayISO, formatSaleEnd } from "@/lib/sale";

type PromoState = { discount: string; end: string; active: boolean };

export default function OwnPricing() {
  const { user } = useAuth();
  const [useDefault, setUseDefault] = useState(true);
  const [defaultTiers, setDefaultTiers] = useState<LicenseTier[]>(DEFAULT_LICENSE_TIERS);
  const [tiers, setTiers] = useState<LicenseTier[]>(DEFAULT_LICENSE_TIERS);
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

    // ราคา default ของเว็บ — อ่านจาก settings.licensing (site-wide, จัดการที่ /admin/license)
    const { data: settingsRow } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "licensing")
      .single();
    const parsedDefaults = parseLicenseSettings(settingsRow?.value);
    setDefaultTiers(parsedDefaults);

    const { data } = await supabase
      .from("designer_license_config")
      .select("*")
      .eq("designer_id", user.id)
      .single();
    if (data) {
      setUseDefault(data.use_default);
      setPdfUrl(data.license_pdf_url ?? null);
      if (!data.use_default && data.tiers) {
        // mintMissingIds: หน้านี้เป็น editor — tier เก่าที่ยังไม่มี id จะได้ id ถาวร
        // แล้วเขียนลง DB ตอนกดบันทึก
        setTiers(parseDesignerTiers(data.tiers, { mintMissingIds: true }));
      } else {
        setTiers(parsedDefaults);
      }
    } else {
      setTiers(parsedDefaults);
    }
    // Load active shop promo (โปรร้าน — layer แยกจาก sale_* รายฟอนต์)
    const { data: promoRow } = await supabase
      .from("designer_promotions")
      .select("discount_percent, sale_end")
      .eq("designer_id", user.id)
      .maybeSingle();
    if (promoRow) {
      setPromo({ discount: String(promoRow.discount_percent), end: promoRow.sale_end, active: true });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const savePromo = async () => {
    if (!user) return;
    const disc = parseInt(promo.discount) || 0;
    if (!disc) { showToast("กรุณาใส่ส่วนลด %"); return; }
    // ส่วนลดต้องมีวันหมดอายุเสมอ — ไม่งั้นโปรฯ ไม่มีวันสิ้นสุดจริง (ดู isSaleActive ใน lib/sale)
    if (!promo.end) { showToast("กรุณาใส่วันสิ้นสุดโปรโมชั่น"); return; }
    if (promo.end < todayISO()) { showToast("วันสิ้นสุดต้องไม่เป็นวันที่ผ่านมาแล้ว"); return; }
    if (!confirm(`ยืนยันเปิดโปรโมชั่นทั้งร้าน ลด ${disc}% ถึง ${formatSaleEnd(promo.end)}?\nส่วนลดรายฟอนต์ที่ตั้งไว้จะไม่ถูกลบ — ระหว่างโปรร้านทำงาน ฟอนต์ทุกตัวใช้ส่วนลดร้าน และกลับมาใช้ส่วนลดรายฟอนต์เมื่อโปรร้านหมดอายุ`)) return;
    setPromoSaving(true);
    try {
      const { error } = await supabase.from("designer_promotions").upsert({
        designer_id: user.id, discount_percent: disc, sale_end: promo.end,
      }, { onConflict: "designer_id" });
      if (error) throw error;
      setPromo((p) => ({ ...p, active: true }));
      showToast("✓ เปิดโปรโมชั่นทั้งร้านแล้ว");
    } catch { showToast("เกิดข้อผิดพลาด กรุณาลองใหม่"); }
    setPromoSaving(false);
  };

  const clearPromo = async () => {
    if (!user) return;
    if (!confirm("ปิดโปรโมชั่นทั้งหมด?")) return;
    setPromoSaving(true);
    try {
      const { error } = await supabase.from("designer_promotions").delete().eq("designer_id", user.id);
      if (error) throw error;
      setPromo({ discount: "", end: "", active: false });
      showToast("✓ ปิดโปรโมชั่นแล้ว");
    } catch { showToast("เกิดข้อผิดพลาด กรุณาลองใหม่"); }
    setPromoSaving(false);
  };

  const resetToDefault = () => {
    setTiers(defaultTiers);
    setUseDefault(true);
    setPdfFile(null);
    setPdfUrl(null);
  };

  // id แก้ไม่ได้ — ต้องนิ่งถาวรเพื่อให้ใบเสนอราคาเก่ายังอ้างถึง tier ได้หลังเปลี่ยนชื่อ
  const setTierField = (i: number, field: "name" | "desc" | "price", val: string) => {
    setTiers((prev) => prev.map((t, idx) =>
      idx === i ? { ...t, [field]: field === "price" ? Number(val) : val } : t
    ));
  };

  const addTier = () => setTiers((prev) => [...prev, { id: newTierId(), name: "", desc: "", price: 0 }]);
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
    return <div className="p-6 font-body text-body-sm text-grey-600">กำลังโหลด…</div>;
  }

  return (
    <div className="p-6 max-w-[720px]">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-h2 text-black">ราคาและโปรโมชั่น</h1>
        {!useDefault && (
          <button
            onClick={resetToDefault}
            className="font-body text-body-sm text-grey-600 hover:text-black bg-transparent border-none cursor-pointer transition-colors duration-150 ease-base p-0"
          >
            คืนค่า default ของเว็บ
          </button>
        )}
      </div>

      {/* License section */}
      <div className="bg-surface p-5 mb-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={!useDefault}
            onChange={(e) => {
              setUseDefault(!e.target.checked);
              if (!e.target.checked) setTiers(defaultTiers);
            }}
            className="mt-0.5 accent-black shrink-0"
          />
          <div>
            <span className="font-ui text-ui text-black">ตั้งค่าสิทธิการใช้งานเอง</span>
            <p className="font-body text-body-sm text-grey-600 mt-0.5 leading-[1.6]">
              หากไม่เลือก จะใช้ค่า default ของ DHAMMADHA STUDIO (tier และราคามาตรฐาน)
            </p>
          </div>
        </label>
      </div>

      {!useDefault && (
        <>
          <div className="bg-surface p-5 mb-4">
            <h2 className="font-ui text-ui text-black mb-4">รูปแบบสิทธิและราคา</h2>
            <div className="flex flex-col gap-3">
              {tiers.map((tier, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 flex flex-col gap-2">
                    <input
                      type="text"
                      value={tier.name}
                      onChange={(e) => setTierField(i, "name", e.target.value)}
                      placeholder="ชื่อ tier เช่น บริษัทขนาดเล็ก"
                      className="w-full px-3 py-2 font-body text-body-sm text-black outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black bg-white"
                    />
                    <input
                      type="text"
                      value={tier.desc ?? ""}
                      onChange={(e) => setTierField(i, "desc", e.target.value)}
                      placeholder="รายละเอียด เช่น ผู้ใช้งานไม่เกิน 10 เครื่อง"
                      className="w-full px-3 py-2 font-body text-body-sm text-black outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black bg-white"
                    />
                    <div className="flex items-center gap-2">
                      <span className="font-body text-body-sm text-grey-600">฿</span>
                      <input
                        type="number"
                        value={tier.price}
                        onChange={(e) => setTierField(i, "price", e.target.value)}
                        placeholder="0"
                        min="0"
                        className="w-full px-3 py-2 font-body text-body-sm text-black outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black bg-white"
                      />
                    </div>
                  </div>
                  {tiers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTier(i)}
                      className="w-8 h-8 mt-1 flex items-center justify-center text-grey-600 hover:text-danger-dark transition-colors duration-150 ease-base bg-white border-none cursor-pointer shrink-0"
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
                className="mt-3 flex items-center gap-1.5 font-body text-body-sm text-mint-text cursor-pointer border-none bg-transparent p-0 hover:opacity-70 transition-opacity duration-150 ease-base"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                เพิ่ม tier
              </button>
            )}
            <p className="font-body text-footnote text-grey-600 mt-3 leading-[1.6]">
              หมายเหตุ: id ของแต่ละ tier ถูกตรึงไว้ถาวรและแก้ไม่ได้ — เปลี่ยนชื่อหรือรายละเอียดได้ตามต้องการโดยไม่กระทบใบเสนอราคา/ใบเสร็จเก่า แต่การลบ tier จะทำให้ลูกค้าเลือกรายการนั้นใหม่ไม่ได้ (ข้อมูลเก่ายังแสดงชื่อเดิมตามปกติ)
            </p>
          </div>

          <div className="bg-surface p-5 mb-4">
            <h2 className="font-ui text-ui text-black mb-1">ไฟล์สัญญาอนุญาต (PDF)</h2>
            <p className="font-body text-body-sm text-grey-600 mb-4 leading-[1.6]">
              จำเป็นต้องแนบเมื่อตั้งค่าสิทธิเอง — จะแสดงให้ลูกค้าดูใน lightbox ในหน้าขอใบเสนอราคา
            </p>

            {pdfUrl && !pdfFile && (
              <div className="flex items-center gap-2 mb-3 p-3 bg-white">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-5 h-5 text-danger-dark shrink-0">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="font-body text-body-sm text-mint-text no-underline hover:underline flex-1 truncate">
                  ดูไฟล์ที่อัปโหลด
                </a>
              </div>
            )}

            <label className="flex items-center gap-3 px-4 py-3 bg-white cursor-pointer hover:bg-grey-200 transition-colors duration-150 ease-base">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-5 h-5 text-grey-600 shrink-0">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span className="font-body text-body-sm text-grey-600">
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
              <p className="font-body text-footnote text-warning mt-2">⚠️ ยังไม่มีไฟล์ PDF — กรุณาอัปโหลดก่อนบันทึก</p>
            )}
          </div>
        </>
      )}

      {useDefault && (
        <div className="bg-surface p-5 mb-4">
          <h2 className="font-ui text-ui text-black mb-3">สิทธิ default ของเว็บ</h2>
          <div className="flex flex-col gap-2">
            {defaultTiers.map((t) => (
              <div key={t.id} className="flex justify-between items-center py-2">
                <div>
                  <span className="font-body text-body-sm text-grey-600">{t.name}</span>
                  {t.desc && <p className="font-body text-footnote text-grey-600 mt-0.5">{t.desc}</p>}
                </div>
                <span className="font-ui text-ui text-black">฿{t.price.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <p className="font-body text-body-sm text-grey-600 mt-3">
            กด &quot;ตั้งค่าสิทธิการใช้งานเอง&quot; เพื่อปรับแก้ราคาสิทธิการใช้งานแบบองค์กร
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
      <div className="bg-surface p-5 mb-4">
        <h2 className="font-ui text-ui text-black mb-1">โปรโมชั่น</h2>
        <p className="font-body text-body-sm text-grey-600 mb-4">ส่วนลดทั้งร้าน — มีผลกับฟอนต์ทุกตัวที่ไม่ใช่ฟรี โดยไม่ลบ/ทับส่วนลดรายฟอนต์ที่ตั้งแยกไว้</p>
        {promo.active && (
          <div className="mb-3 px-4 py-3 bg-warning font-body text-body-sm text-black">
            ⚡ โปรโมชั่นเปิดอยู่: ลด {promo.discount}%{promo.end ? ` ถึง ${formatSaleEnd(promo.end)}` : ""}
            {promo.end && promo.end < todayISO() && (
              <span className="block mt-1 text-danger-dark">หมดอายุแล้ว — ลูกค้าไม่เห็นส่วนลดนี้ กดปิดโปรโมชั่นหรือตั้งวันใหม่ได้</span>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-body text-body-sm text-grey-600">ส่วนลด (%)</label>
            <input type="number" value={promo.discount} onChange={(e) => setPromo((p) => ({ ...p, discount: e.target.value }))} placeholder="เช่น 20" min="1" max="100" className={iCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-body text-body-sm text-grey-600">วันสิ้นสุด *</label>
            <input type="date" value={promo.end} min={todayISO()} onChange={(e) => setPromo((p) => ({ ...p, end: e.target.value }))} className={iCls} />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={savePromo} disabled={promoSaving} className="flex-1 py-2 bg-mint text-black font-ui text-ui border-none cursor-pointer hover:bg-black hover:text-white transition-colors duration-150 ease-base disabled:opacity-50">
            {promoSaving ? "กำลังบันทึก…" : "บันทึก / เปิดโปรโมชั่น"}
          </button>
          {promo.active && (
            <button onClick={clearPromo} disabled={promoSaving} className="px-4 py-2 text-danger-dark bg-surface font-ui text-ui cursor-pointer hover:bg-danger hover:text-white transition-colors duration-150 ease-base disabled:opacity-50">
              ปิดโปรโมชั่น
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-[190] px-4 py-3 bg-black text-white font-body text-body-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

const iCls = "w-full px-3 py-2 bg-white font-body text-body-sm text-black outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black transition-colors duration-150 ease-base";
