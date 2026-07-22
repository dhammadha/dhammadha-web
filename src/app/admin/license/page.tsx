"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/Button";
import {
  parseLicenseSettings,
  newTierId,
  type LicenseTier,
} from "@/lib/license";

export default function AdminLicensePage() {
  const [tiers, setTiers] = useState<LicenseTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);

  const showToast = (msg: string, error = false) => {
    setToast({ msg, error });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    supabase
      .from("settings")
      .select("value")
      .eq("key", "licensing")
      .maybeSingle()
      .then(({ data }) => {
        setTiers(parseLicenseSettings(data?.value));
        setLoading(false);
      });
  }, []);

  const setTierField = (i: number, field: "name" | "desc" | "price", val: string) => {
    setTiers((prev) =>
      prev.map((t, idx) =>
        idx === i ? { ...t, [field]: field === "price" ? Number(val) || 0 : val } : t
      )
    );
  };

  const addTier = () =>
    setTiers((prev) => [...prev, { id: newTierId(), name: "", desc: "", price: 0 }]);

  const removeTier = (i: number) => {
    if (tiers.length <= 1) return;
    setTiers((prev) => prev.filter((_, idx) => idx !== i));
  };

  const save = async () => {
    // desc เก็บเป็น string เสมอ ("" = ไม่มี) เพื่อให้ตรงกับชนิด Json ของ supabase
    // ตอนอ่านกลับ parseLicenseSettings จะตัด desc ว่างทิ้งให้เอง
    const cleaned = tiers.map((t) => ({
      id: t.id,
      name: t.name.trim(),
      desc: t.desc?.trim() ?? "",
      price: Number(t.price) || 0,
    }));
    if (cleaned.some((t) => !t.name)) {
      showToast("กรุณาใส่ชื่อรูปแบบสิทธิให้ครบทุกรายการ", true);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("settings")
      .upsert({ key: "licensing", value: { tiers: cleaned } });
    if (error) showToast("เกิดข้อผิดพลาด: " + error.message, true);
    else {
      setTiers(cleaned);
      showToast("✓ บันทึกโครงสร้างสิทธิเรียบร้อย");
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="p-6 font-body text-body-sm text-grey-600">กำลังโหลด…</div>;
  }

  return (
    <div className="p-6 max-w-[720px] flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-h2 text-black">License</h1>
        <p className="font-body text-body-sm text-grey-600 mt-0.5 leading-[1.6]">
          โครงสร้างและราคาสิทธิ์ใช้งาน <strong className="text-black">default ของเว็บ</strong> —
          ใช้กับหน้าฟอนต์และหน้าขอใบเสนอราคาทั้งเว็บ เพิ่ม/ลบ/แก้ไขรูปแบบสิทธิได้อิสระ
          <br />
          นักออกแบบแต่ละคนยังตั้งค่าสิทธิของตัวเองทับได้ที่หน้า &quot;ราคาและโปรโมชั่น&quot; ของตน
        </p>
      </div>

      <div className="bg-surface p-6">
        <div className="flex flex-col gap-3">
          {tiers.map((tier, i) => (
            <div key={tier.id} className="flex gap-2 items-start">
              <div className="flex-1 flex flex-col gap-2">
                <input
                  type="text"
                  value={tier.name}
                  onChange={(e) => setTierField(i, "name", e.target.value)}
                  placeholder="ชื่อรูปแบบสิทธิ เช่น บริษัทขนาดเล็ก / กลาง"
                  className={iCls}
                />
                <input
                  type="text"
                  value={tier.desc ?? ""}
                  onChange={(e) => setTierField(i, "desc", e.target.value)}
                  placeholder="คำอธิบาย (ไม่บังคับ) เช่น ผู้ใช้งานไม่เกิน 10 เครื่อง"
                  className={iCls}
                />
                <div className="flex items-center gap-2">
                  <span className="font-body text-body-sm text-grey-600 shrink-0">฿</span>
                  <input
                    type="number"
                    value={tier.price}
                    onChange={(e) => setTierField(i, "price", e.target.value)}
                    placeholder="0"
                    min="0"
                    className={iCls}
                  />
                </div>
              </div>
              {tiers.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTier(i)}
                  title="ลบรูปแบบสิทธินี้"
                  className="w-8 h-8 mt-1 flex items-center justify-center text-grey-600 hover:text-danger-dark transition-colors duration-150 ease-base bg-white cursor-pointer shrink-0 border-none"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addTier}
          className="mt-3 flex items-center gap-1.5 font-body text-body-sm text-mint-text cursor-pointer border-none bg-transparent p-0 hover:opacity-70 transition-opacity duration-150 ease-base"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          เพิ่มรูปแบบสิทธิ
        </button>

        <p className="font-body text-footnote text-grey-600 mt-4 leading-[1.6]">
          หมายเหตุ: id ของแต่ละรูปแบบสิทธิถูกตรึงไว้ถาวรและแก้ไม่ได้ — เปลี่ยนชื่อได้ตามต้องการโดยไม่กระทบใบเสนอราคา/ใบเสร็จเก่า
          แต่การลบรูปแบบสิทธิจะทำให้ลูกค้าเลือกรายการนั้นใหม่ไม่ได้ (ข้อมูลเก่ายังแสดงชื่อเดิมตามปกติ)
        </p>

        <Button onClick={save} disabled={saving} className="w-full mt-4">
          {saving ? "กำลังบันทึก…" : "บันทึกโครงสร้างสิทธิ"}
        </Button>
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[200] px-4 py-3 font-body text-body-sm shadow-lg ${toast.error ? "bg-danger text-white" : "bg-black text-white"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

const iCls = "w-full px-3 py-2 bg-white font-body text-body-sm text-black outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black transition-colors duration-150 ease-base";
